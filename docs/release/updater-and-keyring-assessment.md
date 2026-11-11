# C4 评估：自动更新 / 签名 / keyring 可行性

- 日期：2026-11-11
- 评估者：b6-release-docs（task-5）
- 代码基线：`chore/release-prep`（HEAD 5bbcf1e，工作区含并发改动，见文末"评估时点"）
- 性质：**只读评估 + 分步方案**。本轮没有安装任何依赖、没有生成签名密钥、没有改存储格式、没有改 `src-tauri/`。
- 结论分级：**现在可做 / 需人类批准 / 暂不做**，见 §1。所有"未实施"项均如实标注，不写完成态。

---

## 1. 结论摘要

| 结论 | 事项 | 依据 |
| --- | --- | --- |
| **现在可做（零依赖、零网络）** | ① 版本号一致性校验（package.json / tauri.conf.json / Cargo.toml 三处必须相同）——**已实现**：`scripts/check-versions.mjs` + `npm run check:versions` + CI 门禁 + 6 例单测；② 把"检查更新"做成手动入口的 UI 设计记录——**D-20261111-069 已 approved，并已完成依赖/插件/UI 骨架（见 §1.5）**；③ 签名密钥生成演练（生成到仓库外，**不提交**）——仅文档步骤；④ 本评估文档与 C6 真机验收清单——已交付 | §3.4 / §3.5 |
| **需人类批准** | ① 新增依赖 `tauri-plugin-updater` + `tauri-plugin-process`（Rust + npm）；② 生成并保管 updater 签名密钥（丢失即永久失去对已安装用户的更新能力）；③ 发布端点（HTTPS 静态 JSON：对象存储 / CDN / GitHub Releases）与域名；④ CI release workflow 与 secrets；⑤ 是否允许"启动自动检查"（涉及唯一新增联网行为）；⑥ Windows Authenticode 代码签名证书预算（可选但强烈建议） | §3.2 / §3.3 / §3.6 |
| **暂不做** | ① 默认静默自动下载安装（违背本地优先的"主路径不强制联网"）；② 灰度/百分比发布、分桶；③ 自动降级（Tauri 默认只升不降）；④ 更新成功率遥测 | §3.3 / §3.6 |
| **keyring：现在可做** | 关闭"记住密码"时密码不落盘（`rememberPassword=false`，本轮并发改动已在工作区实现，非本任务产出） | §4.2 方案 A |
| **keyring：需人类批准** | OS keychain 方案（Windows Credential Manager）：新增 Rust 依赖（`keyring` crate 或社区 `tauri-plugin-keyring`），自定义 command 或插件权限；分步方案与迁移/回滚见 §4.4 | §4.3 / §4.4 |
| **keyring：暂不做** | Tauri 官方 Stronghold（需用户再记一个主密码，解决不了"记住密码"的体验目标，且体积/复杂度更高）；浏览器预览的 keychain（无此能力） | §4.3 |

**一句话结论**：自动更新在技术上完全可行，但当前仓库**没有 git remote、没有 release workflow、没有签名密钥、没有发布端点**，且按规则不能擅自加依赖——因此本轮只能给出方案与验收清单，落地需人类逐项批准。keyring 同理：先用"不落盘"缓解，OS keychain 等批准后再做，**不要在本轮直接改存储格式**。

---

## 1.5 实施状态（2026-11-11 C4 续作，D-20261111-069 approved 后）

> 本节是状态更新，不改变 §2–§5 的历史评估正文；未实施项继续如实标注，不写完成态。

### 1.5.1 已落地（代码骨架，可编译可测）

