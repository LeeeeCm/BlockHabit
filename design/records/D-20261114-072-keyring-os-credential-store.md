---
id: D-20261114-072
date: 2026-11-14
title: WebDAV 密码交给 OS 凭据管理器（C4 §4 方案 B 落地：keyring 依赖 + 迁移/回退 + 文案）
status: approved
owner: lead
surface: [settings]
axioms: [A7]
files: [src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/src/credentials.rs, src/platform/credentials.ts, src/sync/useSync.ts, src/sync/types.ts, src/components/WebdavPanel.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

B1（D-20261110-058 批次）给了「记住密码」开关：关掉后密码只留在本次运行内存，localStorage 不再写入明文。
但**默认仍是「记住」**——此时 WebDAV 密码以明文躺在 WebView 的 localStorage 里，只要能读到当前用户目录就能读走它。
`docs/release/updater-and-keyring-assessment.md`（C4）把它列为「需人类批准」的下一轮项，方案 B 是
「Rust `keyring` crate + 自定义 command + `src/platform/credentials.ts` 抽象层」。

本轮用户已授权「按 C4 评估 §4 方案 B 实施（新增 keyring 依赖 + 迁移方案 + 回退与测试，不破坏 rememberPassword=false 不落盘）」，本记录按此落地。

## 设计决定

1. **依赖只加一个、且只在 Windows 目标上编译**：`keyring = { version = "3.6.3", default-features = false, features = ["windows-native"] }`，
   写在 `[target.'cfg(windows)'.dependencies]`。不用 `keyring` 4.x：它的 `v1` 特性会把 Apple/Linux 后端一起拉进来；
   3.x 的 `windows-native` 只额外拉 `windows-sys` 与 `byteorder`。
2. **Rust 侧只暴露四个最小命令**（`src-tauri/src/credentials.rs`）：`credential_available / credential_set / credential_get / credential_delete`。
   不枚举、不导出、不记录密码；底层 `keyring::Error` 一律折平成稳定码（`no-entry` / `platform-failure` / `no-storage-access` / …），
   不把可能带路径的错误原文透给界面。service 固定 `com.blockhabit.app`。
3. **账号键不落明文身份**：`sha256(endpoint + 换行 + username)` 十六进制（前端用既有 `sha256Hex`，含纯 TS 兜底）。
   用换行分隔是为了「a + bc」与「ab + c」不会撞成同一个键；Rust 侧校验账号键只含十六进制/连字符/下划线、非空且有界。
4. **存储位置的语义不变**：`rememberPassword` 仍然是「本机记住」，只是**记忆的介质**从明文文件升级为系统凭据管理器。
   - `rememberPassword=false` → 内存-only，且**同时删除**凭据管理器里的旧条目（不破坏 B1 的假安全修复）；
   - `rememberPassword=true` 且 OS 存储可用 → 密码进凭据管理器，localStorage 只留 `credentialStore: 'os'` 标记、**不含明文**；
   - OS 存储不可用（浏览器预览 / 企业策略禁用） → 完全退回旧行为，明文随配置落盘，不做任何降级失败。
5. **迁移是「隐私优先」的一次性搬移**：`useSync` 首次挂载时探测一次（注意：`useSync` 由 `SettingsDialog` 调用，
   `SettingsDialog` 只在「打开设置」时挂载，所以实际时点是**启动后第一次打开设置页**，不是进程启动瞬间——
   这是既有的同步挂载方式，本轮不改）；若读到明文密码且存储可用，写入凭据管理器，成功后才清掉本地明文并打标记；
   写入失败则保持原样、下次启动重试（绝不谎报已迁移）。`credentialStore='os'` 时重开从凭据管理器回填，仍然自动同步。
6. **同步路径自愈**：`syncNow()` 发现 `credentialStore='os'` 但内存里没有密码时，先回填再发请求，避免用空密码打服务器；
   启动自动同步因此不依赖 React effect 的挂载顺序。
7. **文案**：新增一个用户可见键 `settings.webdav.rememberPasswordHintOs`（zh/en 同步补齐），只在 `credentialStore === 'os'` 时显示，
   原 `rememberPasswordHintOn/Off` 一字不改，避免影响既有语义与既有测试。

## 取舍与被否方案

- **否掉「新增 npm 依赖 / 社区 `tauri-plugin-keyring`」**：方案 B 只需要 Rust crate + `invoke`，前端零新依赖，供应链面最小；
  社区插件要额外审维护状态（C4 §4.2 方案 C 的保留意见）。
- **否掉「`keyring` 4.x 默认特性」**：会把 Apple/Linux 后端与 zbus 一并拉进来，安装包与编译时间都涨，且 Windows 上根本用不到。
- **否掉「用邮箱/URL 当账号键」**：凭据管理器是明文可浏览的，不能把用户身份写进去。
- **否掉「迁移时不删明文、双写一段时间」**：那样「关掉记住」的安全承诺又撕开了口子；本方案选择「搬完即删 + 回滚靠重输一次密码」。
- **否掉「密码写进存档 JSON」**：存档要跨设备同步/导出，那是把密码送出去，明确不做。
- **否掉「非 Windows 也实现」**：README 的平台范围决议（D-20261110-050 / F10）写明正式发布目标只有 Windows；
  非 Windows 返回 `unsupported`，前端回退旧行为。

## 影响面

- 依赖：+1 Rust crate（仅 Windows 目标；`keyring 3.6.3` + `windows-sys` / `byteorder`）。前端依赖零新增。
- 代码：新增 `src-tauri/src/credentials.rs`、`src/platform/credentials.ts`；`src/sync/useSync.ts` 增加探测/迁移/回填与三处持久化分支；
  `src/sync/types.ts` 增加可选字段 `credentialStore?: 'os'`（旧存档无此字段即为旧行为，**不升 schemaVersion**）。
- 存储：**新增一个可选字段**，不改变存档 JSON、不改变同步合并口径；`credentialStore` 只出现在 WebDAV 配置（独立 localStorage 键），与 AppState 无关。
- 用户可见：设置 → 同步 → 「记住密码」下方说明文案在桌面端变为「密码由 Windows 凭据管理器保管…」；其余文案与控件不变，视觉语言零变化。
- 回滚：把 `plugins`/命令与 `src/platform/credentials.ts` 调用去掉即可退回旧行为；已迁移的用户会回到「需要重输一次密码」，数据不丢。

## 验收标准

1. `cargo test --lib`：凭据模块的账号键校验用例（接受 sha256 hex、拒绝空/超长/明文身份）全绿。
2. `npm test`：`src/sync/webdavKeyring.test.ts` 覆盖「不可用退回旧行为 / 可用时不落明文 / 迁移成功即删明文 / 迁移失败保持原样 /
   回填 / 关闭记住后删除凭据 / 探测失败不误删」；`src/platform/credentials.test.ts` 覆盖不可用时不谎报成功与账号键派生。
3. `rememberPassword=false` 时 localStorage 与凭据管理器**都不含密码**（B1 行为不回退）。
4. 浏览器预览（无 `__TAURI_INTERNALS__`）下同步功能行为与改造前完全一致。
5. `npx tsc --noEmit` 0 错误；`npm run design:check` 通过。

## 仍需人工验收（本环境无桌面窗口）

- 真机 C6：保存 WebDAV → 检查 `%APPDATA%` 下 WebView 数据里无明文密码 → 重启后自动同步 → 在「凭据管理器 → Windows 凭据」里能看到
  `com.blockhabit.app` 条目 → 手动删除该条目后重启应提示重输而不是崩溃。
- 卸载残留：NSIS 卸载不会自动清 Credential Manager 条目，需在真机确认残留并记录（见 `docs/release/real-device-acceptance.md`）。

## 变更履历

- 2026-11-14 created (lead)：按用户授权实施 C4 §4 方案 B；本记录状态由人类授权直接置为 approved（reviewer=LeeCM）。
- 2026-11-14 implemented：`keyring 3.6.3`（仅 Windows 目标）、`src-tauri/src/credentials.rs`（4 命令 + 账号键校验 + 3 例单测）、
  `src/platform/credentials.ts`（探测/派生/读写/删除 + 6 例单测）、`src/sync/useSync.ts`（探测→迁移→回填 + 三处持久化分支 + `syncNow` 自愈）、
  `src/sync/webdavKeyring.test.ts`（10 例）、新增 i18n 键 `rememberPasswordHintOs`（zh/en）并在 WebdavPanel 条件显示。
  `cargo test --lib` 6 例全绿；`npx tsc --noEmit` 0 错误。
