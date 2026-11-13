# 发布链路 Runbook（C4 / D-20261111-069）

> **状态：2026-11-14 起已配置完毕，可重复发布。** 一次性配置（§1）已全部完成，
> 0.2.1 由 `.github/workflows/release.yml` 出签名包并上传 `latest.json`。
> 本文件从「待人类配置的手册」转为「每次都照做的发布流程 + 故障排查」。
>
> 已完成的一次性配置（留档）：
> - 密钥对在本机 `%USERPROFILE%\blockhabit-keys\`（`blockhabit.key` 私钥、`blockhabit.key.pub` 公钥、
>   `PASSWORD.txt` 私钥密码）。**三者都只在仓库外，绝不入库、不打印**；请自行再做一次离线备份。
> - 公钥已写入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`（公开值，可提交）。
> - `plugins.updater.endpoints` = `https://github.com/LeeeeCm/BlockHabit/releases/latest/download/latest.json`。
> - Actions secrets：`TAURI_SIGNING_PRIVATE_KEY`（私钥**全文**）、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
> - 仓库已转 **public**（私有仓库的 Release 资产需要 token，updater 不带 token 会 404）。
> - Windows Authenticode 代码签名仍为**可选未做**（见 §4）。

## 0. 前置检查（缺一不可）

- [x] 仓库可被 updater 无认证访问：**公开仓库**（2026-11-14 由 private 改为 public）。
- [ ] 已决定版本号，并同步三处：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`
      （+`Cargo.lock` 的 blockhabit 包版本）；`npm run check:versions` 通过。
- [x] 安装 Rust/Tauri 构建环境（CI 用 `windows-latest`）。
- [x] 已完成 `on_before_exit` 存档握手：Rust 侧拦截 `RunEvent::ExitRequested`（`code == None` 时），
      前端 `forceFlush()` 后 `confirm_quit`；安装器路径由 `installUpdate({ beforeInstall })` 在
      `downloadAndInstall()` 前 await `forceFlush`（D-20261110-019 履历、D-20261114-072）。
      **已知限制**：tao 0.37.1 不处理 `WM_QUERYENDSESSION`，真·关机/注销不保证送达。

## 1. 一次性配置（✅ 2026-11-14 已完成，留作重建参考）

> 如果密钥丢失或需要轮换，照本节重做，并把新公钥重新填进 `plugins.updater.pubkey`、
> 重新设置两个 secrets、然后**发一个更高版本**（旧安装不会自动接受新公钥，只能靠手动覆盖安装）。

### 1.1 生成签名密钥（仓库外，绝不提交）

```bash
# 在仓库外目录执行；会生成 blockhabit.key（私钥）与 blockhabit.key.pub（公钥）
npx tauri signer generate -w <仓库外路径>/blockhabit.key
```

- 私钥与密码离线备份两份（丢失 = 现有安装无法接收后续更新）。
- 公钥全文填入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`；**公钥可以提交**，私钥绝不提交。
- 在 GitHub → Settings → Secrets and variables → Actions 添加：
  - `TAURI_SIGNING_PRIVATE_KEY`：私钥文件**全文**（不是路径）
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码

### 1.2 配置更新端点

在 `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` 填入 latest.json 的公开 URL，例如：

```json
"endpoints": [
  "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
]
```

> 若使用对象存储/CDN，把 latest.json 与安装包放在同一公开域名下，URL 写实际地址。
> 端点必须 HTTPS；更新流程只做手动检查（无启动自动检查、无静默下载）。

### 1.3 启用 updater 构建产物

本地默认构建**不**生成 updater 产物（避免无密钥时开发者构建失败）；发布专用配置为
`src-tauri/tauri.release.conf.json`（`bundle.createUpdaterArtifacts: true`），由 release workflow 通过
`tauri build --config src-tauri/tauri.release.conf.json` 使用。