| 项 | 内容 | 位置 |
| --- | --- | --- |
| 依赖（前端） | `@tauri-apps/plugin-updater@2.14.1`、`@tauri-apps/plugin-process@2.4.0`；**未改** `package.json` 的 version | `package.json` / `package-lock.json` |
| 依赖（Rust） | `tauri-plugin-updater = "2"`（锁 2.14.1）、`tauri-plugin-process = "2"`（锁 2.4.0） | `src-tauri/Cargo.toml` / `Cargo.lock` |
| 插件注册 | `.plugin(tauri_plugin_updater::Builder::new().build())`、`.plugin(tauri_plugin_process::init())` | `src-tauri/src/lib.rs` |
| 权限 | `updater:default`（check/download/install/downloadAndInstall）、`process:default`（exit/restart） | `src-tauri/capabilities/default.json` |
| 配置占位 | `plugins.updater = { pubkey: "", endpoints: [], windows.installMode: "passive" }`。空值可用：updater 2.14.1 的 `Config` 反序列化接受空 `pubkey: String` / 空 `endpoints: Vec<Url>`，因此**不需要伪造占位公钥**。`bundle.createUpdaterArtifacts` **故意未开启**——没有签名私钥时开启会让构建失败，待人类提供密钥后再改 | `src-tauri/tauri.conf.json` |
| 前端适配层 | `isUpdaterEnabled()`（`VITE_UPDATER_ENABLED==='1'` 且 Tauri 运行时）、`checkForUpdate()` 四态判别联合、`installUpdate()`（进度回调 + 非 Windows relaunch）、`discardPendingUpdate()`；插件一律动态 `import()` | `src/platform/updater.ts` |
| UI | 设置 → 内容路线/关于 → 「版本与更新」行：idle/checking/latest/available/error；未启用时按钮禁用并显示诚实说明；取消只忽略迟到结果（插件无 abort API），不误报失败 | `src/components/AboutPanel.tsx`（i18n key 由 Lead 提供） |
| 测试 | `src/platform/updater.test.ts` 9 例：默认构建不 import 插件/不发请求、四态映射、安装进度、错误脱敏、句柄释放、未检查安装；`src/components/AboutPanel.test.tsx` 原 3 例 + 新增 6 例 | — |

**默认构建的网络纪律（已验证）**：不设置 `VITE_UPDATER_ENABLED` 时，`isUpdaterEnabled()` 恒为 false，`checkForUpdate()` 在 import 插件之前直接返回 `disabled`；浏览器预览同样禁用。只有显式设置 `VITE_UPDATER_ENABLED=1`、运行在 Tauri 内、且由用户点击「检查更新」，才会访问 `plugins.updater.endpoints`。

**门禁结果（2026-11-11）**：`npx tsc --noEmit` 0 错误；`npx vitest run src/components/AboutPanel.test.tsx src/platform/updater.test.ts` 全绿；`npm run tauri build -- --no-bundle` 实测结果见 §1.5.3。

### 1.5.2 仍 blocked（必须由人类提供，缺一不可）

1. **签名密钥生成与保管**（当前 `pubkey` 为空、`createUpdaterArtifacts` 未开启）：
   - 在**仓库外**的安全目录生成（示例 `<安全目录>/blockhabit.key`）：
     ```bash
     npx tauri signer generate -w <仓库外路径>/blockhabit.key
     ```
     命令会提示设置私钥密码并输出公钥；密码可留空但不建议。**不要把生成物放进仓库**。
   - 公钥全文（单行内容，**不是文件路径**）填入 `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`。
   - 私钥只通过 CI secrets `TAURI_SIGNING_PRIVATE_KEY`（内容或绝对路径）与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 注入；**绝不入库、不提交、不放 `.env`**（Tauri 不读 `.env`）。
   - 离线备份至少两份并明确责任人；私钥丢失 = 已安装用户永久失去更新通道（除非提前实现 runtime pubkey 轮换）。
2. **发布端点 URL**：HTTPS 静态 `latest.json` 的托管位置（对象存储 / CDN / GitHub Releases）与域名；确定后填入 `plugins.updater.endpoints`（支持 `{{target}}` / `{{arch}}` / `{{current_version}}`），生产强制 TLS。空数组时插件 `check()` 会报"无端点"，但默认构建的 UI 不会触发它。
3. **`latest.json` 托管与生成**：包含 `version` / `pub_date` / `notes` / `platforms["windows-x86_64"].{url,signature}`；签名值取自 `tauri build` 产出的 `.sig`；建议用 `tauri-apps/tauri-action` 自动生成并上传。
4. **CI release workflow 与 secrets**：仓库当前无 remote、无 tag、无 release workflow；需人类创建 remote / 托管位置、`release.yml`（手动触发）、secrets（签名私钥/密码）、发布权限。`bundle.createUpdaterArtifacts` 待密钥就绪后再改为 `true`；**发布构建还必须设置 `VITE_UPDATER_ENABLED=1`**（否则即使配好 pubkey/endpoints，前端仍按安全默认值禁用更新入口）。
5. **Windows Authenticode 代码签名证书**（可选但建议）：与 updater 的 minisign 签名是两件事；不做也能更新，但用户会看到 SmartScreen 警告。
6. **启用前必须补的代码项（当前有意未做）**：Windows 更新安装会以 `std::process::exit(0)` 退出应用，需在 Rust `on_before_exit` 里接现有退出握手（`app-quit-requested` + `QuitGate`，最多等 1.5s）保证存档落盘；并做真机验收（旧版本 → 检查 → 下载 → 安装 → 重启 → 版本变化；篡改 signature 必须拒绝；断网诚实报错）。发布端点接通前无法端到端验证，故本轮只保留骨架。
7. **是否允许"启动自动检查"**：仍默认否（手动入口），需人类显式决定。

