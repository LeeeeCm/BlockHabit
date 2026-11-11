# 发布链路 Runbook（C4 / D-20261111-069）

> 本文件是「手动检查更新 → 自动更新」真正可用前的人类操作手册。
> 代码侧已就绪：updater/process 插件、设置页「版本与更新」入口、默认构建安全禁用、
> `.github/workflows/release.yml` 骨架、`scripts/make-latest-json.mjs` 签名清单生成。
> **未就绪的是发布凭证与托管**：签名私钥、公钥、发布端点、GitHub secrets、代码签名（可选）。

## 0. 前置检查（缺一不可）

- [ ] 仓库可被 updater 无认证访问：**公开仓库**或把 `latest.json` 与安装包托管到公开静态站/CDN。
      GitHub Release 资产在私有仓库需要 token，updater 不会带 token，私有仓库模式下会 404。
- [ ] 已决定版本号（例如 0.2.0 → 0.2.1），并同步三处：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`；`npm run check:versions` 通过。
- [ ] 安装 Rust/Tauri 构建环境（CI 用 `windows-latest` 即可）。
- [ ] 已完成 `on_before_exit` 存档握手（C4 待实现项）：安装器退出应用前必须 flush 存档，避免丢最近打卡。

## 1. 一次性配置（只做一次）

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

## 2. 发布步骤

1. 合并到 `main`，确认门禁全绿（workflow 会再跑一遍）。
2. 决定版本号并同步三处构建文件，提交。
3. GitHub → Actions → **Release** → Run workflow，填写：
   - `version`：与构建文件一致的 x.y.z
   - `notes`：发布说明（写入 Release 与 latest.json）
4. Workflow 会：跑门禁 → 校验版本输入 → 带签名构建 NSIS/MSI → 创建 GitHub Release（`v<version>`）
   → 生成并上传 `latest.json`。
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

## 5. 待人类完成项（与 C4 评估一致）

1. 生成并保管签名密钥（§1.1）。
2. 填 `plugins.updater.pubkey` 与 `endpoints`（§1.1/§1.2）。
3. 配置 Actions secrets（§1.1）。
4. （可选）Windows Authenticode 代码签名。
5. 实现并验证 Rust `on_before_exit` 存档握手（安装器退出应用前 flush）。
6. 决定是否允许启动自动检查（默认不建议；D-069 设计为手动）。
