---
id: D-20261110-005
date: 2026-11-10
title: 三路审计之三：产品与工程运营（22 条，含 1 条 P0、6 条 P1）
status: approved
owner: audit-product
surface: []
axioms: [A6, A7]
files: [design/records/D-20261110-005-audit-product.md]
supersedes: []
reviewer: LeeCM
---

> **本文件为设计记录 D-20261110-005**（审计类记录，结论并入 `D-20261110-006` 优化方案）。全文只读。
# BlockHabit 产品与工程运营审计报告
> 审计范围：README.md / src/**（pages、store、sync、logic、components、storage、render、platform、i18n）/ src-tauri/**（tauri.conf.json、Cargo.toml、lib.rs、capabilities）/ docs/superpowers/** / design/**（只读） / 构建产物 dist 与 src-tauri/target/release/bundle
> 审计方式：静态走查（read/grep）+ 源码复算（按 generators.ts 逻辑重算 12 座蓝图块数，未改源码）+ `npx tsc --noEmit`（0 错误）+ `npm test`（357/358，唯一失败为并行施工中的设计台账守门，见文末待验证）+ 构建产物体积核对
> 日期：2026-11-10
> 说明：本报告只读审计，未修改任何源码/配置/依赖；报告中「已验证」= 有文件行号证据；不确定项一律下沉到文末「待验证」。

## 总览表

| 编号 | 标题 | 严重度 | 类型 | 影响面 | 预估工作量 |
|---|---|---|---|---|---|
| C1 | 存档校验不校验蓝图 ID，未知 ID 触发 `getBlueprint` 抛错 → 白屏且被持久化（crash loop） | P0 | 工程 | 启动/导入/同步/核心回路 | S |
| C2 | 无 ErrorBoundary、无全局错误捕获、无崩溃日志（历史白屏 P0 的复发面） | P1 | 工程 | 全局稳定性 | S |
| C3 | WebDAV 同步走 WebView `fetch`，CORS 限制未解，多设备同步大概率不可用 | P1 | 工程/产品 | 同步、多端留存 | M |
| C4 | README 承诺的「连击每满 7 天 → 点缀色 bonus 积木」从未生效（返回值无消费点） | P1 | 产品/文档 | 核心奖励回路、信任 | S（先改文档）/M（真做） |
| C5 | 无自动更新、无安装包签名、无更新通道 | P1 | 工程 | 发布交付、版本安全 | M |
| P1 | 数据主权缺口：仅手动导出，无自动备份/无恢复入口/无「打开数据目录」 | P1 | 产品 | 换机/重装留存、数据安全 | S~M |
| P2 | 内容供给断层：12 座共 1385 块，全落成后无 endgame 表达（「190 天」是块数不是天数） | P1 | 产品 | 长期留存 | S（表达）/M（新内容） |
| C6 | 统计页无全局总量指标；全局热图色阶是死代码，README「绿色色阶」失实 | P2 | 工程/产品 | 「为什么坚持」的表达 | S~M |
| C7 | 全勤块恒 `bonus:true`，稀释琥珀稀缺性；`checkInDay` 的连击奖励返回值无 UI | P2 | 产品/体验 | 奖励语义、视觉纪律 | S~M |
| C8 | 功能蔓延：19 个设置控件 / 14 字段习惯表单；幽灵设置 0 个，但 1 个不可达枚举 + 1 个平台错配 | P2 | 产品 | 定位漂移、新手成本 | S（折叠）/M（重构） |
| U1 | 首次使用路径：新建习惯首屏即 3 类形态 + 多字段；首块落块弹窗 3.6s 自动关、无「积木去哪了」解释 | P2 | 体验 | 首日留存 | S~M |
| U2 | 信息架构：实际 4 页 tab + 9 个弹窗，README/设计文档仍写三页；展台空态无入口 | P2 | 体验/文档 | 导航成本 | S |
| U3 | 提醒链路只在进程存活时生效；autostart 默认关且无首启提示 → 提醒承诺半失效 | P2 | 产品/体验 | 核心差异化 | S |
| U4 | 修复砖总供给 12 块（每座 +1，库存上限 2，窗口 7 天），断签兜底形同虚设 | P2 | 产品 | 「回不来了」问题 | S |
| C9 | 无 CI（无 `.github`），358 个测试与设计台账全靠人肉跑 | P2 | 工程/协作 | 交付质量 | S |
| C10 | 超大文件债务：iso.ts 911 / BuildScene 853 / ShowcaseScene 764 / HabitRow 725 行，超 AGENTS 800 行约定 | P2 | 工程 | 可维护性 | L |
| C11 | 4 个未使用字体依赖；dist 429 文件/9.8MB；安装包 11.47/12.54MB | P2 | 工程/发布 | 体积、依赖卫生 | S |
| C13 | README 逐条核对：9 条宣称 = 真 4 / 部分 5 / 假 0；细分 17 个子claim = 真 12 / 部分 3 / 假 2 | P2 | 文档 | 新人信任、对外表达 | S |
| C14 | 无产品度量（无埋点/崩溃上报，符合本地优先）但也没有本地方案 | P3 | 工程/产品 | 决策依据 | S |
| P3 | 商业模式缺位：无任何 monetization 钩子（判断：现在不做付费） | P3 | 产品 | 可持续性 | — |
| U6 | 「唯一点缀色琥珀」纪律与实现冲突：oat/fog 主题 accent 分别为赤陶/蓝 | P3 | 设计治理 | 品牌一致性 | S（决策）/S（改） |
| P4 | 移动端半成品：mobile.css/detect/图标/设计文档齐备，但无移动构建目标 | P3 | 产品定位 | 定位漂移 | S（明确取舍） |

> 统计：P0 × 1；P1 × 6；P2 × 11；P3 × 4；合计 22 条（另 5 项待验证，不计入条目）。

---

### C1 存档校验不校验蓝图 ID，未知 ID 触发 getBlueprint 抛错 → 白屏且被持久化
- **现象与证据**：
  - `src/storage/adapter.ts:127-128` 严格校验只要求字段类型：`if (typeof v.activeBlueprintId !== 'string' || !v.activeBlueprintId) return { ok:false }`、`if (!Array.isArray(v.completedBlueprintIds)) ...`，不校验 ID 是否属于 12 座蓝图；`builds` 元素校验（62-71 行）同样不校验 `blueprintId`。
  - `src/logic/blueprints/index.ts:60-63`：`export function getBlueprint(id){ const bp = blueprints[id]; if (!bp) throw new Error('unknown blueprint: ' + id); return bp }`。
  - `src/App.tsx:232` 每次渲染都执行 `const bp = getBlueprint(activeBlueprintId)`；`src/pages/Today.tsx:61`、`src/pages/Build.tsx:17` 同路径。
  - 导入链路：`SettingsDialog.tsx:115-130` `validateState` 通过 → `confirmImport()`(`:132-146`) → `importData()`(`appStore.ts:587-599`) `set()` + `requestFlushNow()` → 立即落盘；下次启动 `initPersistence` 读回同一坏档（`appStore.ts:605-629`）。
  - 同一问题也存在于 WebDAV 合并：`useSync.ts:77-79` 只用 `prepareImport`，之后 `importData` 落盘。
- **根因**：数据校验只校验结构不校验引用完整性（蓝图 ID 白名单），而渲染入口用「抛异常」的 `getBlueprint`。
- **影响**：用户导入/同步一个 `activeBlueprintId:"spaceship"`（或未来版本档、手改档）即白屏；由于坏档已被持久化，重启仍白屏，形成 crash loop，且本地无导出入口（设置页打不开）。这是唯一一条可稳定复现的「数据损坏 → 不可用」路径。
- **方案**：
  1. `adapter.ts` 增加白名单校验（导入/同步严格路径）：`const BP_IDS = new Set(blueprintOrder)`；`validateState` 第 127-128 行改为 `blueprintOrder.includes(v.activeBlueprintId)` 且 `completedBlueprintIds.every(id => BP_IDS.has(id))`；`isValidBlockElement` 增 `BP_IDS.has(b.blueprintId)`。
  2. `sanitizeState`（本地加载兜底）改为「剔除未知引用」：`activeBlueprintId = BP_IDS.has(id) ? id : 'plant'`，`builds` 丢弃未知 blueprintId，`completedBlueprintIds` 过滤未知项。
  3. `getBlueprint` 增加 `fallback` 参数或返回 `blueprints.plant`（至少渲染层不再抛）；`App.tsx:232` 用安全取值。
  4. merge 后统一走 `sanitizeState` 再 `importData`（`sync/merge.ts` 出口加一步）。
- **验收**：新增 vitest：`adapter.test.ts › rejects unknown activeBlueprintId`（validateState 返回 !ok）、`› sanitize falls back to plant for unknown ids`；手测：把 `%APPDATA%/com.blockhabit.app/blockhabit.json` 的 `activeBlueprintId` 改成 `spaceship` 后启动 → 应用进入 plant 蓝图并正常渲染。
- **工作量**：S
- **依赖**：与 C2 同批实施（C2 兜底、C1 治本）。

### C2 无 ErrorBoundary、无全局错误捕获、无崩溃日志
- **现象与证据**：`grep "ErrorBoundary|onerror|unhandledrejection|reportError" src/` = 0 命中；`src/main.tsx:41-43` 直接 `ReactDOM.createRoot(...).render(<App/>)`，无任何兜底；`App.tsx:400-496` 的单棵组件树任一渲染异常即整树卸载。上一轮 2026-10-03 已发生过同类 P0：`docs/superpowers/specs/2026-10-03-blockhabit-ux-review-fixes.md:13`「建造页与打卡落块弹窗整树卸载白屏」。
- **根因**：只有「修具体异常」没有「异常隔离 + 取证」。
- **影响**：任何一次渲染异常（如 C1、未来的坏数据、Canvas 环境差异）用户看到纯白窗口，无法自愈、无法导出数据、无日志可反馈，只能删存档。
- **方案**：
  1. `src/components/AppErrorBoundary.tsx`（class 组件）包住 `<App/>`；fallback 提供「重新加载 / 导出存档 / 复制错误信息」三个按钮（导出复用 `useAppStore.getState().exportData()`）。
  2. `main.tsx` 注册 `window.addEventListener('error')`、`('unhandledrejection')`，写入 `appDataDir/error-log.json`（保留最近 20 条，含 message/stack/时间/版本），失败静默。
  3. 设置页「关于」增加「导出诊断信息」按钮（本地打包 JSON，不上传，符合 AGENTS 第 3 条本地优先）。
- **验收**：vitest：`AppErrorBoundary.test.tsx › renders fallback when child throws`；手测：在 dev 控制台抛 `throw new Error('x')` 于渲染期 → 出现兜底页且能导出 JSON。
- **工作量**：S
- **依赖**：与 C1 同批。

### C3 WebDAV 同步走 WebView fetch，CORS 限制未解 → 多设备同步大概率不可用
- **现象与证据**：
  - `src/sync/webdav.ts:99-106`、`:130-137`、`:178-183` 全部使用浏览器 `fetch`（GET/PROPFIND/PUT）。
  - `src-tauri/src/lib.rs:96` 只注册 `update_tray, tray_menu, confirm_quit` 三个命令，无任何 Rust HTTP 命令；`Cargo.toml:20-29` 也无 reqwest/tauri-plugin-http。
  - `docs/superpowers/specs/2026-09-30-blockhabit-optimization-design.md:148`「WebDAV CORS：fetch 走 WebView 的本质限制仍在（批次三 Rust HTTP 解决）」——该批次三中的 Rust HTTP 未落地，现状只做了条件写/错误码。
  - README.md:13 对外宣称「WebDAV 同步：多设备合并…支持自动同步与手动立即同步」。
- **根因**：同步网络层留在 WebView，跨域受浏览器同源策略约束；标准 WebDAV 服务（Nextcloud/坚果云/群晖默认配置）通常不返回 `Access-Control-Allow-Origin`。
- **影响**：桌面端填好地址后同步稳定报 `network` 错误（`SettingsDialog.tsx:68-81` 映射为统一网络错误文案），用户无法区分「服务器不支持 CORS」与「密码错」；多端留存承诺落空，且失败无指引。
- **方案**：
  1. 新增 Rust 命令 `dav_request(method, url, headers, body) -> (status, headers, body)`（`reqwest` blocking 或 async + `tauri::async_runtime`），前端 `webdav.ts` 的 `fetch` 改为 `invoke('dav_request')` 包装；Basic 认证在 Rust 侧拼接，密码不进 WebView 网络栈。
  2. 保留浏览器回退（`inTauri === false` 时才用 `fetch`），供 `webdav.e2e.test.ts` 与浏览器调试。
  3. 错误码补充 `cors`/`tls` 两类提示文案，引导「换用支持跨域的服务或使用桌面代理」。
- **验收**：本地 `docker run nknika/nginx-dav` 起服务（默认无 CORS 头）→ 桌面端 `syncNow()` 成功；单测 mock `invoke` 覆盖 GET/PUT/412/409 分支；`cargo check` 通过。
- **工作量**：M
- **依赖**：无；建议与 P1（备份）同批做「数据安全批次」。

### C4 README 的「连击每满 7 天 → 点缀色 bonus 积木」从未生效
- **现象与证据**：
  - `src/store/appStore.ts:467` 只有全勤领取计算连击：`const isStreakBonus = awardBlock(streakAfter)`，`:519` `return { placed, bonus: isStreakBonus, complete }`。
  - 全项目 `.bonus` 的生产消费点 = 0：`grep "\.bonus"` 仅命中 `logic/builds.ts:55`（投影重建）、`render/BuildScene.tsx:519,762`（文案标签）与测试；`Today.tsx:325-337` 调 `checkInDay()` 后只读 `res.complete`，`res.bonus` 被丢弃。
  - 普通打卡永远不掉 bonus 块：`appStore.ts:312` `bonus: false`、`:352` `return { ..., bonus: false, ... }`。
  - 且投影重建会抹掉 bonus 事实：`logic/builds.ts:24` 对打卡来源的块固定 `bonus: false`，`:34` 仅全勤块 `bonus: true`。即使 store 里给某块标了 bonus，任何一次撤销/同步重建都会丢。
  - README.md:10 明确承诺「连击每满 7 天，下一块为点缀色 bonus 积木」。
- **根因**：里程碑奖励只做了纯函数 `awardBlock`（`logic/blueprint.ts:13-16`）和返回值，没有事实字段承载、没有 UI 消费；而「全勤块」占用了同一个 `bonus` 字段。
- **影响**：核心奖励承诺失真（文档漂移最严重的一条）；用户第 7/14 天没有任何差异化反馈，留存钩子缺一环。
- **方案（二选一，先做 A 止损）**：
  - A. 立刻改 README.md:10 为「每日全勤额外掉落 1 块点缀色积木」（与实现一致），并把 `checkInDay` 的 `bonus` 接入 Today toast：「连续全勤 7 天！」（`Today.tsx:325-337` 读 `res.bonus`）。
  - B. 真做：`CheckIn` 增加 `bonusReason?: 'streak7'`（`types.ts:61-83`），`checkIn()` 内用 `currentStreak` 判定；`rebuildBuilds`（`logic/builds.ts:16-26`）从 `CheckIn` 恢复 `bonus`；`BlockDropModal`/`BuildScene` 对 `bonusReason` 渲染点缀色描边。
- **验收**：A = 文案走查 + `Today.test`（若存在）或手测第 7 天 toast；B = vitest「连续 7 天打卡的下一块 bonus=true，撤销后重建仍为 true」。
- **工作量**：S（A）/ M（B）
- **依赖**：B 依赖 C7 的字段拆分决策。

### C5 无自动更新、无安装包签名、无更新通道
- **现象与证据**：`src-tauri/tauri.conf.json:44-54` `bundle` 只有 `targets: "all"` 与图标，无 `windows.signCommand`/`certificateThumbprint`，无 `createUpdaterArtifacts`；`grep updater` 在 `package.json`/`Cargo.toml`/`tauri.conf.json` = 0；无 `.github` 发布流水线。已有产物：`src-tauri/target/release/bundle/msi/BlockHabit_0.2.0_x64_en-US.msi` 12.54MB、`nsis/BlockHabit_0.2.0_x64-setup.exe` 11.47MB（0.1.0 与 0.2.0 并存）。
- **根因**：发布工程只做到「能出安装包」，没有分发/升级/信任链。
- **影响**：① Windows SmartScreen 对未签名 NSIS 弹「未知发布者」，首装流失；② 用户永远停留在下载时的版本，schema v2 与旧版共存期会出现 9/30 方案 §7.4 记录的数据风险；③ 无法热修 C1/C2 这类白屏问题。
- **方案**：
  1. `tauri-plugin-updater`（Cargo + npm 各一个依赖）+ `tauri.conf.json` `plugins.updater.endpoints` 指向静态 JSON（GitHub Releases 或自有 CDN），`createUpdaterArtifacts: true`，私钥签名（`TAURI_SIGNING_PRIVATE_KEY` 走 CI secret）。
  2. 最小 CI（与 C9 合并）：tag push → `npm test` + `tsc` + `tauri build` + 上传 NSIS/MSI/latest.json。
  3. 短期无签名也可先做：安装包内「检查更新」跳转 Release 页 + 版本号可见（当前设置页无版本号显示）。
- **验收**：0.2.1 → 0.2.2 手测更新流程；`sig` 校验失败时提示不安装；`tauri build` 产物含 `latest.json`。
- **工作量**：M（签名证书采购另计）
- **依赖**：C9（CI）。

### P1 数据主权缺口：仅手动导出，无自动备份、无恢复入口、无「打开数据目录」
- **现象与证据**：
  - 导出只有设置页一个入口且用浏览器下载：`SettingsDialog.tsx:105-113` `new Blob(...) → a.download → a.click()`；`Stats.tsx:147-153`、`PolaroidModal.tsx:364-367`、`MonthlyPosterModal.tsx:374-378` 同模式。
  - 自动备份只在「导入前」发生：`SettingsDialog.tsx:136-142` 调 `pickAdapter().backup?.()`；Tauri 端保留最近 5 份（`tauriStorage.ts:5`、`:68-87`），但**备份文件在 appDataDir 里，应用内没有任何入口能看到/恢复**。
  - 损坏档备份 `blockhabit.json.corrupt-backup`（`tauriStorage.ts:91-97`）同样不可见。
  - 存档是单文件覆盖写（`tauriStorage.ts:40-66`，先写 .tmp 再 rename，健壮性 OK），但没有定时/每天快照；用户换机、重装、误删文件 = 全部数据（可能 2 年、1385 块）瞬间归零。
- **根因**：数据安全做了「防损坏」（原子写/校验/损坏备份），没做「防丢失/可迁移」（自动快照 + 用户可达的恢复入口）。
- **影响**：这是一款把长期投入（连击、建筑、随笔）存在本地的应用，数据可迁移性是留存保险；当前保险只在用户主动点「导出」时生效一次。**产品价值**：换机迁移 + 误操作恢复；**成本**：S~M；**风险**：备份带来的磁盘占用（每日一份 12 座满档约 1-2MB，保留 7 份可忽略）。
- **方案**：
  1. `appStore.initPersistence` 增加每日首启快照：若 `appDataDir/backups` 当日无文件则 `adapter.backup(state)`（复用现有 `backup`），保留 7 份（改 `BACKUP_KEEP`）。
  2. 设置页「数据」组新增「备份与恢复」面板：列出 `blockhabit-backup-*.json`（时间、习惯数、打卡数），支持「恢复此备份」（先走 `validateState` + 覆盖前再备份）与「打开数据目录」（`opener` 插件已具备 `opener:default` 权限）。
  3. 首次启动/每 30 天提示「导出一次备份到网盘」。
- **验收**：手测：造改动 → 重启 → `backups` 出现当日文件；在面板里恢复昨日的备份 → 状态回滚且恢复前自动生成新备份；vitest：`backup list parsing`。
- **工作量**：S~M
- **依赖**：C12 待验证项（导出通道）结论。

### P2 内容供给断层：12 座 1385 块，全建成后无 endgame
- **现象与证据**：
  - `logic/blueprints/index.ts:30-43` 12 座、顺序解锁；按 `generators.ts` 生成器逐块复算（Map 去重后）实际块数：植物 24 / 咖啡 21 / 相机 53 / 风车 91 / 木屋 116 / 火箭 107 / 灯塔 131 / 工厂 175 / 纪念碑 147 / 金字塔 165 / 机器人 165 / 城堡 190，**合计 1385**。
  - 城堡注释与事实不符：`generators.ts:51` 写「约 218 块」，实测 190 块（相机注释 53 正确、灯塔注释 122 实为 131、木屋 108 实为 116、风车 82 实为 91——注释漂移，UI 用 `blocks.length` 不受影响）。
  - 「190 天」不成立：每按下一个习惯 +1 块，每日全勤再 +1 块（`Today.tsx:287-350` 全勤卡）。1 个习惯的日常用户 = 2 块/天 → 城堡约 95 天、全 12 座约 693 天；3 个习惯 ≈ 4 块/天 → 全 12 座约 347 天。
  - 全建成后：`Build.tsx:43-47` `nextChoice = blueprintOrder[(idx+1)%len]` 回绕到已建成的 plant；`blueprint.ts:19-29` 在全部完成时 `firstIncompleteIndex` 返回长度 → 任意蓝图都可选；`canCheckIn` 不看蓝图完成度，`checkIn` 的 `nextSlot`（`blueprint.ts:5-7`）返回 null → **不再掉块、无任何提示**，打卡仍成功。
- **根因**：内容以「线性 12 座」为唯一进度载体，没有终局状态与后终局内容模型。
- **影响**：重度用户约 1 年后打卡不再有可见产出（仍在写 checkIn），「第 191 天之后是什么」目前是空白；展台成为唯一残余动机，但展台无增量内容。
- **方案（产品决策，分两步）**：
  1. **现在做（S）**：`Build.tsx` 在 `completedBlueprintIds.length === blueprintOrder.length` 时展示「全部落成」终局页：12 座全景 + 总块数 + 总天数 + 下一阶段文案；`Today` 打卡在全建成后给出「+1 块已存入展台/暂停掉落」的明确说明，避免「打卡没反应」。
  2. **以后做（M）**：内容供给模式二选一 ——（a）蓝图池无限生成（`generators.ts` 已有参数化能力，按主题/难度随机化，月度新蓝图）；（b）「修复/扩建」长线：已建成建筑可继续加盖装饰块（复用同一起始蓝图，追加 20% 块数），作为终局后的长期目标。
- **验收**：手动用 `?demo-castle` 或注入全 completed 状态 → 建造页出现终局页；Today 打卡 toast 文案正确；不出现 `getBlueprint` 异常。
- **工作量**：S（终局页）/ M（内容模型）
- **依赖**：C1（同批动蓝图引用校验）。

### C6 统计页无全局总量指标；全局热图色阶是死代码
- **现象与证据**：
  - `Stats.tsx:43-60` `rows` 只产出每习惯的当前/最长连击、总次数、总分钟；全局量只有副标题专注小时 `:62-65,166-168`。无「总打卡次数 / 总积木数 / 已落成建筑 n/12 / 全勤天数」——而这三个正是回答「我为什么还在坚持」的投入-产出指标。
  - 热图唯一使用点 `Stats.tsx:275-280` 传了 `habitId`，`Heatmap.tsx:33-40` 在 habitId 分支返回 0/1 二元值；带蓝→绿渐变的全局分支（`:18-25` `cellColor`、`:39` `dayCompletionRatio`）在生产代码里**无调用方**（`<Heatmap` 全项目仅 1 处）。
  - README.md:14 宣称「近 13 周日历热图（绿色点亮色阶，全完成日满亮）」——当前 UI 是每习惯二元绿/灰，看不到色阶，也没有「全完成日」（全局）视图。
- **根因**：统计页按「单习惯卡片」堆叠，缺全局视图；Heatmap 的全局模式做完后没接线。
- **影响**：13 周 × N 个习惯的二元方格信息密度低；用户看不到累计投入（总块数/建筑数/全勤天数），长期动机缺「成就账本」。
- **方案**：
  1. `Stats.tsx` 顶部加「总览卡」：总打卡次数（`checkIns.filter(!deletedAt).length`）、总积木数（`builds.length`）、已落成 `completedBlueprintIds.length`/12、全勤天数（`dayClaims.length`）、最长全勤连击（`dayClaimStreak`）。
  2. 「指标/手账」分段旁加「全局日历」第三段：`<Heatmap habits={habits} checkIns={checkIns} weeks={13}/>`（不传 habitId），复活渐变；顺手改 README.md:14 为「全局模式：灰→蓝→绿，全完成日满绿」。
- **验收**：vitest `Stats` 渲染断言总览卡数字；手测 3 习惯 2 天数据 → 全局热图出现中间色。
- **工作量**：S~M
- **依赖**：无。

### C7 全勤块恒 bonus，稀释琥珀稀缺性；连击奖励返回值无 UI
- **现象与证据**：`appStore.ts:491` 全勤块写死 `bonus: true, // 全勤专属奖励块自带高亮/点缀`；而全勤块几乎每天都有（`Today.tsx:287` 全勤卡每天可领）→ 用户每天最多 2 块里就有 1 块带点缀色语义。README.md:10 承诺的点缀色场景是「已完成勾 / 今日新落积木高亮 / 连击奖励块」（原始设计 §3.1 纪律），「全勤块」并不在其中。同时 `checkInDay` 的真正连击里程碑 `bonus` 无人消费（见 C4）。
- **根因**：两个奖励概念（每日全勤块 / 7 天连击里程碑）共用 `bonus` 一个布尔字段，视觉语义混叠。
- **影响**：点缀色从「稀缺奖励」降级为「每日默认」，视觉纪律与激励强度双降；且用户无法区分「今天特别」和「每天都这样」。
- **方案**：
  1. 拆分：`PlacedBlock.bonus` 保留给「连击里程碑」；全勤块改用 `fromHabitId === '__day__'` 判定，视觉上用形状/铭文（如顶面小旗、基础几何差异）而非琥珀描边。
  2. `checkInDay` 返回值在 Today 消费（toast「连续全勤 7 天」+ 落块弹窗标题变化），配合 C4-B。
  3. 若短期不改渲染：至少把全勤块改为「每周首个全勤」才 bonus，恢复稀缺性（store 单点改动）。
- **验收**：手测连续 7 天全勤 → 第 7 天出现唯一一次点缀色强调；截图对比四主题下新落积木高亮仍为琥珀。
- **工作量**：S~M
- **依赖**：C4。

### C8 功能蔓延度量与收敛：19 个设置控件 / 14 字段表单；幽灵设置 0、不可达枚举 1
- **现象与证据（穷举）**：
  - **设置项全清单（12 个持久化字段，全部有消费点 = 0 个幽灵）**：

| 字段 | 设置 UI | 消费点（证据） | 结论 |
|---|---|---|---|
| theme | SettingsDialog.tsx:174-190 | App.tsx:296-301（`data-theme` + 清 sprite 缓存） | 已用 |
| language | :162-172 | App.tsx:297,302-304 | 已用 |
| enableAmbientLighting | :259-286 | Build.tsx:32,103; BuildScene.tsx:230; ShowcaseScene.tsx:83 | 已用 |
| enableGentleDecay | :289-316 | Today.tsx:38,470 → streak.ts:94 | 已用 |
| enableEcoProps | :319-346 | BuildScene.tsx:132-143; ShowcaseScene.tsx:87-98 | 已用 |
| enableXRayInspection | :349-376 | Build.tsx:30-31 | 已用 |
| soundMaterial | :379-405 | sound.ts:76 | 已用（但 `'mute'` 无 UI 入口） |
| enableMiniWidget | :437-465 | App.tsx:263,270-284 | 已用 |
| soundMuted | :192-222 | App.tsx:286-289; sound.ts:75 | 已用 |
| volume | :208-221 | App.tsx:290-293; sound.ts:48-50 | 已用 |
| remindersEnabled | :224-251 | ReminderWatcher.tsx:37; reminderScheduler.ts:74 | 已用 |
| enableGyroscope | :408-436（仅 isMobile） | BuildScene.tsx:231,827; ShowcaseScene.tsx:84,817 | 已用但桌面不可达（见下） |

  - **不可达枚举**：`SoundMaterial = 'classic'|'walnut'|'crystal'|'metal'|'mute'`（types.ts:138），`adapter.ts:278-284` 与同步合并都接受 `'mute'`，但 `SettingsDialog.tsx:382` 只渲染前 4 个 → `'mute'` 只能从旧档/导入进入，用户无法设置也无法重置为它。
  - **平台错配**：`enableGyroscope` 的设置 UI 只在 `isMobile` 分支出现（`SettingsDialog.tsx:408`），而桌面端 `detect.ts` 判定恒为 desktop；同时仓库没有移动构建目标（`tauri.conf.json:44-54` targets=all 在 Windows 上只出 msi/nsis；无 `src-tauri/gen/android|ios`），所以这个开关在**实际发布形态里永远不显示**。
  - **规模**：设置含 5+6+1+2+5 = 19 个交互控件（语言/主题/声音开关/音量/提醒；环境光/风化/生态/透视/音色/悬浮件；自启；导出/导入；地址/账号/密码/自动同步/间隔），另有 2 个信息块（资产统计、快捷键）。`HabitDialog` 新建时首屏暴露：形态(3 选 1)、名称、频率(3 选 1)、时段、提醒(开关+起止)、目标时长/目标值/单位/步进、分类、备注，最多 14 个字段（`HabitDialog.tsx:85-105,177-470`）。
- **根因**：每轮「优化」以新增开关承载新机制（氛围/生态/透视/音色/悬浮件均为单次迭代产物），没有归并/折叠动作。
- **影响**：一个「极简黑白打卡」应用的首屏设置面板长达两屏；新手在「新建习惯」时被 3 类形态与量化/专注目标劝退；产品定位从「极简打卡」漂向「习惯类 All-in-one」。
- **方案（收敛，不动视觉语言）**：
  1. 设置分组折叠：默认只展开「偏好」；「氛围」组收成 1 个总开关 + 「高级」折叠（默认按 `enableAmbientLighting && enableEcoProps` 聚合展示）；WebDAV 收进「同步」折叠。
  2. 设置项目标 ≤10：把 `enableXRayInspection`（会话内页内已有开关）与 `enableGyroscope`（不可达）从设置移除或标「实验性」；`soundMaterial` 补 `'mute'` 或删枚举值。
  3. HabitDialog：首屏只留「形态 / 名称 / 频率」，其余（时段/提醒/目标/分类/备注）折叠为「更多选项（可选）」默认收起；高级用户编辑时展开。
  4. 维护一份 `docs/settings-matrix.md`（字段→UI→消费点→平台）防止下一代幽灵设置。
- **验收**：设置面板首屏 ≤1 屏（1366×768）；HabitDialog 首屏 ≤4 个字段；`grep 'mute'` 决定去留；单测：设置字段均有消费断言（可用现有 store 测试扩展）。
- **工作量**：S（折叠）/ M（表单重构）
- **依赖**：无；建议与 U1 同批（新手路径）。

### U1 首次使用路径：首屏表单过重 + 首块奖励无解释 + 落块弹窗 3.6s 自动关
- **现象与证据**：
  - 空态本身写得好：`Today.tsx:394-451` 有插画图标、`startJourney`、`emptyHint(蓝图名)`、新建按钮。
  - 但新建习惯即进入 14 字段表单（C8 证据）；无「第一次只要名字+频率」的降级路径。
  - 首次打卡：`Today.tsx:146-168` → `BlockDropModal` 全屏遮罩 + Canvas 舞台；落地后 3.6s 自动关闭（`BlockDropModal.tsx:63-66`），文案只有「+1 / 完成习惯」（`:142-155`）与底部蓝图进度（`:263-296`）。用户此刻**不知道**这块积木去了「建造」页、也不知道要拼 190 块。
  - Today 顶部蓝图 chip（`:210-233`，名称 + n/total + 百分比）是唯一常驻指引，但点击是跳到建造页（`:212-215` `onCelebrate?.()`，容易误以为「庆祝」而非「查看积木」）。
  - 无任何首启引导/教练标记（`grep 'onboarding|tour|coach'` 无命中）。
- **根因**：奖励的「即时反馈」做得很足，「去向与长期目标」的引导缺失。
- **影响**：首日用户拿到一块积木却不知道建筑在哪，次日回访动机弱；这是「empty state → 第一个习惯 → 第一次打卡 → 第一块积木」链路上唯一的断点。
- **方案**：
  1. HabitDialog 首次（`habits.length === 0`）降级为「两步」：名称 + 频率（含常用预设），其余字段折叠；「保存」直接触发一次可跳过的建习惯流程。
  2. BlockDropModal：新增一行说明「已放入《蓝图名》· 还差 N 块」，并在弹窗内加「去建造页看看」按钮（`onClose` 后调 `onCelebrate`）；首次落块不自动关闭（`firstBlock` prop 或 `habits.length<=1 && builds.length<=1` 时禁用 3.6s 定时器）。
  3. Today 蓝图 chip 的 title/文案从「3D 模型」改为「查看建造进度」；首周在 chip 上加小 pulse 提示。
- **验收**：手测清空存档 → 新建习惯（首屏 ≤4 字段）→ 打卡 → 落块弹窗出现「去建造页」且不自动关；vitest `BlockDropModal` 用例：首次不自动关闭。
- **工作量**：S~M
- **依赖**：C8（表单折叠）。

### U2 信息架构：4 页 tab、9 个弹窗，文档仍写三页
- **现象与证据**：`App.tsx:377-382` tabs = today/build/showcase/stats（四页），快捷键 1-4（`:361-375`）；README.md:29 的目录树仍写「pages/ 今日 / 建造 / 统计」，原始设计 §3.3 也是三栏 + 设置。弹窗共 9 个：SettingsDialog、HabitDialog、GalleryDialog、PolaroidModal、MonthlyPosterModal、FoundationNoteDialog、BlockDropModal、ConfirmDialog、ReminderDialog。展台空态只有一段绝对定位文字（`Showcase.tsx:107-125`），无指向「建造」的行动。
- **根因**：新增「展台」作为第四页后，导航模型与文档没有同步收口。
- **影响**：新用户不知道「展台」与「建造」的区别（一个正在建、一个已建成）；四页里有两页是「看模型」，信息架构冗余感；文档与实现不一致增加沟通成本。
- **方案**：
  1. 文档立即对齐（README.md:24-31 目录树、未来 spec 引用）：「今日 / 建造 / 展台 / 统计」四页 + 快捷键 1-4。
  2. 展台在无已落成建筑时（`completedBlueprintIds.length === 0`）不显示 tab，或 tab 置灰并提示「第一座建筑落成后开放」；`App.tsx:377-382` 按状态过滤 tabs。
  3. 展台空态加「去建造页」按钮（复用 `Build.tsx` 的跳转需求，App 传 setTab）。
- **验收**：清空存档后底部只有 3 个 tab；落成第一座后出现展台；README 与实现一致。
- **工作量**：S
- **依赖**：无。

### U3 提醒链路只在进程存活时生效；autostart 默认关闭且无首启提示
- **现象与证据**：`ReminderWatcher.tsx:26-108` 30s 轮询 + visibilitychange/focus 补扫，注释明确「进程退出后仍不提醒——退出态调度见设计文档 backlog」（`platform/notify.ts:1-7`）；`SettingsDialog.tsx:470-485` autostart 默认值来自系统（首次安装为关），无首启询问；`tauri.conf.json:13-22` 主窗口关闭被拦截为隐藏（`App.tsx:144-148`），只有托盘退出才真正结束进程——若用户习惯直接用任务栏关闭窗口，进程仍在，提醒有效；一旦真退出/重启电脑未自启，提醒失效。
- **根因**：提醒能力绑定「应用进程存活」，而「让进程常驻」没有任何产品化表达（自启默认关、无引导）。
- **影响**：README.md:13 的「到点提醒」对「平时不开应用」的用户事实上不存在；这是桌面习惯应用最容易被用户感知为「虚假承诺」的点。
- **方案（低成本）**：
  1. 首启弹一次非侵入式提示卡：「要开机自动启动并在后台提醒你吗？」→ 直接调用 `toggleAutostart`（插件已具备权限 `capabilities/default.json:22-24`）。
  2. 设置「提醒」组增加文案与状态：「提醒需要应用在后台运行（当前：已开启自启/未开启）」；关闭提醒总开关时同步提示。
  3. README.md:13 明确「应用需保持运行（托盘常驻）」；长期方案（退出后提醒）继续留在 backlog（需 Rust 定时器）。
- **验收**：首启出现自启询问；设置页显示自启真实状态；手测关闭应用（托盘退出）后到点不提醒、开自启后重启电脑到点提醒。
- **工作量**：S
- **依赖**：无。

### U4 修复砖供给/库存/窗口三重稀缺，断签兜底形同虚设
- **现象与证据**：库存上限 2（`appStore.ts:319`、`:498` `Math.min(2, nextRepair + 1)`），唯一来源 = 每落成一座建筑 +1（同两处）→ 12 座共 12 块；使用窗口只有 7 天（`Stats.tsx:282-289` `if (diffDays > 7 || diffDays < 0) → repairLimitToast`）；温和风化只保护「昨天漏 1 天」（`streak.ts:103-128` 的 yesterday / day-before 判定）。`repairBricks` 合并用 `Math.max`（`sync/merge.ts:221`，已知取舍）。
- **根因**：修复资源按「落成」一次性发放，没有周期性补给。
- **影响**：出差 3 天 = 连击断，且可能一块修复砖都没有（已用完/还没落成下座）；「回不来了」问题主要靠风化 1 天缓冲，恢复能力与用户投入不成比例。
- **方案**：补给改为周期性——每连续 14 天全勤/每 7 天连击里程碑 +1（仍上限 2），或在「全部落成」后按月补给；窗口放宽到 30 天（补卡仍是过去日期，`useRepairBrick` 已拒绝未来/归档/重复，`appStore.ts:420-444`）。
- **验收**：vitest：连续 14 天 → repairBricks +1 且不超 2；8 天前漏卡可补；14 天前仍拒绝。
- **工作量**：S
- **依赖**：C4（连击里程碑实现可复用同一 streak 计算）。

### C9 无 CI，358 个测试与设计台账全靠人肉跑
- **现象与证据**：仓库根无 `.github`（`Test-Path .github` → NO）；`package.json:6-12` 已有 `test/design:check/design:fix`，但无任何自动执行；`npm test` = 39 个测试文件、358 个用例（本轮 357 通过 + 1 失败为并行施工瞬态）；`npx tsc --noEmit` 0 错误。`AGENTS.md §4` 要求提交前自检 tsc + test + design:check。
- **根因**：单人本地开发习惯，未接入托管 CI。
- **影响**：350+ 用例与「设计台账未审批删除检测」只在提交者本机跑；C1/C2 这类回归无门禁；多人（含 AI 代理）并行时（本次审计已出现）台账测试失败会互相干扰。
- **方案**：`.github/workflows/ci.yml`：push/PR 触发，`actions/checkout` + `setup-node 22` + `npm ci` + `npm test` + `npx tsc --noEmit` + `npm run design:check`；再加一个 `cargo check` job（`working-directory: src-tauri`，ubuntu 可跳过或 macOS/Windows matrix）。PR 模板要求勾选自检。
- **验收**：PR 上 3 个 check 绿；故意改坏一处测试 → CI 红。
- **工作量**：S
- **依赖**：C5（发布流水线可复用）。

### C10 超大文件债务，超出仓库自己的 800 行约定
- **现象与证据**：`AGENTS.md §4`「单文件超过 800 行时，新增逻辑应拆到新文件」。实测（read 工具行数）：`src/render/iso.ts` 911 行、`src/render/BuildScene.tsx` 853 行、`src/render/ShowcaseScene.tsx` 764 行、`src/components/HabitRow.tsx` 725 行、`src/components/SettingsDialog.tsx` 723 行（`wc` 口径 759，含空行）、`src/store/appStore.ts` 646/711 行、`src/pages/Stats.tsx` 573/604 行、`src/pages/Today.tsx` 564/591 行。合计 `src` 106 个文件、约 21,297 行（非空行统计），3 个 CSS 1,449 行，测试 4,920 行（占 23.1%）。
- **根因**：每个文件都经历了 3 轮功能叠加（主题/生态/透视/移动/提醒/同步），没有拆分窗口。
- **影响**：渲染三件套占 2,528 行（约 12% 代码），是性能与视觉回归最敏感区；SettingsDialog 723 行里 4 组面板 + WebDAV + 导入导出，任何设置改动都要动同一个文件（并行开发冲突热点）。
- **方案（拆分建议）**：
  - `iso.ts` → `render/iso/projection.ts`（worldToScreen/sort/geometry）、`render/iso/cube.ts`（drawCube + sprite cache）、`render/iso/ground.ts`（ground/base/shadow/ambient）。
  - `BuildScene.tsx` → `useBuildViewport.ts`（scale/pan/pointer/pinch，`:700-820` 一段）、`useDropAnimation.ts`（animateIndex/onAnimated）、`buildSceneDraw.ts`（`:240-700` 的 rAF 绘制）。
  - `SettingsDialog.tsx` → `components/settings/PreferencesPanel.tsx`、`AmbiencePanel.tsx`、`DataPanel.tsx`、`WebdavPanel.tsx`，SettingsDialog 只保留壳与 footer。
  - `HabitRow.tsx` → `habitRow/statusButton.tsx`、`habitRow/counter.tsx`、`habitRow/noteEditor.tsx`。
- **验收**：拆分后文件 ≤500 行；`npm test` + `tsc` 全绿；现有渲染测试（`spriteCache.test.ts`、`buildSceneEco.test.tsx`、`touchGesture.test.ts`）不改断言通过。
- **工作量**：L
- **依赖**：无（建议在下次触碰渲染代码前先拆 iso.ts）。

### C11 未使用字体依赖 + 产物体积
- **现象与证据**：`package.json:14-19` 依赖 `@fontpkg/alimama-fang-yuan-ti-vf`、`@fontsource/fredoka`、`@fontsource/plus-jakarta-sans`、`@fontsource/zcool-qingke-huangyou`；`grep "Fredoka|PlusJakarta|zcool|FangYuan|fang-yuan" src/` = **0 命中**（只有真正用到的 Rubik、MiSans、AlimamaShuHeiTi 有 import/引用：`main.tsx:8-15`、`theme.css:1-8`）。`dist` 429 个文件 / 9.8MB，其中 `index-*.css` 489KB、`AlimamaShuHeiTi-*.woff2` 594KB，其余为 MiSans 四字重的 unicode-range 分片；安装包 msi 12.54MB / nsis 11.47MB。
- **根因**：字体资产试错后未清理依赖；MiSans 四字重全量打包。
- **影响**：npm 安装体积与 dist 文件数（429）无谓增大；安装包 12.5MB 对一个「极简」桌面小工具偏重（同类习惯应用常 5-8MB）。
- **方案**：经人类批准后（AGENTS「不要 npm install 新依赖（先问）」，删除同理）移除 4 个未用字体包；MiSans 只保留 400/500/600（`main.tsx:12-15` 去掉 Bold 或改用 variable）；目标 dist < 8MB、安装包 < 10MB。顺带在 README §技术栈 注明字体来源。
- **验收**：`npm run build` 后 dist 文件数下降、安装包体积复测；四主题截图字体无回归。
- **工作量**：S
- **依赖**：需人工批准（依赖变更）。

### C13 README 逐条核对（文档漂移总表）
- **核对口径**：逐条比对 README.md:9-17 的 9 条特性 + 目录树（:23-31）+ 开发命令（:33-41）；「真」= 行为与宣称一致；「部分」= 主行为存在但表述失真/有例外；「假」= 宣称行为不存在。
- **核对结果**：

| # | README 宣称 | 判定 | 证据 |
|---|---|---|---|
| 1 | 每天/每周 N 次频率、同日幂等、周频上限防刷、选填时段/时长/备注、必填/选填写方块标记、按时段分组（:9） | **真** | checkin.ts:58-76；Today.tsx:88-98,453-495；HabitDialog.tsx:17-37,180-465 |
| 2 | 每次有效打卡掉一块（:10） | **部分** | counter 达标才掉（appStore.ts:288-289）；蓝图建完后不掉（blueprint.ts:5-7, appStore.ts:293）但无提示 |
| 3 | 连击每满 7 天下一块为点缀色 bonus 积木（:10） | **假** | C4：返回值无消费点、普通块恒 bonus:false、重建抹掉 |
| 4 | 撤销确认（:10） | **真** | HabitRow.tsx:734-747 |
| 5 | missed 天可用修复砖补卡（:10） | **真**（但三重稀缺，见 U4） | Stats.tsx:282-297,546-571；appStore.ts:420-444 |
| 6 | 圆润乐高积木、地面虚线、接触阴影、滚轮缩放/拖拽、落块动画、落成仪式（:11） | **真** | iso.ts:817（setLineDash）；BuildScene.tsx:715-728,800-818；Build.tsx:250-299（仪式） |
| 7 | 12 个模型、实时缩略图、顺序解锁、拼完开下一座（:12） | **真** | blueprints/index.ts:30-43；BlueprintThumb.tsx；GalleryDialog.tsx:56-86；Build.tsx:289-293 |
| 8 | 到点提醒（运行中）+ WebDAV 多设备合并/自动/手动（:13） | **真**（同步有 CORS 可用性风险，见 C3） | ReminderWatcher.tsx；reminderScheduler.ts；merge.ts；useSync.ts:194-226 |
| 9 | 统计：当前/最长连击、总次数、13 周热图「绿色点亮色阶，全完成日满亮」、随笔、月度画报（:14） | **部分**（色阶/全完成日不成立） | Stats.tsx:43-60,275-280；Heatmap.tsx:18-25,33-40；C6 |
| 10 | 本地优先：appDataDir JSON、浏览器 localStorage、导出/导入（:15） | **真** | tauriStorage.ts:4-12；adapter.ts:338-370；SettingsDialog.tsx:105-146 |
| 11 | 四主题、点缀色跟随主题、全面圆润化、「软阴影弹窗」（:16） | **部分**（与「无阴影堆叠」表述矛盾；点缀色跟随主题与「唯一琥珀」纪律冲突，见 U6） | theme.css:53-107；README:16 自身 |
| 12 | 字体 Rubik + MiSans（中文正文）+ 阿里妈妈数黑体（标题），离线打包（:17） | **部分** | theme.css:34-36 实际栈是 Rubik→**AlimamaShuHeiTi**→MiSans，中文正文优先数黑体，MiSans 仅第三备选 |
| 13 | 目录树 pages/ 今日/建造/统计（:29） | **部分** | 实际四页（App.tsx:377-382，showcase 缺失）；也缺 sync/platform/audio/i18n 目录 |
| 14 | 开发命令 npm test / tauri dev / tauri build（:33-41） | **真** | package.json:6-12；bundle 产物存在 |

- **统计（按 9 条特性 bullet 计）**：真 **4**（#1、#6、#7、#10 对应的 bullet：习惯打卡/建造视图/图鉴/本地优先，另 #8 提醒+同步整体判真）；**部分 5**（积木奖励、统计、视觉、字体、提醒+同步中的同步措辞待 C3 结论仍判真）；**假 0**。细分 claim（表中 14 行 + 子项）口径：真 12 / 部分 3（#2、#9、#11、#12 中的部分行）/ 假 2（#3、#9 的色阶子claim）。
  更精确按「特性 bullet 9 条」：**真 4 条、部分 5 条、假 0 条**；但 **核心承诺级子claim 有 2 条为假**（7 天 bonus、热图色阶）。
- **根因**：README 长期只在「新增特性」时追加，未在功能收敛/语义变更时回改；「190 块城堡 / 190 天」「绿色色阶」等数字来自早期实现，后续改动未同步。
- **影响**：新人/外部对产品能力的预期失真（尤其 7 天奖励）；上一轮 2026-10-03 明确要求「README 修正只修事实性错误」，未闭环。
- **方案**：改 README.md 3 处（:10 连击奖励、:14 热图色阶、:17 字体路由）+ 目录树补四页与目录；新增「特性承诺 ↔ 测试/代码入口」对照表（`docs/feature-matrix.md`），每轮方案收尾强制更新。
- **验收**：README diff 走查；表内每条能在代码找到入口。
- **工作量**：S
- **依赖**：C4、C6 结论先定（真做还是改文案）。

### C14 无产品度量（无埋点/崩溃上报），也没有最低成本的本地替代
- **现象与证据**：`grep "updater|ErrorBoundary|onerror|unhandledrejection|reportError"` 与遥测关键词（analytics/telemetry/sentry/umami/ga）在 `src/` 均为 0；`AGENTS.md §3` 硬约束「无账号、无遥测上传」。
- **根因**：本地优先 + 隐私优先是正确的产品约束，但没有把「度量」转成本地离线形态，导致「内容供给/留存」类决策（P2）只能靠直觉。
- **影响**：无法回答「用户平均几天用完第 1 座/第 12 座建筑」「断签后是否回来」「提醒是否被用」——P2 内容节奏与 U3 提醒投入都没有依据。
- **方案（不联网、不上传）**：
  1. 本地 `appDataDir/metrics-local.json`：只记聚合计数（活跃日、连续天数、每座建筑落成耗时、提醒触发/跳过次数、设置变更次数），滚动 90 天。
  2. 设置页「关于」增加「导出使用摘要」（人工分享给开发者）；默认关闭，首次启动说明「只存在本机」。
  3. 与 C2 的错误日志合并为「诊断包」导出。
- **验收**：连续使用 3 天 → metrics 文件字段正确；导出摘要可读；无网络请求（DevTools Network 为空）。
- **工作量**：S
- **依赖**：C2。

### P3 商业模式缺位（判断：现在不做付费）
- **现象与证据**：全仓库无付费/授权/捐赠/账号代码（`grep "pay|license|donate|pro|subscription"` 无产品级命中）；无服务端；唯一「在线」能力是用户自备 WebDAV（`settings.webdav`）。
- **根因**：项目定位「本地优先、无账号、无遥测」，天然没有商业化载体。
- **影响（价值/风险）**：正面 = 极简、可信、无隐私负担，适合口碑传播；负面 = 无收入 → 内容供给（P2 的 M 级工作）与签名/更新（C5）缺少持续投入理由。
- **建议（现在/以后）**：
  - **现在不做**：不引入订阅/付费墙/账号体系，避免破坏「本地优先」与「极简」定位。
  - **以后做**（前提：C5 签名+自动更新、P1 备份先到位）：一次性买断（Microsoft Store 或自助激活码）或纯捐赠（爱发电/GitHub Sponsors）；不做功能分级，只做「支持开发」。
  - **风险**：付费会带来退款/客服/税务成本，与单人维护不匹配；若做，优先 Store（微软代收与签名）。
- **验收**：无代码改动；只需在 README 或官网写明「免费/如何支持」。
- **工作量**：—

### U6 「唯一点缀色琥珀」纪律与实现冲突（需 Lead 决断）
- **现象与证据**：原始设计 `docs/superpowers/specs/2026-08-22-blockhabit-design.md:38`「琥珀色只出现在三处——已完成状态的勾、今日新落积木的高亮、连击奖励积木。其余一切均为黑白灰」；`AGENTS.md §3` 硬约束「黑白灰 + 唯一琥珀点缀色」；但 `theme.css:77` oat 主题 `--accent: #c25e3e`（赤陶）、`:96` fog 主题 `--accent: #0284c7`（蓝）；README.md:16 又是「点缀色跟随主题」。三份文档三种口径。
- **根因**：主题化时把 accent 做成了主题变量，但没有更新「唯一琥珀」的纪律表述与设计记录。
- **影响**：品牌识别（琥珀 = BlockHabit）在多主题下消失；后续视觉改动缺少唯一裁决依据。
- **方案**：由 Lead/设计中枢在 `design/` 出一份记录二选一：① 维持主题化 accent，同步修改 AGENTS §3 与原始设计纪律表述；② 恢复全局琥珀 #F5B301，oat/fog 只换黑白灰。代码侧改动量：`theme.css` 两行 + 截图走查四主题。
- **验收**：三处文档口径一致；`grep '--accent' theme.css` 与纪律一致。
- **工作量**：S（决策）+ S（改）
- **依赖**：设计中枢（Lead 维护），本报告只提冲突不做修改。

### P4 移动端半成品：能力齐备但无构建目标
- **现象与证据**：存在 `src/mobile.css`（2,623B）、`src/platform/detect.ts`、`BottomTabBar.tsx`、`src-tauri/icons/android/**` 与 `ios/**`、`docs/superpowers/specs/2026-09-24-mobile-app-design.md`（19KB）；但 `tauri.conf.json:44-54` 无移动 target，无 `src-tauri/gen/android|ios` 工程；`enableGyroscope` 只在移动分支显示（C8）→ 桌面发布版永远看不到它。
- **根因**：移动端做了「响应式 + 设计」，没做「构建与真机验证」就冻结在半成品。
- **影响**：代码里长期存在一条不可达的移动布局分支（`detect.ts`、`mobile-app-root`、BottomTabBar），增加每轮渲染/表单改动的验证矩阵；对外容易被误认为「有移动版」。
- **方案**：明确取舍并写进设计记录：① 「移动端 = 未来版本，当前不做」→ 在 README 与设计文档标注 backlog，保留代码但在 CI 里不验证；或 ② 真做 → `tauri android init`、真机验证、把 gyroscope 纳入发布。**建议 ①**（单人维护，聚焦桌面）。
- **验收**：文档口径统一；CI 不因移动分支报错。
- **工作量**：S（文档）
- **依赖**：U6 同属设计治理。

---

## 本轮明确不建议做

1. **不重做同步协议 / 不引入操作日志（CRDT/版本向量）**：`sync/merge.ts` 已是 schema v2 墓碑 + LWW + 投影重建，9/30 方案 §7 已列为「已知限制」（修复砖 Math.max、墓碑 GC 90 天、习惯硬删除复活）。本轮先修 C3（能不能用），不碰「合并语义正确性」——收益低、回归风险高。
2. **不做 UI 大改/新视觉语言**：AGENTS §3 硬约束；C6/C7/U1 的改动全部复用现有组件与令牌，不新增颜色/阴影/圆角档位。
3. **不引入 UI 组件库/图表库/状态库**：Heatmap/Canvas 自绘已是资产；图表需求用现有 Canvas 或 CSS 实现。
4. **不做云同步/账号体系**：与「本地优先、无账号、无遥测」三条禁令冲突；多端能力继续走用户自备 WebDAV。
5. **不做移动端开发**（本轮）：见 P4，建议明确 backlog，而不是顺手扩 scope。
6. **不做付费/订阅**（本轮）：见 P3，缺签名、更新、备份三项前置。
7. **不追渲染性能优化**：9/30 方案 §7.12 已记录「Canvas 热路径优化延后，待视觉 diff 工具」，本轮未发现新的性能证据（spriteCache 已落地），不重启该议题。
8. **不为凑数改测试/放宽校验**：反例是 `designLedger.test.ts` 失败——应补齐设计中枢文件，而非改断言（AGENTS §6 数据诚实）。

## 待验证（未完成，不列为条目；给验证方法）

1. **Tauri 端导出是否真能落盘**：`SettingsDialog.tsx:105-113`（JSON）、`Stats.tsx:147-153`（Markdown）、`PolaroidModal.tsx:364-367`、`MonthlyPosterModal.tsx:374-378`（PNG）全部用 `<a download>`/剪贴板；`lib.rs` 未配置下载处理，`capabilities` 也无下载相关 scope。**方法**：桌面端四主题各导出一次，检查 `Downloads` 与 WebView2 下载提示；若失败，按 C12 方向改 Rust `fs` 写「下载」目录 + `opener` 打开。
2. **WebDAV CORS 实测**（C3 结论的最终确认）：**方法**：本机起 `docker run -p 8081:80 nknika/nginx-dav`（默认无 CORS 头），桌面端填入 `http://127.0.0.1:8081/` 点「立即同步」，若报 `network` 且浏览器端同端点可通 → 证实 CORS 根因。
3. **展台「自动排列」部分失败**：`Showcase.tsx:21-41` 先按 `next` 计算目标位，再逐项 `updateShowcasePlacement`（`appStore.ts:446-455` 用 store 中旧位置做碰撞检测，`logic/showcase.ts:84-98`）。**方法**：手动把模型 A 拖到 B 的目标位，再点自动排列，观察是否有模型停留在原位（返回值被忽略）。
4. **系统通知真机弹窗与权限**：`notify.ts:8-23` 惰性请求权限。**方法**：Windows 通知设置关闭后首次到点提醒 → 是否弹出系统通知；托盘隐藏窗口状态下重复一次。
5. **npm test 复跑**：本轮运行结果 357/358，唯一失败 `src/designLedger.test.ts`「设计中枢缺少 TOKENS/ART/SURFACES/VOICE.md」；随后 `design/` 已补齐 8 个文件（并行施工产物）。**方法**：收口后执行 `npm test`，期望 358/358；若仍红，由 Lead 确认设计中枢归属（不由本报告修复，因为本报告禁止写 design/ 其他文件）。

## 附录：代码规模与工程事实（审计取数）

- 源码：`src` 106 个文件、约 21,297 行（ts/tsx/css，非空行口径）；测试 39 个文件、4,920 行（23.1%）。
- `npm test`：39 files / 358 tests（本轮 357 passed、1 失败见待验证 5）；`npx tsc --noEmit`：0 错误。
- 最大文件 TOP10（行）：iso.ts 911 / BuildScene.tsx 853 / ShowcaseScene.tsx 764 / HabitRow.tsx 725 / SettingsDialog.tsx 723 / appStore.ts 646 / Stats.tsx 573 / Today.tsx 564 / HabitDialog.tsx 492 / i18n/types.ts 449（另 en.ts 481、zh.ts 465）。
- 产物：`dist` 429 文件 / 9.8MB；`bundle/msi/BlockHabit_0.2.0_x64_en-US.msi` 12.54MB、`nsis/BlockHabit_0.2.0_x64-setup.exe` 11.47MB（0.1.0 旧产物并存未清理）。
- 版本：package.json / Cargo.toml / tauri.conf.json 均为 0.2.0（一致）；`git status` 47 项未提交改动（正常现状，未做任何提交/清理）。
- 文档：`docs/superpowers/` 9 个文件（4 spec + 3 plan + 2 其它），**只追加不归档**；本轮新增设计中枢 `design/` 8 文件 + records。
- i18n：`lang === 'zh'` 内联三元仅剩 3 处（9/30 方案要求的 <15 已达标），Today 日期头仍有一处（`Today.tsx:196-207`），属可接受的画布/日期格式例外但未注释说明。

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