### 1.5.3 验证记录

- `npx tsc --noEmit`：0 错误。
- `npx vitest run src/components/AboutPanel.test.tsx src/platform/updater.test.ts`：全绿（计数见 `.tmp-c4/report.md`）。
- `npm run tauri build -- --no-bundle`：**成功**（退出码 0；前端 `tsc && vite build` 通过，Rust release 编译 `Finished release profile [optimized] target(s) in 2m17s`，编译包含 `tauri-plugin-updater v2.14.1` 与 `tauri-plugin-process v2.4.0`，产出 `src-tauri/target/release/blockhabit.exe`）。原始日志 `.tmp-c4/tauri-build.log`。
- 四主题（light/dark/oat/fog）× zh/en 关于页截图（未配置发布链路 = disabled 诚实态）：`.tmp-c4/about-<theme>-<lang>.png`（8 张）。
- 启用态 / 检查失败态 UI 验证：用 `VITE_UPDATER_ENABLED=1` 的**临时前端构建** + 浏览器注入伪造 Tauri internals（仅验证 UI 状态机，不代表真实发布链路；真实端到端必须按 §3.7 在接好端点/密钥后真机验收）→ `.tmp-c4/about-enabled-harness-zh.png`、`about-error-harness-zh.png`、`about-error-harness-en.png`。
- 网络证据：preview 页面请求全部为 `localhost:1453` 静态资源，无任何外部发布端点/最新版本请求（`.tmp-c4/network-requests.txt`）；单测同时断言默认构建未 import updater 插件。
- 未生成签名密钥、未提交任何密钥材料、未伪造发布端点。

### 1.5.4 keyring 状态（只做设计 + 迁移方案，方向已批准、实施 pending）

人类已批准**方向**（用 OS keychain 替代明文 localStorage 密码），但按分阶段落地：

- **本轮不改**：不接 `keyring` crate / 社区插件、不加 npm 依赖、不改存储格式（不新增 `credentialStore` 字段）、不改 `useSync` 读写路径。
- **现有可用缓解**：`rememberPassword=false`（方案 A）不落盘；由并发改动实现（非本轮产出）。
- **待人类批准后才做**：方案 B（Rust `keyring` crate + 自定义 command + `src/platform/credentials.ts`）与迁移/回滚，步骤见 §4.4；批准前保持 localStorage 明文默认行为（本机、无账号）。
- 结论：**方向 approved、实施 pending**；§4.4 的阶段 0–6 不得当作已完成。

---

## 2. 现状事实（读代码确认，2026-11-11）

### 2.1 版本与构建

