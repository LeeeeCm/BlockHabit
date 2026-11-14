//! C4 §4 方案 B：WebDAV 密码交给 OS 凭据管理器（Windows Credential Manager）。
//!
//! 为什么：密码原本以明文写在 localStorage（WebView 的 LevelDB）里，
//! 只要能读到你的用户目录就能读到它。交给凭据管理器后，
//! 密码由 OS 保护（同用户进程仍可读，但不再是一个可直接拷走的文本文件）。
//!
//! 边界：
//! - 只实现 Windows（产品发布目标平台）；其它平台直接返回 unsupported，前端回退到原有
//!   localStorage 行为，不会因为引入这个模块而用不了。
//! - 只暴露四个最小能力：available / set / get / delete。不枚举、不导出、不记录密码。
//! - 错误一律映射为稳定字符串码，不把底层错误原文（可能带路径/键名）透给界面。

/// 凭据条目的服务名：用反向域名，与应用 identifier 一致，方便在凭据管理器里识别。
pub(crate) const SERVICE: &str = "com.blockhabit.app";

/// 可用性探测用的固定账号（只读，不写入任何凭据）
const PROBE_ACCOUNT: &str = "__deadbeef__";

/// 账号键长度上限（前端传 sha256 hex，64 字符）
const MAX_ACCOUNT_LEN: usize = 128;

pub(crate) const ERR_INVALID_ACCOUNT: &str = "invalid-account";
/// 仅非 Windows 后端使用（Windows 上直接编译掉，避免 dead_code 警告）
#[cfg(not(windows))]
pub(crate) const ERR_UNSUPPORTED: &str = "unsupported";

/// 空密码的语义：视为「不保存」，并删除该账号的旧条目（幂等）。
/// 前端目前只在密码非空时调用 set、清空走 delete；这里补齐后端语义，
/// 避免将来某个调用点传空串时在凭据管理器里留下一条旧密码。
fn empty_secret_means_delete(secret: &str) -> bool {
    secret.is_empty()
}

/// 账号键只用于拼接 Credential Manager 的 target 后缀：
/// 必须非空、有界、只含十六进制/连字符/下划线，避免把用户名、URL 或任意文本写进系统。
/// 空串会被 keyring 当成合法条目，因此必须在这里拒掉。
pub(crate) fn validate_account(account: &str) -> Result<(), &'static str> {
    if account.is_empty() || account.len() > MAX_ACCOUNT_LEN {
        return Err(ERR_INVALID_ACCOUNT)
    }
    if !account
        .chars()
        .all(|c| c.is_ascii_hexdigit() || c == '-' || c == '_')
    {
        return Err(ERR_INVALID_ACCOUNT)
    }
    Ok(())
}

#[cfg(windows)]
mod backend {
    use super::{empty_secret_means_delete, validate_account, PROBE_ACCOUNT, SERVICE};

    const ERR_NO_ENTRY: &str = "no-entry";
    const ERR_PLATFORM: &str = "platform-failure";
    const ERR_NO_ACCESS: &str = "no-storage-access";
    const ERR_TOO_LONG: &str = "too-long";
    const ERR_INVALID: &str = "invalid";
    const ERR_AMBIGUOUS: &str = "ambiguous";
    const ERR_UNKNOWN: &str = "unknown";