> **实测坑（2026-11-14）**：本地复现时设 `TAURI_SIGNING_PRIVATE_KEY_PATH` 会报
> 「A public key has been found, but no private key」——bundler 只认 `TAURI_SIGNING_PRIVATE_KEY`（内容）。
> 本地复现请用 `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw <key>`。

发布构建还必须设置 `VITE_UPDATER_ENABLED=1`（release workflow 已内置）：前端据此启用「检查更新」；
未设置时即使填了密钥/端点，安装包里的按钮仍是安全禁用态。workflow 在构建前会校验
`plugins.updater.pubkey`、`endpoints` 与私钥 secret 非空，缺失会直接失败而不是产出坏包。

## 2. 发布步骤

1. 合并到 `main`，确认门禁全绿（workflow 会再跑一遍）。
2. 决定版本号并同步三处构建文件，提交。
3. GitHub → Actions → **Release** → Run workflow，填写：
   - `version`：与构建文件一致的 x.y.z
   - `notes`：发布说明（写入 Release 与 latest.json）
4. Workflow 会：跑门禁 → 校验版本输入 → **校验 pubkey/endpoints/私钥** → 带 `VITE_UPDATER_ENABLED=1`
   签名构建 NSIS/MSI → 创建 GitHub Release（`v<version>`）→ 生成并上传 `latest.json`。
5. 按 `docs/release/real-device-acceptance.md` 的 **T6** 验收：
   - 旧版本打开 设置 → 内容路线 → 版本与更新 → 检查更新
   - 发现新版本 → 下载并安装 → 重启后数据/设置/WebDAV 配置不丢
   - 篡改 latest.json 签名 → 拒绝并提示校验失败
   - 断网/404 → 诚实提示失败，不伪装「已是最新」
   - 抓包确认只含版本/平台/架构，无用户标识

## 3. 回滚与故障

- **不自动降级**：回滚只能发布更高版本（例如 0.2.2）修复；旧版本不会自动回退。
- 签名校验失败：确认公钥与私钥配对、latest.json 的 signature 与产物 .sig 一致。
- 404：确认仓库公开、端点 URL、Release 资产名与 latest.json 的 url 完全一致。
- 版本不一致：workflow 的 `Verify version input` 会失败；先改三处版本并跑 `npm run check:versions`。
- 密钥丢失：现有安装将无法安全升级，只能让用户手动下载覆盖安装；因此务必离线备份。

## 4. 安全与隐私边界

- 更新检查仅由用户点击触发；无启动自动检查、无后台定时检查、无静默下载。
- 不上报成功率/设备标识等遥测；错误详情只显示脱敏单行 message。
- 私钥只存 GitHub Actions secrets 与离线备份，不进仓库、不写日志。
- 发布端点仅用于下载签名清单与安装包，不携带账号/设备信息。

## 5. 待人类完成项（2026-11-14 更新）

| # | 项 | 状态 |
| --- | --- | --- |
| 1 | 生成并保管签名密钥 | ✅ 已完成（`%USERPROFILE%\blockhabit-keys\`，请自行离线备份） |
| 2 | 填 `plugins.updater.pubkey` 与 `endpoints` | ✅ 已完成 |
| 3 | 配置 Actions secrets | ✅ 已完成（两个 secret 均存在） |
| 4 | Windows Authenticode 代码签名 | ⬜ **可选、未做**：需购买证书；不做的后果是安装时 SmartScreen 提示「未知发布者」 |
| 5 | Rust `on_before_exit` 存档握手 | ✅ 代码已落地并有单测；**真机验证**见 T7 |
| 6 | 是否允许启动自动检查 | ⬜ 维持 D-069 的手动检查（不做启动自动检查、不做后台轮询） |
| 7 | T6 真机自动更新全流程 | ⬜ 需人工执行，载荷与步骤见 `real-device-acceptance.md` §6 / §12 |
| 8 | T8 keyring 真机验收 | ⬜ 需人工执行，见 `real-device-acceptance.md` §7.5 |