| 事实 | 位置 |
| --- | --- |
| 版本 `0.2.0`，三处一致 | `package.json:4`、`src-tauri/tauri.conf.json:4`、`src-tauri/Cargo.toml:3` |
| Tauri 2.12.1 / CLI 2.11.4 / Rust 1.99.1（满足 updater 插件 ≥1.90 的要求） | `src-tauri/Cargo.lock`、`npx tauri --version`、`rustc --version` |
| **没有 updater 插件**：Rust 依赖无 `tauri-plugin-updater`，`lib.rs` 未注册，`tauri.conf.json` 无 `plugins` / `createUpdaterArtifacts`，capabilities 无 `updater:default` | `src-tauri/Cargo.toml:20-31`、`src-tauri/src/lib.rs:82-97`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json` |
| 没有 `@tauri-apps/plugin-updater` / `plugin-process` npm 包 | `package.json:38-55` |
| **没有 git remote、没有 tag、没有 release workflow**；CI 只做 typecheck/test/design:check，明确"不产出安装包" | `git remote -v` 为空；`.github/workflows/ci.yml:7` |
| README 如实写明"没有自动更新：安装包需手动下载覆盖安装" | `README.md:34` |
| D-048 的 F6 决议为"暂不接入"，理由是"无代码签名证书时接 updater 无法安全验证" | `design/records/D-20261110-048-decisions-and-f4-http.md` §决议表第 5 行 |

> **口径修正（重要）**：D-048 把"updater 签名"与"Windows 代码签名"混为一谈。Tauri updater **强制**校验的是它自己的 minisign 密钥对（自签名，不需要 CA）；Windows Authenticode 代码签名是另一件事，只影响 SmartScreen/微软商店。**没有代码签名证书也可以启用 updater**，只是用户下载安装包时可能看到 SmartScreen 警告。详见 §3.2。

### 2.2 WebDAV 密码当前持久化位置（keyring 评估前提）

> 行号以**评估时点（2026-11-11）**为准：B3 正在把设置页拆到 `WebdavPanel.tsx`，B1 正在改 `useSync.ts`；最终以 Lead 提交后的代码为准。

| 事实 | 位置 |
| --- | --- |
| WebDAV 配置（含明文密码）以 JSON 存 `localStorage` 的 `blockhabit_webdav_config` 键 | `src/sync/useSync.ts:10,39-59`（评估时点；B1 后 load/save 含 `persistableWebDavConfig`，行号可能微移） |
| 配置类型 `WebDavConfig.password: string`（B1 后同文件含 `rememberPassword`） | `src/sync/types.ts:3-17`（评估时点） |
| 设置页密码输入框（`type="password"`） | `src/components/WebdavPanel.tsx:312-326`（B3 拆分后；评估时点在 `SettingsDialog.tsx:1015-1022`） |
| 桌面端 WebView2 的 localStorage 持久化在应用数据目录（每用户可读，**非 OS keychain、非加密**）；浏览器预览同样是 localStorage | `src/sync/useSync.ts` 注释 + 平台事实 |
| 配置防抖落盘（800ms），仅减少落盘频次，不改变明文性质 | `src/sync/useSync.ts:96-…`（评估时点） |
| 并发改动（工作区未提交，B1）：新增 `rememberPassword`（默认 true）；关闭时密码只留内存、localStorage 不含密码 | `src/sync/types.ts:16,28`、`src/sync/useSync.ts:34-38,56`、`src/sync/webdavConfig.test.ts`（新） |
| 档案包/导出有第二道凭据断言，密码不会进导出物 | `src/storage/archive.ts:349-358`（评估时点） |
| 服务商预设本身不存密码副本（只存 id/base/username），但**完整 WebDAV 配置对象会含密码** | `src/sync/providers.ts:6-10` |

**结论**：当前默认行为是"密码明文落盘到 localStorage"。这不算漏洞（本机、无账号），但也不是"安全存储"；OS keychain 需要新依赖（见 §4）。

### 2.3 评估时点说明

评估时工作区有并发改动（`rememberPassword`、诊断取消、AboutPanel 等未提交）。本评估以"当前工作区 + HEAD 提交"为准，涉及并发改动的结论均标注；不把未提交改动当作已完成交付。

---

## 3. 自动更新（Tauri 2 updater）可行性

### 3.1 机制（依据官方文档）

- 插件：Rust `tauri-plugin-updater` + 前端 `@tauri-apps/plugin-updater`；可选 `@tauri-apps/plugin-process`（`relaunch()`）或 Rust 侧 `app.restart()`。
- **签名不可关闭**：更新包必须带签名，应用内置公钥验证；私钥丢失 = 已安装用户永远收不到新版本。公钥放 `tauri.conf.json` 的 `plugins.updater.pubkey`（必须是内容，不能是文件路径）。
- 构建：`bundle.createUpdaterArtifacts: true`；Windows 生成 NSIS/MSI 安装包 + 对应 `.sig`；签名私钥通过环境变量 `TAURI_SIGNING_PRIVATE_KEY`（可加 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）注入，**`.env` 文件不生效**。
- 发布端点二选一：
  - **静态 JSON**（推荐先做）：一个 HTTPS 文件，含 `version` / `notes` / `pub_date` / `platforms["windows-x86_64"].{url,signature}`；Tauri 会校验整个文件；可放对象存储 / CDN / GitHub Releases（`tauri-action` 可自动生成）。
  - **动态服务器**：无更新返回 `204`；有更新返回 `200` + `{version,url,signature,...}`。
- endpoint 支持 `{{current_version}}` / `{{target}}` / `{{arch}}` 变量；生产强制 TLS；非 2XX 才尝试下一个 endpoint。
- Windows 安装模式 `installMode`：`passive`（默认，小进度窗，无需交互）/ `basicUi` / `quiet`；Windows 上安装前应用会被自动退出（Rust 可挂 `on_before_exit`）。
- 权限：capabilities 需加 `updater:default`。
- 降级：默认只接受更高版本；允许降级需要 Rust 侧 `version_comparator`（前端 API 不提供）。
- 官方文档：<https://v2.tauri.app/plugin/updater/>；Rust API：<https://docs.rs/tauri-plugin-updater>；Tauri Action：<https://github.com/tauri-apps/tauri-action>。

### 3.2 依赖与改动面（若批准）

| 项 | 改动 | 备注 |
| --- | --- | --- |
| Rust | `tauri-plugin-updater = "2"`、`tauri-plugin-process = "2"`（若要 `relaunch`） | 新 crate；需与 `tauri` 同 major.minor（D-048 已踩过版本对齐坑） |
| npm | `@tauri-apps/plugin-updater`、`@tauri-apps/plugin-process` | 新依赖，按 AGENTS §4 需人类批准 |
| 配置 | `tauri.conf.json`：`bundle.createUpdaterArtifacts: true`、`plugins.updater.{pubkey,endpoints,windows.installMode}` | pubkey 入库；endpoint 入库 |
| 权限 | `capabilities/default.json`：`updater:default` | 最小权限，仅 main 窗口 |
| 前端 | 设置页"检查更新"入口 + 状态/进度/错误文案（i18n 由 Lead 加 key）；启动自动检查默认关 | 用户可见改动 → 需设计记录 + 人类批准 |
| 发布 | `.github/workflows/release.yml`（手动触发）+ secrets：签名私钥/密码；产物上传 + latest.json | 当前无 remote，见 §3.3 |

### 3.3 发布流程、回滚与灰度限制

**建议的发布流水线（需人类批准 + 有 remote 后才可执行）**：

1. 一次性：`npm run tauri signer generate -- -w <仓库外路径>/blockhabit.key` 生成密钥对；公钥写进 `tauri.conf.json`；私钥与密码存 CI secrets（并离线备份，**绝不入库**）。
2. 发布：手动触发 workflow → `npm ci` → `npx tsc --noEmit` / `npm test` / `npm run design:check` → `npm run tauri build`（注入签名环境变量）→ 产物 `*-setup.exe` / `.msi` + `.sig` → 生成 `latest.json`（version/pub_date/notes/platforms）→ 上传到发布端点。
3. 验证：在**旧版本**安装包上点检查更新 → 下载 → 安装 → 重启 → 版本号变化；校验签名失败场景（篡改 latest.json）必须被拒绝。
4. 回滚：Tauri 默认不支持降级；坏版本只能发**更高版本**修复。真正的降级需要 Rust `version_comparator`（需人类决定是否开启，且会破坏语义化版本直觉）。数据层回滚依赖 `schemaVersion`/`contentVersion` 门禁（现有兼容矩阵测试已覆盖"旧客户端读新档 → needsUpgrade、不落盘"）。

**限制（必须如实告知用户/人类）**：

- **无灰度/分桶**：静态 JSON 是全局广播；动态服务器理论上可按 IP/UA 分桶，但那是服务端跟踪，和"无遥测"原则冲突。渠道只能靠"不同构建内置不同 endpoint"（stable/beta），发布前就要定。
- **检查失败要诚实**：网络不可达/签名不匹配时不能显示"已是最新"，只能显示"检查失败（原因）"。这与 A6 数据诚实一致。
- **Windows 安装即退出**：需要复用现有退出握手（`src-tauri/src/lib.rs:58-79` 的 flush gate），在 `on_before_exit`/安装前确保存档已落盘，避免丢最近一次打卡。
- **私钥不可轮换**：除非提前在 Rust 里做 runtime pubkey 切换逻辑（复杂），否则私钥丢失 = 更新通道永久中断；必须离线备份。
- **CI 现状**：仓库无 remote、无 release workflow、无 tag；`.github/workflows/ci.yml` 只验证不产物。发布流水线属于新增基础设施，需要人类决定托管位置（GitHub Releases / 对象存储 / 自建）。

### 3.4 Windows 代码签名（可选，但建议）

- 作用：避免 SmartScreen"未知发布者"警告；微软商店上架必需。**与 updater 签名无关**，不做也能用 updater。
- 现状：仓库无证书、无签名配置；D-048 把"无代码签名证书"当作不接 updater 的理由，本轮修正为"可以先接 updater，代码签名另算预算"。
- 选项（据 Tauri 官方 Windows 签名文档）：OV 证书（较便宜，个人可申请）/ EV 证书（2024 年后不再享受 SmartScreen 即时信誉优待）/ Azure Key Vault / Azure Artifact Signing / 自定义 sign command。价格与证书类型需人类决策。
- 文档：<https://v2.tauri.app/distribute/sign/windows/>

### 3.5 与"本地优先 / 无账号 / 无遥测"原则的相容性

| 原则 | 影响 | 建议 |
| --- | --- | --- |
| A7 本地优先：主路径不得强制联网 | 自动更新检查是**新增联网行为**；若启动即检查，等于主路径依赖网络 | 默认**手动检查**（设置页按钮）；自动检查作为显式开关，默认关 |
| 无账号 | updater 不需要账号，天然相容 | 不引入账号 |
| 无遥测 | 检查更新请求本身会带版本/平台/架构；服务器会看到 IP；若做成功率统计就是遥测 | 不采集、不上报任何使用数据；README 披露"检查更新会请求发布端点，服务器可能记录常规访问日志"；不做灰度统计 |
| 离线可用 | 更新失败不得影响应用启动/使用 | 检查更新异步、失败静默降级为提示；绝不阻塞主流程 |

### 3.6 现在可做 / 需批准 / 暂不做（自动更新）

**现在可做（2026-11-11 续作状态）**
- 版本号一致性检查：**已实现** `scripts/check-versions.mjs`（解析 package.json / tauri.conf.json / Cargo.toml 的 [package].version；`--json` 可用），`npm run check:versions` 已接入 CI；`scripts/check-versions.test.mjs` 6 例覆盖一致/不一致/缺失/解析边界。
- 手动"检查更新"入口：**D-20261111-069 已 approved**；本轮已交付依赖/插件/UI/适配层骨架与测试（见 §1.5.1），未配置发布链路时默认构建诚实禁用、不发请求；签名密钥/端点/`latest.json`/CI secrets/Windows 代码签名仍 blocked（§1.5.2）。
- 签名密钥生成演练：仅文档步骤（§3.2），未生成密钥、未提交任何密钥材料。
- 签名密钥生成演练（本机生成到仓库外，验证流程；**不生成正式密钥、不提交**）。
- C6 真机验收清单中的更新验收项（见 `docs/release/real-device-acceptance.md`）。

**需人类批准 / 人类提供（blocked；依赖与 UI 方向已于 2026-11-11 获批）**
- [x] 新增 `tauri-plugin-updater` + `tauri-plugin-process`（Rust + npm）——人类已批准，本轮已落地（§1.5.1）。
- [ ] 生成正式签名密钥对并确定保管/备份责任人（丢失即断更）——**仍 blocked**，步骤见 §1.5.2 第 1 条。
- [ ] 发布端点：HTTPS 静态 JSON 的托管位置（对象存储/CDN/GitHub Releases）与域名——**仍 blocked**。
- [ ] CI release workflow 与 secrets 管理；仓库 remote/发布权限——**仍 blocked**。
- [ ] 是否允许启动自动检查（默认建议关）——**仍 blocked**。
- [ ] Windows Authenticode 证书预算与类型（可选）——**仍 blocked**。
- [x] 设置页"检查更新"UI 的设计记录与 i18n key（Lead 独占写入）——D-20261111-069 已 approved、key 已加、UI 已实现（§1.5.1）。

**暂不做**
- 默认静默自动下载安装；灰度/百分比发布；自动降级；更新成功率遥测。

### 3.7 验收步骤（批准后执行）

1. `npx tauri signer generate` 生成密钥；公钥入库，私钥只进 secrets；`npm run tauri build` 产出 `*-setup.exe.sig`。
2. 把 `latest.json` 放到 HTTPS 端点（先用测试 bucket）；旧版本安装包安装后点"检查更新"。
3. 期望：发现新版本 → 显示版本/说明 → 下载进度 → 安装（passive）→ 应用退出并重启 → 版本号更新。
4. 负例：篡改 `latest.json` 的 signature → 必须拒绝并提示校验失败；断网 → 诚实提示；endpoint 404 → 按文档尝试下一个 endpoint。
5. 数据安全：更新前有未落盘打卡 → 退出握手保证落盘；更新后数据/设置/WebDAV 配置不丢。
6. 隐私：抓包确认请求只含版本/平台/架构，无用户标识；README 已披露网络行为。
7. 回滚演练：用更高版本"修复版本"覆盖坏版本；确认不会自动降级。

---

## 4. keyring（OS 安全存储）可行性

### 4.1 目标与边界

- 目标：WebDAV 密码不再以明文落盘，同时保留"重开应用仍能自动同步"的体验。
- 边界：**本轮不改存储格式、不加依赖**；OS keychain 方案必须由人类批准依赖后实施；浏览器预览无 keychain 能力，需保持现有 localStorage 降级路径。
- 平台：产品正式目标仅 Windows（README §平台范围），Linux/macOS 不作为验收目标。

### 4.2 可选方案对比

| 方案 | 依赖 | 体验 | 安全 | 结论 |
| --- | --- | --- | --- | --- |
| **A. 不落盘**（`rememberPassword=false`） | 无 | 每次启动需重输密码才能同步 | 磁盘无密码；内存中有 | **现在可做**（工作区并发改动已实现，需 Lead 确认并入发布） |
| **B. Rust `keyring` crate + 自定义 command** | +1 Rust crate（`keyring` v3/v4，Windows 走 Credential Manager） | 重开自动同步 | 交给 OS 凭据管理器；同用户进程仍可读 | **推荐下一轮**，需批准 |
| C. 社区 `tauri-plugin-keyring` | +1 crate + 1 npm 包 + 权限 | 同上 | 同上（第三方维护，需供应链审查） | 备选，需批准 |
| D. 官方 `tauri-plugin-stronghold` | +crate/npm | 需再记一个主密码；体积大 | 加密保险库 | **否决**：解决不了"少记一个密码"的目标 |
| E. 维持现状（明文 localStorage） | 无 | 最顺 | 本机明文 | 作为 A 的回退路径保留 |

依据：Tauri 官方插件目录没有 keyring 插件（截至本次评估）；Rust `keyring` crate 提供 Windows Credential Manager/macOS Keychain/Linux Secret Service 后端（<https://docs.rs/keyring>）；社区插件 <https://github.com/charlesportwoodii/tauri-plugin-keyring> 封装了 keyring-core，并提供 `setPassword/getPassword/deletePassword/hasPassword` 与对应权限。第三方插件需评估维护状态与供应链风险，不能默认信任。

### 4.3 推荐路线

1. **立即（本轮发布可带）**：方案 A —— 设置页"记住密码"开关，默认 true 兼容旧配置；关闭后密码不写 localStorage，重开需重输。这是**无依赖的隐私缓解**，不改变"默认记住"的现有行为。
2. **下一轮（需人类批准）**：方案 B —— 新增 Rust `keyring` crate，自定义 Tauri command（`credentials_get/set/delete/available`），前端通过 `src/platform/credentials.ts` 抽象调用；仅 Windows 实现，其它平台返回不可用并回退方案 A。
3. 若人类更倾向社区插件（C），则按插件文档加 `keyring:allow-*` 权限与 npm API 包；供应链审查与版本锁定要求更高。

### 4.4 分步实施方案（方案 B，需批准后执行）

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| 0 | 人类批准依赖 + 设计记录（设置页文案/开关语义）；确定 service 名（如 `com.blockhabit.app`）与 account 规则（如 `sha256(endpoint + '\n' + username)` 的十六进制，避免把用户名/地址明文写进凭据管理器） | 记录 approved、依赖批准记录 |
| 1 | `src/platform/credentials.ts`：`isAvailable() / get(account) / set(account, secret) / remove(account)`；Tauri 走 `invoke`，浏览器返回不可用 | 单测 mock invoke 覆盖成功/失败/不可用 |
| 2 | Rust 命令：`keyring::Entry::new(service, account)` 的 get/set/delete；错误映射为稳定错误码；不打印密码 | `cargo check` + Rust 单测（可用内存后端） |
| 3 | `useSync` 迁移：`loadWebDavConfig` 先读 localStorage；若 `password` 非空且 keyring 可用 → 尝试写入 keychain → 成功后把 localStorage 中 `password` 置空并写 `credentialStore: 'os'` 标记（**该字段属于新增存储格式，须批准**）；读取时 `credentialStore==='os'` 则从 keychain 取密码，取不到则提示重输（不阻塞启动）。`saveWebDavConfig` 对称处理 | 迁移/回滚单测：旧明文迁移、keychain 失败保留旧行为、重开恢复、密码不落盘 |
| 4 | 设置页文案与状态（"密码由 Windows 凭据管理器保存" / "无法访问凭据管理器，密码仅本次运行有效"）；i18n key 由 Lead 独占添加 | 浏览器手测 + 真机 C6 |
| 5 | 真机验收（C6）：保存→检查 localStorage 无明文→重启自动同步→删除凭据后提示→卸载残留检查 | 见 C6 清单 |
| 6 | 发布策略：至少保留一个版本"双读回退"（先 keychain 后 legacy localStorage），确认无回归后再删除 legacy 明文读取路径 | 一个发布周期观察 |

**迁移/回滚方案**

- 迁移：只在"读到明文密码 + keyring 可用"时自动搬移；搬移成功即清空 localStorage 密码。失败则保持原样（不破坏可用性），下次启动重试。
- 回滚：旧版本应用只读 localStorage——若迁移已清空密码，用户需重输一次（数据不丢，只丢便利性）；若担心体验，可让旧版本继续读取 legacy 字段一个周期（需权衡"明文残留"与"回滚可用"）。**推荐隐私优先：迁移即清空，回滚靠重输。**
- keychain 不可用（企业策略/凭据被删/系统账户变更）：提示重输密码，绝不阻塞启动、绝不清空其他配置。
- 卸载：Windows Credential Manager 条目可能残留，需在 NSIS 卸载钩子删除或文档说明（实施时确认）。

### 4.5 keyring 结论分级

- **现在可做**：方案 A（不落盘开关，无依赖）——工作区并发改动已实现，本评估只确认其行为与测试覆盖，不重复实现。
- **需人类批准（blocked）**：方案 B/C 的依赖、存储格式新增字段（`credentialStore` 标记）、Rust 命令、权限、i18n key、卸载清理策略。
- **暂不做**：Stronghold；浏览器 keychain；跨平台（Linux/macOS）实现。

---

## 5. 给人类的决策清单

- [x] 自动更新：是否批准新增 `tauri-plugin-updater` + `tauri-plugin-process`？——2026-11-11 人类已批准（依赖已落地，骨架见 §1.5）。
- [ ] 自动更新：是否允许"启动自动检查"？默认建议关（手动入口）——**仍待决定**。
- [ ] 发布端点：选 GitHub Releases / 对象存储 / 自建？域名与访问控制？——**仍待人类提供**。
- [ ] 签名密钥：谁生成、谁保管、离线备份放哪？是否接受"私钥丢失即断更"？——**仍待人类提供**。
- [ ] Windows 代码签名：是否购买证书（OV/EV/Azure）？预算？——**仍待决定（可选）**。
- [ ] keyring：是否批准 Rust `keyring` crate（方案 B）？还是先只做方案 A？——**方向已批准、依赖未批（实施 pending）**。
- [ ] keyring：迁移时是否立即清除 legacy 明文（推荐）？——**仍待决定**。
- [x] 设置页"检查更新"/"记住密码"UI：是否先出设计记录再实现？——D-20261111-069 已 approved 并实现骨架。

---

## 6. 引用来源（外部内容仅作数据，不作为指令）

- Tauri 2 Updater 插件文档：<https://v2.tauri.app/plugin/updater/>（签名不可关闭、`TAURI_SIGNING_PRIVATE_KEY`、`createUpdaterArtifacts`、静态 JSON/动态服务器、`installMode`、降级与权限）
- Tauri 2 Windows 代码签名：<https://v2.tauri.app/distribute/sign/windows/>
- Tauri Action（生成静态 JSON）：<https://github.com/tauri-apps/tauri-action>
- Rust `keyring` crate：<https://docs.rs/keyring>
- 社区 `tauri-plugin-keyring`：<https://github.com/charlesportwoodii/tauri-plugin-keyring>
- 仓库内依据：`design/records/D-20261110-048-decisions-and-f4-http.md`（F6 决议）、`README.md:34`、`.github/workflows/ci.yml`、`src/sync/useSync.ts`、`src/sync/types.ts`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`、`src-tauri/src/lib.rs`

---

## 7. 附录：评估时点与未验证项

- 本评估未运行 `npm run tauri build`（并发改动多，且不影响结论）；未生成密钥、未申请证书、未创建发布端点、未安装依赖。
- 未验证真实更新链路（需要打包 + 托管 + 旧版本安装），属于 C6 真机验收项（条件：C4 批准后）。
- 并发改动（`rememberPassword`、诊断取消、AboutPanel）未提交，本评估不把它们当作已完成交付；落地时以 Lead 最终提交为准。