    /// 把底层错误折平成稳定码（不带原文、不带密码）
    fn code_of(error: &keyring::Error) -> &'static str {
        match error {
            keyring::Error::NoEntry => ERR_NO_ENTRY,
            keyring::Error::PlatformFailure(_) => ERR_PLATFORM,
            keyring::Error::NoStorageAccess(_) => ERR_NO_ACCESS,
            keyring::Error::TooLong(_, _) => ERR_TOO_LONG,
            keyring::Error::Invalid(_, _) => ERR_INVALID,
            keyring::Error::Ambiguous(_) => ERR_AMBIGUOUS,
            _ => ERR_UNKNOWN,
        }
    }

    fn open(account: &str) -> Result<keyring::Entry, String> {
        validate_account(account).map_err(|code| code.to_string())?;
        keyring::Entry::new(SERVICE, account).map_err(|e| code_of(&e).to_string())
    }

    /// 能不能用：用一次只读探测判断（NoEntry 或读到值都算可用；
    /// 平台故障、策略拒绝都算不可用）。探测只读，不会写入任何凭据。
    pub fn available() -> bool {
        match keyring::Entry::new(SERVICE, PROBE_ACCOUNT) {
            Ok(entry) => match entry.get_password() {
                Ok(_) => true,
                Err(keyring::Error::NoEntry) => true,
                Err(_) => false,
            },
            Err(_) => false,
        }
    }

    pub fn set(account: &str, secret: &str) -> Result<(), String> {
        let entry = open(account)?;
        // 空密码：不写空条目，并删除该账号的旧条目（幂等），避免旧密码残留
        if empty_secret_means_delete(secret) {
            return match entry.delete_credential() {
                Ok(()) => Ok(()),
                Err(keyring::Error::NoEntry) => Ok(()),
                Err(e) => Err(code_of(&e).to_string()),
            };
        }
        entry
            .set_password(secret)
            .map_err(|e| code_of(&e).to_string())
    }

    /// 读不到条目返回 None ——「没记过密码」与「读失败」必须区分
    pub fn get(account: &str) -> Result<Option<String>, String> {
        match open(account)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(code_of(&e).to_string()),
        }
    }

    /// 本来就没有条目也算删除成功（幂等）
    pub fn delete(account: &str) -> Result<bool, String> {
        match open(account)?.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(true),
            Err(e) => Err(code_of(&e).to_string()),
        }
    }
}

#[cfg(not(windows))]
mod backend {
    use super::ERR_UNSUPPORTED;

    /// 非 Windows：产品不发布，直接告知不可用，前端回退到 localStorage。
    pub fn available() -> bool {
        false
    }
    pub fn set(_account: &str, _secret: &str) -> Result<(), String> {
        Err(ERR_UNSUPPORTED.to_string())
    }
    pub fn get(_account: &str) -> Result<Option<String>, String> {
        Err(ERR_UNSUPPORTED.to_string())
    }
    pub fn delete(_account: &str) -> Result<bool, String> {
        Err(ERR_UNSUPPORTED.to_string())
    }
}

/// OS 凭据存储是否可用（纯探测，不改任何数据）
#[tauri::command]
pub fn credential_available() -> bool {
    backend::available()
}

/// 写入/覆盖密码；空字符串视为「不保存」并删除旧条目。不返回也不记录密码本身。
#[tauri::command]
pub fn credential_set(account: String, secret: String) -> Result<(), String> {
    backend::set(&account, &secret)
}

/// 读取密码；没有条目返回 null，读取失败返回错误码。
#[tauri::command]
pub fn credential_get(account: String) -> Result<Option<String>, String> {
    backend::get(&account)
}

/// 删除密码（关闭「记住密码」/ 清空配置）；幂等。
#[tauri::command]
pub fn credential_delete(account: String) -> Result<bool, String> {
    backend::delete(&account)
}

#[cfg(test)]
mod tests {
    use super::{empty_secret_means_delete, validate_account};

    #[test]
    fn empty_secret_means_delete_old_entry() {
        assert!(empty_secret_means_delete(""));
        assert!(!empty_secret_means_delete("secret"));
        assert!(!empty_secret_means_delete(" "));
    }

    #[test]
    fn accepts_sha256_hex_accounts() {
        assert!(validate_account(&"a".repeat(64)).is_ok());
        assert!(validate_account("__deadbeef__").is_ok());
        assert!(validate_account("0f1e2d3c-ab_cd").is_ok());
    }

    #[test]
    fn rejects_empty_or_oversized_accounts() {
        assert!(validate_account("").is_err());
        assert!(validate_account(&"a".repeat(129)).is_err());
    }

    #[test]
    fn rejects_plaintext_identifiers() {
        // 不允许把用户名、邮箱、URL 或昵称直接当账号键写进凭据管理器
        assert!(validate_account("lee@example.com").is_err());
        assert!(validate_account("https://dav.example.com").is_err());
        assert!(validate_account("李晨").is_err());
    }
}
