# 安全策略

BlockHabit 是一个**本地优先**的桌面习惯打卡应用：无账号、无后端、无遥测上传。数据默认只保存在你自己的机器上；WebDAV 同步与「检查更新」都是可选、由用户显式触发的功能。

本文件说明如何**私密地**报告安全问题、哪些问题在范围内、我们如何响应，以及项目的数据边界。

---

## 如何报告漏洞

**请优先使用 GitHub Security Advisories 的私密报告功能，不要开公开 issue。**

1. 打开仓库 **Security** 标签页：<https://github.com/LeeeeCm/BlockHabit/security>
2. 点击 **Advisories** → **Report a vulnerability**（也可直接访问 <https://github.com/LeeeeCm/BlockHabit/security/advisories/new>）
3. 写清：受影响的版本、复现步骤、预期影响、你能想到的攻击场景；如有 PoC 或补丁建议请一并附上。

**不要在公开 issue / PR / 讨论区贴敏感细节**，包括但不限于：

- WebDAV 地址、账号、密码或令牌；
- 更新签名私钥、GitHub Actions secrets、任何构建凭据；
- 可识别个人的打卡数据、未打码的截图或含用户名的本地路径；
- 未修复漏洞的完整可利用细节。

如果暂时无法使用 Advisories（例如没有 GitHub 账号），请先开一个**不含敏感细节**的 issue，说明「有一个安全问题需要通过私密渠道报告」，维护者会跟进。

## 支持范围

| 版本                        | 支持状态                            |
| --------------------------- | ----------------------------------- |
| 0.2.x（当前 0.2.2）         | 接收并处理安全报告                  |
| < 0.2                       | 不再修复，请先升级到 0.2.x 最新版本 |
| 默认分支 / 未发布的本地构建 | 尽力而为，不承诺修复                |

- 正式目标平台是 **Windows 桌面端**；移动端为实验状态（无构建目标），见 [README](README.md#平台范围)。
- 已发布安装包与签名资产见 GitHub Releases；安装包完整性以 minisign 签名与 `.sha256` 校验文件为准。

## 响应预期

- **尽力而为，无 SLA**：这是个人维护的开源项目，没有 7×24 值班与固定的响应时限。
- 我们会尽快确认收到报告、给出初步判断；修复节奏取决于严重性、可复现性与影响面。
- 在修复发布（或双方约定的披露时间）之前，请对细节保密；发布后如你愿意，可以在 advisory 中致谢。
- 我们不会对善意安全研究采取法律行动；请只在**你自己拥有或获授权**的环境与数据上测试。

## 安全范围

**在范围内**

- 桌面端本体：Tauri 2 壳（窗口 / 托盘 / 单实例 / 命令与权限边界）、React 前端、CSP 与资源加载。
- 本地数据：`appDataDir/blockhabit.json` 读写、备份轮转、导入 / 导出（JSON 与完整档案包）的路径与内容处理。
- WebDAV 同步：连接自检、认证头处理、远端合并（墓碑防复活）、凭据读取与清除。
- 更新链路：手动「检查更新」、`latest.json` 拉取、minisign 签名校验、安装器安装流程。
- 签名与发布流水线：`.github/workflows/release.yml` 中的 secrets 使用、私钥不进仓库、发布资产完整性。

**不在范围内**

- Windows / Microsoft Edge WebView2 本身的缺陷（请报给微软）。
- 安装包**未做 Authenticode 代码签名**导致 SmartScreen「未知发布者」或杀软提示——这是已知取舍；minisign 签名用于校验更新完整性，不等同于 Windows 代码签名。
- 第三方 WebDAV 服务商（Nextcloud / 坚果云 / 群晖等）自身的问题、服务端配置或弱口令。
- 用户自行修改的构建、第三方重新打包或再分发。
- 需要本机已被入侵、已取得管理员权限或已能物理接触设备才能利用的问题（此类场景没有可信安全边界）。
- 功能建议、界面问题与非安全类 Bug，请走 [Issue 模板](.github/ISSUE_TEMPLATE/)。

## 隐私与数据边界

- **本地优先**：数据默认存 `appDataDir/blockhabit.json`；浏览器预览回退到 localStorage。
- **无账号、无后端、无遥测上传**；崩溃日志只写本机 localStorage，不发送任何网络请求。
- **更新是手动触发**：无启动自动检查、无后台轮询、无静默下载；未配置发布链路的构建不会显示假按钮。
- **WebDAV 是可选同步**，只连接你自己填写的服务器；「记住密码」时密码存 Windows Credential Manager（条目名 `com.blockhabit.app`，账号键为 sha256 派生值，不含邮箱 / URL 明文），配置与存档不落明文；关闭「记住密码」则不落盘并删除已有条目。
- **导出与完整档案包不含 WebDAV 凭据**。
- 仓库启用 GitHub CodeQL 静态扫描（见 `.github/workflows/codeql.yml`），不改变上述数据边界。

## 不要在本仓库提交密钥

- 更新签名私钥（`TAURI_SIGNING_PRIVATE_KEY` / 密码）只放 GitHub Actions secrets，**绝不进仓库**。
- WebDAV 密码、令牌、`.env` 文件、含个人数据的存档与截图同样不应提交到 issue、PR 或仓库历史。
- 构建产物（`dist/`、`src-tauri/target/`、`.tmp*/`）不要提交。
- 若发现密钥疑似泄露：立即轮换（GitHub Secret / minisign 密钥）并通过上文的私密渠道通知维护者；**不要在公开渠道贴出密钥本身**，即使它已失效。

---

感谢你帮助 BlockHabit 保持值得信任。
