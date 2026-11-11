# BlockHabit 创新项技术可行性笔记（A1–A4 / B1–B3）

> 本文件是「创新项」的**代码级技术底稿**，回答「能不能做、怎么做、改哪些文件、多大工作量、风险在哪、怎么验收」。
> 产品意图与视觉规范以 `docs/superpowers/specs/2026-11-10-blockhabit-innovation-deep-dive.md`（下称 deep-dive，含 D-059…D-065 七条设计记录）与 `design/` 为准；本文不替代设计记录，也不做视觉决定。
> 文中所有「现状」都标注到 `文件:行号`，均来自 2026-11-10 当次代码阅读；「建议方案」是可实现的最小路径，不是唯一路径。

- 日期：2026-11-10
- 作者：innovation-engineer（AI agent，任务 task-9）
- 状态：draft（供 Lead 与实现者评审；不含已批准的设计/权限决定）
- 硬约束：**不新增 npm / Rust 依赖、不升 schemaVersion、不改设计语言、不改 package.json**；全文只此一份文档，无代码改动。

---

## 0. 一页结论

| 项 | 结论 | 工作量 | 改 AppState schema？ | 关键前置 / 阻塞 | 一句话理由 |
| --- | --- | --- | --- | --- | --- |
| A1 三档尺寸 + 置顶 | **可行**（需改造窗口逻辑与权限） | S–M（2–3 人日） | 否（AppSettings 加 2 个可选字段，不升 schemaVersion） | capabilities 增加 2 条写权限；位置只进 localStorage | 现有 toggleMini 已是「同一 WebView 改尺寸」，扩成 preset 表 + 显式最小尺寸即可；真正的坑在 DPI/多屏与隐式最小尺寸 |
| A2 落成年鉴 | **可行** | S–M（3–5 人日，画布占大头） | **否（零新字段）** | 先抽公共「模型舞台」画布模块 | checkIns/builds/dayClaims/foundationNotes 足以覆盖全部页签；repairBricks 只有当前库存、无历史，年度「修复砖使用量」不可派生（建议不做） |
| A3 WebDAV 预设 + 自检 | **可行**（TLS/DNS 只能启发式） | S–M（2–3 人日） | 否（配置在 localStorage） | 明确 http:// 端点策略；错误码与 i18n 扩展 | platform/http + sync/webdav 的请求层可直接复用；但 JS 侧拿不到结构化网络错误，TLS/DNS 只能按错误文本归类 |
| A4 一键档案包 | **可行**（ZIP 无依赖可实现） | M（3–5 人日） | 否 | capabilities 增加 fs 二进制写 + opener 权限；确定「文件夹优先 / ZIP 可选」 | STORE+CRC32 约 150 行纯 TS，实测 8MB CRC 13ms；真正的限制是 Tauri 侧没装 dialog 插件、fs scope 只到 appDataDir |
| B1 扩展蓝图包 | **有阻塞** | L（兼容改造 3–5 人日 + 内容 6–10 人日） | **需要新可选字段 contentVersion（不升 schemaVersion）** | 必须先做内容版本门，否则旧客户端会**静默丢新建筑数据** | 旧客户端 sanitizeState 会把未知 blueprint 的 builds/completed 过滤掉并落盘；同步侧则直接 incompatible |
| B2 桌面专注陪伴 | **可行**（需改造 timerStore） | M（3–4 人日） | 否（会话存 localStorage，设备本地） | 依赖 A1 的尺寸档；需单一通知源 | 逻辑简单，难点是「隐藏/最小化时定时器被节流」「重启恢复语义」与通知去重 |
| B3 建筑即编年史 | **可行** | S–M（2–3 人日） | 否（placedAt 已可推导落成日） | 与 A2 共用 selectors 与画布 | BuildScene 已把「块序位 → 打卡元数据」做成 O(1) 映射，可直接抽成纯逻辑复用 |

**读法**：§0.1 是本次阅读得到的代码事实基线（后续每项的「现状」都引用它）；§0.2 是本机可复现的实测数据（性能/体积判断依据）；§0.3 是全项共用的硬约束。然后 A1→B3 逐项；§8 实施顺序、§9 最高风险 5 条、§10「每项是否可不改 schema」汇总、§11 需 Lead 拍板的岔路口。

---

## 0.1 代码事实基线

### 0.1.1 运行形态

- 桌面端是**单主窗口 + 托盘菜单窗口**两个 WebView：主窗口按`App` 渲染，tray-menu 按 `TrayMenu` 渲染，是**独立 JS 上下文、独立 store 副本**（`src/main.tsx:40-45,58-61`）。跨窗口只同步语言/主题（主窗 emit：`src/App.tsx:347-354`；托盘 listen：`src/components/TrayMenu.tsx:37-59`）。
- 迷你摆件**不是独立窗口**，是把 main 窗口 setSize 后的另一种渲染分支（`src/App.tsx:434-451`）。因此迷你件与主窗共享同一 store/同一 JS 上下文——这点对 B2（专注会话跨形态可见）是利好。
- 窗口关闭 = 收进托盘（`onCloseRequested` → preventDefault → `handleWindowCloseRequest` → `win.hide()`，`src/App.tsx:163-166,295-302`）；真正退出只走托盘菜单 → Rust `begin_quit` 与前端 flush 握手（`src-tauri/src/lib.rs:58-79`；前端监听 `src/App.tsx:378-406`）。
- 托盘：左键点击显示主窗，右键在光标处弹 tray-menu 窗口；tooltip 由前端 `invoke('update_tray')` 驱动（`src-tauri/src/lib.rs:9-45,115-133`；`src/App.tsx:101-135`）。

### 0.1.2 窗口与权限（A1 的核心事实）

- 主窗口配置：1100×760、**minWidth 900 / minHeight 600**、decorations:false，**没有 transparent**（`src-tauri/tauri.conf.json:14-22`）；tray-menu 才是 transparent + alwaysOnTop + skipTaskbar（`:23-37`）。CSP 见 `:39-42`。
- `toggleMini`：进入时记录 `outerSize()/scaleFactor()` → `setSize(LogicalSize(260,380))` → `setAlwaysOnTop(true)` → `setResizable(false)`；退出恢复尺寸 → alwaysOnTop(false) → resizable(true) → `center()`（`src/App.tsx:261-286`）。
- **全仓库没有任何 `setMinSize` 调用**（grep 结果）。Tauri 文档语义：`setSize` 改的是 **inner size**，而 window config 的 minWidth/minHeight 是**最小 inner size**（`node_modules/@tauri-apps/api/window.d.ts:1097-1125`）。也就是说 260×380 能成立依赖「当前 Tauri/tao 没有对程序化 setSize 强制最小尺寸」这一**隐式行为**——必须变成显式契约（见 A1 方案）。
- capabilities 现状（`src-tauri/capabilities/default.json`）：已授权 set-size / set-always-on-top / set-resizable / center / hide / show / minimize / toggle-maximize 等；**未授权** `core:window:allow-set-min-size`、`core:window:allow-set-position`。只读窗口信息（outer-size / outer-position / scale-factor / current-monitor / available-monitors / primary-monitor）在 `core:window:default` 里，无需新增（依据 `src-tauri/gen/schemas/acl-manifests.json` 的 `core:window.default_permission`）。
- 迷你模式退出时写回 `enableMiniWidget:false`（`src/App.tsx:283-285`），但**手动进入迷你模式时并不写 true**；自动进入只发生在启动 hydration 后按该设置判定一次（`src/App.tsx:307-322`）。结果：手动进入迷你件后重启不会自动回到迷你件——A1 需要顺手修平。

### 0.1.3 迷你摆件组件与布局预算

- `MiniDeskToy`：外框 r-md + 1px line + 阴影；顶栏 8/12/6 padding + 24×24 两个按钮；中段 flex:1 的 `BuildScene`；底栏进度 + ≤3 个快捷打卡胶囊 + toast（`src/components/MiniDeskToy.tsx:57-191`）。
- 迷你件是 `React.lazy` 加载（`src/App.tsx:22-24`），首帧有 Suspense 空白兜底（`:437`）。
- 命中区审计已知问题：迷你件按钮 24×24、胶囊 padding 3px 9px，低于桌面 32px 建议（`design/records/D-20261110-004-audit-ux.md` U21；`src/components/MiniDeskToy.tsx:95,103,155-167`）。三档尺寸改造必须把这个一并收掉。
- `BuildScene` 画布：ResizeObserver 自适应 + `dpr = min(devicePixelRatio,2)` + resolution 媒体查询补偿跨屏 DPR 变化（`src/render/BuildScene.tsx:553-596,181-184`）——尺寸档切换不需要改渲染层，只需给它不同高度。
- 设计文档已把迷你件定为 260×380（`design/SURFACES.md:101-106`），A1 的三档属于**新增表面规格**，按 AGENTS §1 必须先有设计记录。

### 0.1.4 专注计时（B2 的核心事实）

- `timerStore` 只有内存态：`sessions: Record<habitId,{startedAt,targetMs}>` + start/cancel，**没有持久化、没有延长、没有通知标记**（`src/store/timerStore.ts:1-32`）。
- 今日页 `HabitRow`：`running = isFocus && session && elapsed < targetMs`，`ended = elapsed >= targetMs`；点卡片：未开始→start；running 且 ≥80% → 立即完成打卡，20%–80% → 二次确认，ended → `performCheckIn(habit.targetMinutes)`；`actualMinutes = max(1, round(elapsed/60000))`（`src/components/HabitRow.tsx:82-84,121-134,198-241`）。
- 全局 `TimerWatcher` 每 1s 轮询 sessions，到点 toast + `notify()`，用 `notified: Set<sessionKey>` 内存去重（`src/App.tsx:53-98`）。重启后该 set 为空 → 已结束的会话会**再通知一次**（B2 要修）。
- `notify()` 统一出口，权限惰性申请，Tauri 走 notification 插件、窗口隐藏时也能弹（`src/platform/notify.ts:1-37`）。
- 托盘 tooltip 由 `TraySync` 在依赖变化时 invoke 更新（`src/App.tsx:101-135`）——若每秒更新 tooltip 会变成高频 IPC，B2 必须只在相位变化时更新。

### 0.1.5 持久化与备份

- 读档：Tauri 走 appDataDir/blockhabit.json（`src/storage/tauriStorage.ts:18-63`），浏览器走 localStorage（`src/storage/adapter.ts:391-420`）；写盘先写 tmp 再 rename（`tauriStorage.ts:65-85`）。
- 自动备份 5 份 + 手动快照 5 份 + corrupt-backup（`src/storage/backups.ts:12-17,111-131`；`tauriStorage.ts:5,87-106`）；`openDataDir()` 用 `opener.openPath(appDataDir)`（`backups.ts:134-142`），但 capabilities 只授了 `opener:default`（含 open-url / reveal-item-in-dir，**不含 allow-open-path**）→ **该按钮当前大概率静默失败**（返回 false），A4 要用只是个既有地雷。
- 页面内「导出数据」= `useAppStore.exportData()` 的 JSON 下载（`src/components/SettingsDialog.tsx:181-186`）。
- **存档字段是三处手工白名单**：`persistState`（`src/store/appStore.ts:723-754`）、`exportData`（`:618-655`）、`useSync.buildLocalState`（`src/sync/useSync.ts:48-65`）。**已知隐患**：`repairBrickMonth`（`src/types.ts:184`）只在 exportData 与 normalize 里出现，**没有进 persistState、也没进 buildLocalState** → 重启后月度额度结算会把「已结算月份」当未知，再补一次库存（潜在刷砖）。A1/B1 新增顶层字段时必须同步这三处，否则会被静默丢弃。

### 0.1.6 WebDAV 同步

- 配置在 localStorage 键 `blockhabit_webdav_config`，**密码明文**随 config 一起落盘；表单输入 800ms 防抖落盘（`src/sync/useSync.ts:9,28-46,97-107`）。
- 请求层：`httpFetch` 桌面端走 tauri-plugin-http（绕 CORS）、浏览器回落 fetch（`src/platform/http.ts:11-23`）；URL 规范化 + 路径段编码 `getSyncUrl/encodeUrlPath`（`src/sync/webdav.ts:33-66`）；Basic Auth `getAuthHeaders`（`:81-89`）。
- 读：GET，404 后 PROPFIND Depth:0 二次确认目录是否存在（`webdav.ts:103-167`）；写：PUT + If-Match，409 时 MKCOL 重试一次（`:178-235`）。
- 错误码：`auth | network | conflict | no-collection | http | cors`（`webdav.ts:9`），UI 映射在 `SettingsDialog.syncErrorText`（`:136-151`），i18n 在 `t.settings.syncErrors`。CORS 误报为网络错误已在 D-20261110-024 修过（`isLikelyCors`）。
- **CSP 只允许 https:/wss:/ipc: 连接**（`src-tauri/tauri.conf.json:40`）→ 明文 http:// 的 WebDAV 端点会被 WebView 拦掉，错误看起来像网络/CORS 失败（审计 C24 记录，见 `design/records/D-20261110-003-audit-code.md`）。A3 必须显式处理这条。
- 同步入口：设置页 WebDAV 组（`SettingsDialog.tsx:755-874`）+ 启动后延迟同步与定时器（`useSync.ts:194-226`）；同步前要求 `hydrated` 且 `!needsUpgrade`（`:137-141`）。
- 合并：只合事实层（习惯 LWW、打卡墓碑、全勤 LWW），积木层由 `rebuildBuilds` 从事实重建（`src/sync/merge.ts:11-16,199-294`）。

### 0.1.7 数据模型与校验（A2/A4/B1/B3 的地基）

- `AppState`：schemaVersion:2、habits、checkIns、builds、activeBlueprintId、completedBlueprintIds、settings、dayClaims、deletedDayClaims、repairBricks、repairBrickMonth、showcasePlacements、foundationNotes、reminderLog（`src/types.ts:169-191`）。
- 可派生字段：CheckIn 有 date（本地时区 YYYY-MM-DD）/at（ISO UTC）/actualMinutes/value/note/mood/starred/bonus/placedBlockId/blueprintId（`types.ts:61-85`）；PlacedBlock 有 blueprintId/index/placedAt/fromHabitId/bonus/deletedAt（`:104-114`）；DayClaim 有 date/claimedAt/blockId/blueprintId（`:117-123`）；`foundationNotes: Record<blueprintId,string>`（`:187-188`）。
- `repairBricks` 只有当前库存（上限 4），**没有任何发放/消耗历史**；`repairBrickMonth` 只有最近结算月。→ A2 的「年度修复砖使用数」不可派生，建议不做或只显示当前库存。
- 校验双轨：导入/同步用 `validateState`（严格、任一非法即拒、蓝图 id 必须在白名单 `KNOWN_BLUEPRINT_IDS = new Set(blueprintOrder)`，`src/storage/adapter.ts:36-47,135-165`）；本地读档用 `sanitizeState`（宽松：丢弃非法元素、未知 blueprint 外键**丢弃**、activeBlueprintId 回落 plant，`:170-210`）。`normalizeState` 补默认值且**用展开保留未知顶层字段**（`:306-378`）。
- 迁移：v1→v2（dayClaims 字符串→对象、checkIns 回填 blueprintId、丢弃 rewardBlockIndex），版本高于 2 → `needsUpgrade`（`:217-303`）；`needsUpgrade` 时挂起持久化（`appStore.ts:679-710`）。

### 0.1.8 蓝图注册表（B1 的核心事实）

- 注册 = generators 里一个 `makeXxxBlueprint()` + `blueprints/index.ts` 的 export 常量 + `blueprints` Record + `blueprintOrder` 数组（`src/logic/blueprints/index.ts:17-58`）。容量表由注册表自动派生：`BLUEPRINT_CAPACITY = Object.fromEntries(Object.entries(blueprints).map(...blocks.length))`（`src/logic/builds.ts:13-16`）——这里**没有硬编码 12**。
- `getBlueprint(id)` 未知 id 不抛错，warn 后回落 `blueprintOrder[0]`（plant）（`index.ts:60-70`）。
- 图鉴顺序解锁：`canSelectBlueprint` = 序位 ≤ 第一个未完成序位（`src/logic/blueprint.ts:18-30`）；`GalleryDialog` 遍历 `blueprintOrder`（`src/components/GalleryDialog.tsx:4,58-77`）；建造页「全部落成」按 `completedBlueprintIds.length >= blueprintOrder.length` 判定（`src/pages/Build.tsx:61`）——也是动态的。
- 展台容量：`SHOWCASE_GRID_SIZE = 26` 网格 + 包围盒碰撞（`src/logic/showcase.ts:3,56-140`）；落成后自动找空位，满了跳过（`appStore.checkIn` `:362-366`）。
- i18n 名称：`t.blueprints: Record<string,string>`（`src/i18n/types.ts:447`），`getBlueprintName` 缺失时回退显示 id（`src/i18n/index.ts:18-22`）——新蓝图漏配名称不会报错，只会显示英文 id，需要构建期检查兜住。

### 0.1.9 画布 / 导出（A2/A4/B3 的复用基础）

- 统一渲染入口是 `src/render/iso.ts`（public：`drawCube / drawGroundBase / paletteFromDocument / worldToScreen / DEFAULT_ISO_CONFIG / STUD_H / rotateCoord` 等），`src/render/isoCube.ts` 内含 sprite 缓存（上限 512 张 / 24MB，`isoCube.ts:96-121`），主题切换时 `clearCubeSpriteCache()`（`App.tsx:336-339`）。
- **同一段「包围盒→fit→画家排序→drawGroundBase→drawCube」在 3 处重复实现**：`MonthlyPosterModal`（画报，用主题调色板 `paletteFromDocument`，`src/components/MonthlyPosterModal.tsx:141-210`）、`PolaroidModal`（相纸，**固定硬编码调色板**，`src/components/PolaroidModal.tsx:114-122,135-182`）、`BlueprintThumb`（图鉴缩略图，`src/components/BlueprintThumb.tsx:42-96`）。A2/A4/B3 若再复制第四份，后续必然分叉——建议先抽 `src/render/modelStage.ts`。
- 画报导出：三种比例 600×750 / 540×960 / 600×600，全部 2×（`MonthlyPosterModal.tsx:67-75`）；下载用 `toDataURL` 造 `<a download>`（`:377-386`），复制用 `canvas.toBlob + ClipboardItem`（`:358-375`）。相纸 500×640 @2×（`PolaroidModal.tsx:81-86`）。
- 画布颜色：`MonthlyPosterModal` 直接从 `getComputedStyle(:root)` 取令牌值（`:83-91`），网格空日格用了字符串 `color-mix(...)`（`:264`）。**实测**（见 §0.2）：现代 Chromium canvas 支持 `color-mix(hex)`，但**不支持 var()**；旧 WebView2 可能静默忽略并沿用上一个 fillStyle。→ 导出画布一律用解析后的 rgba/hex 数值，不要依赖 CSS 函数。
- 全局**没有任何 `document.fonts.ready` 等待**（grep 结果为空）。导出 CJK 文本时字体未就绪会掉字/错字重，A2/A4/B3 的导出必须先 await 字体就绪。
- 统计页已有「手账长廊」：`chronicleItems` 从 checkIns 的 note 派生 + 筛选 + Markdown 导出（`src/pages/Stats.tsx:100-172`），视图切换 metrics/chronicle（`:28,245-252`）；热图组件 `Heatmap` 支持 `weeks`（默认 13）与 `habitId` 过滤，颜色是灰阶（`src/components/Heatmap.tsx:7-15,23-30`）；`cellColor(ratio, future)` 已导出可复用。

### 0.1.10 其他

- 设置页是单个 953 行的 `SettingsDialog.tsx`，5 个分组；WebDAV 组在「数据备份」之后（`SettingsDialog.tsx:755-874`）；迷你件开关在「感官与氛围」组（`:590-619`）。A1/A3/A4 都会改这个文件 → 需要拆分或至少按组拆子组件，避免文件继续膨胀（AGENTS §4：超 800 行应拆）。
- i18n 是纯类型化对象（`TranslationSchema`），zh/en 两份必须同步；当前无 fallback 合并机制，缺键 = 类型错误或运行时 undefined。
- 纯逻辑测试文化：`src/logic/**` 必须有 vitest；画布/DPR 类只做布局数学单测，不做像素断言（仓库现状如此）。

---

## 0.2 本机实测数据（2026-11-10，供判断用）

| 测项 | 方法 | 结果 | 对方案的结论 |
| --- | --- | --- | --- |
| 年鉴聚合性能 | Node 原型：合成 2024–2026 共 1095 条打卡 / 1095 块积木，单遍扫描按月、按建筑、按时段、按星期聚合 | 单年 0.2–0.6 ms；100 次均值 **0.22 ms** | A2 逻辑层不是瓶颈；不需要索引/缓存，纯派生即可 |
| 存档体积 | 上述数据 `JSON.stringify(state,null,2)` | **429 KB**（紧凑化约 250–280 KB） | A4 的 state.json 远小于图片体量；ZIP 内存压力主要在 PNG |
| CRC32 吞吐（STORE 需要） | 查表法纯 JS，8MB Uint8Array | **13 ms**（约 630 MB/s） | 10MB 级档案包 CRC 开销可忽略 |
| SHA-256 | Node WebCrypto `subtle.digest`，8MB | **6 ms** | 校验和可行；Tauri WebView2 是否有 `crypto.subtle` 未验证（见 A4 风险），需纯 TS 兜底 |
| canvas 颜色能力 | headless Edge 157：`fillStyle = 'color-mix(in srgb, #000 6%, transparent)'` | **支持**（归一化为 color(srgb 0 0 0 / 0.06)）；`var(--ink)` **不支持**（保持上一色） | 导出画布用 rgba 数值最稳；现有画报的空日格写法在旧内核上会静默出错 |
| 环境说明 | Node（DSH 运行时）+ Edge 157 headless，同一台 Windows 机器 | 非真机 Tauri/WebView2，非真实 WebDAV 服务器 | 与硬件相关的结论（窗口/DPI/多屏）只能标「待真机验证」 |

---

## 0.3 全项共用硬约束

1. **0 新依赖**：ZIP（STORE+CRC32）、SHA-256 兜底、WebDAV 诊断都必须是纯 TS；Rust 侧只允许改 capabilities（配置），不动 Cargo.toml/package.json。
2. **schemaVersion 保持 2**：只允许加**可选**字段；任何新顶层字段必须同步三处手工白名单（`persistState` / `exportData` / `useSync.buildLocalState`），否则会被静默丢弃（`repairBrickMonth` 就是现成教训）。
3. **可见即记录**：任何新表面/新尺寸/新文案属于设计改动，先写 `design/records/` + 登记 + `npm run design:check`（A1/A2/A3/A4/B2/B3 全部命中）。
4. **i18n 双语**：新增文案 zh/en 同时补齐；canvas 内文案允许例外但必须注释（现有画报已有此注释惯例）。
5. **数据诚实**：年鉴/编年史只陈述事实，不做评分/排名；派生一律排除 `deletedAt` 墓碑；落成判定沿用 `builds` 事实而非 `completedBlueprintIds` 列表长度。
6. **capabilities 变更 = 能力面变更**：加权限不是加依赖，但会扩大安装包能力面，需在记录里写清「为什么、最小权限是什么、拒绝时的降级行为」。
7. **本环境无法验证**：真机 Tauri 窗口行为（DPI/多屏/最小尺寸钳制/Alt+F4）、真实 WebDAV 服务器、WebView2 的 crypto/clipboard 行为——相关结论在文中均标「待真机」。

---

## 1. A1 迷你摆件三档尺寸 + 置顶开关

### 1.1 现状事实（在 §0.1.2 / §0.1.3 基础上补细节）

- 尺寸是**主窗口的 inner size**：`setSize(new LogicalSize(260,380))`（`src/App.tsx:270`）。同一 WebView 换布局，不是新窗口；因此没有跨窗口状态同步问题。
- 但 `260×380` 与 `tauri.conf.json` 的 minWidth 900 / minHeight 600 之间**没有任何显式调和代码**（全仓库无 setMinSize）。现在能生效是因为「Tauri/tao 当前版本没有对程序化 setSize 施加最小尺寸约束」——这是**隐式行为**，不是契约。
- 尺寸恢复靠内存 ref `preMiniSizeRef`（`App.tsx:259,266-279`），**进程重启即丢**；退出时固定 `center()`，不恢复原位置。
- 摆件窗口**不透明**（tauri.conf main 无 transparent），而内层卡片是 r-md 圆角（`MiniDeskToy.tsx:58-71`）——四角露出窗口方角。是否要透明窗是视觉决定，不是技术必需。
- 顶栏是 `data-tauri-drag-region`（`MiniDeskToy.tsx:73-84`）。Windows 上在 drag region 上双击会走系统「最大化」语义，与 deep-dive 想要的「双击展开主窗」冲突（见 1.4 风险）。
- 置顶恒为 true（`App.tsx:271`），没有开关，也没有写回设置。
- 关闭/托盘/退出语义已完整（A10 修复）：迷你下关闭 = 先 `toggleMini(false)` 再 `hide`（`App.tsx:290-302`）；退出只走托盘菜单并做 flush 握手。
- 迷你件首帧经 `React.lazy`（`App.tsx:22-24,437`），进入瞬间可能先看到一块空底色，再看到内容；三档尺寸会让这个闪变更明显（尺寸先变、内容后到）。
- 手动进入迷你模式**不会**写 `enableMiniWidget:true`（只有退出写 false，`App.tsx:283-285`），自动进入只读一次设置（`:307-322`）。
- 现有内容布局：顶栏 ≈38px（8+24+6）、底栏 = 进度文本/条 + 最多 3 个胶囊 + 内距 ≈ 70–84px（`MiniDeskToy.tsx:116-175`）。口袋档 150px 高时留给 3D 只剩约 30px → **必须按档位裁剪区块**，不能只缩字号。
- 命中区问题（U21）：按钮 24×24、胶囊 3px 9px padding（`MiniDeskToy.tsx:95,103,155-167`）。

### 1.2 建议方案

#### 1.2.1 尺寸档与布局预算

新增纯数据模块 `src/platform/miniWindow.ts`（无 React 依赖，便于单测）：

    export type MiniSize = 'pocket' | 'standard' | 'display'

    export interface MiniPreset {
      w: number            // 逻辑像素，inner size
      h: number
      headerH: number
      footerH: number
      /** 3D 区最小可用高度（组件用它做安全断言） */
      stageMinH: number
      maxPills: number
      showProgressText: boolean
    }

    export const MINI_PRESETS: Record<MiniSize, MiniPreset> = {
      pocket:   { w: 220, h: 150, headerH: 30, footerH: 44, stageMinH: 64, maxPills: 1, showProgressText: false },
      standard: { w: 280, h: 400, headerH: 34, footerH: 110, stageMinH: 180, maxPills: 3, showProgressText: true },
      display:  { w: 420, h: 560, headerH: 36, footerH: 150, stageMinH: 260, maxPills: 5, showProgressText: true },
    }

约束（可单测的不变量）：

- 对每一档：headerH + stageMinH + footerH ≤ h - 8（留 8px 呼吸）。pocket = 30+64+44 = 138 ≤ 142 ✓。
- 宽度 220 下：胶囊必须 maxWidth:100% + ellipsis；进度文本用 caption 字号。
- 高度断言放在 MiniDeskToy 内部（DEV 下 `console.warn`），避免以后改布局时静默裁切。

内容裁剪策略（按档）：

| 区块 | pocket | standard | display |
| --- | --- | --- | --- |
| 顶栏 logo/标题 | logo + 展开 + 关闭（三键 32 命中） | + 置顶 pin | + 置顶 pin |
| 3D 建筑 | flex:1（约 76px） | flex:1（约 256px） | flex:1（约 374px） |
| 蓝图名 + 进度数字 | 只显示 n/m | 显示 | 显示 |
| 进度条 | 显示 3.5px | 显示 | 显示 |
| 快捷打卡胶囊 | 1 个（最多） | 3 个 | 5 个 |
| 「下一里程碑」/今日清单 | 不显示 | 不显示 | 显示（只读，不可编辑） |

视觉参数全部取自现有令牌（`--surface/--bg/--line/--r-md/--fs-caption/--fs-small/--fs-body`），无新色相、无新阴影——尺寸档本身要先有设计记录（新表面规格）。

#### 1.2.2 存储：两类状态分开

| 状态 | 存哪 | 理由 |
| --- | --- | --- |
| miniWidgetSize / miniWidgetAlwaysOnTop / enableMiniWidget | `AppSettings`（进存档、跟着 WebDAV 合并） | 形态偏好是可迁移的用户设置；合并是 settings 全字段并集，旧客户端会原样透传未知设置键 |
| 主窗尺寸/位置、摆件位置 | **localStorage** `blockhabit.windowLayout.v1`（不进存档） | 屏幕坐标跨设备无意义；换屏后按 workArea 重新钳制（deep-dive 3.1.3 已定） |
| 当前是否处于迷你模式 | 内存（不落盘） | 启动时按 `enableMiniWidget` 决定，避免「上次崩溃在迷你尺寸里」的状态残留 |

localStorage 结构（versioned，读坏回默认）：

    interface WindowLayoutV1 {
      version: 1
      main?: { w: number; h: number; x?: number; y?: number }   // 逻辑像素
      mini?: { x: number; y: number }                            // 逻辑像素（相对屏幕左上）
    }

#### 1.2.3 进入 / 退出流程（显式最小尺寸契约）

进入：

    async function enterMini(size: MiniSize) {
      const win = getCurrentWindow()
      const preset = MINI_PRESETS[size]
      // 0) 记录主窗尺寸（逻辑）+ 位置（物理→逻辑）
      const [outer, scale] = await Promise.all([win.outerSize(), win.scaleFactor()])
      saveLayout({ main: { w: Math.round(outer.width / scale), h: Math.round(outer.height / scale) } })
      // 1) 先放开/收紧到本档最小尺寸，再改尺寸（不依赖隐式行为）
      await win.setMinSize(new LogicalSize(preset.w, preset.h)).catch(() => {})
      await win.setSize(new LogicalSize(preset.w, preset.h))
      // 2) 置顶按设置
      if (inTauri) await win.setAlwaysOnTop(useAppStore.getState().settings.miniWidgetAlwaysOnTop !== false)
      // 3) 位置钳制到当前显示器 workArea（含任务栏）
      const monitor = await currentMonitor()
      const pos = clampMiniPosition(loadLayout().mini ?? defaultBottomRight(monitor, preset), monitor, preset)
      await win.setPosition(new LogicalPosition(pos.x, pos.y)).catch(() => {})
      // 4) 最后锁尺寸，避免用户拖拽改变形态
      await win.setResizable(false)
      useAppStore.getState().updateSettings({ enableMiniWidget: true, miniWidgetSize: size })
    }

退出：

    async function exitMini() {
      const win = getCurrentWindow()
      await win.setResizable(true)
      await win.setMinSize(new LogicalSize(900, 600)).catch(() => {})   // 回到 tauri.conf 的最小尺寸
      const main = loadLayout().main ?? { w: 1100, h: 760 }
      await win.setSize(new LogicalSize(main.w, main.h))
      await win.setAlwaysOnTop(false)
      if (inTauri) await win.setPosition(...).catch(() => {})           // 有记录恢复，无记录 center()
      useAppStore.getState().updateSettings({ enableMiniWidget: false })
    }

要点：

- `setSize` 是 **inner size**（`node_modules/@tauri-apps/api/window.d.ts:1097-1110`），因此档位表就是「内容区尺寸」，decorations:false 下与视觉尺寸差 1px 边框，可忽略。
- `setMinSize` 与 `setPosition` 各需要一条 capability（见 1.2.6）。**权限缺失时必须降级而不是整体失败**：catch 该两条、继续 setSize，并在 DEV 下 warn；用户仍可得到新尺寸，只是位置/最小尺寸约束不生效。
- 顺序不可反：先 setMinSize 再 setSize（否则可能被旧的 900×600 最小尺寸钳住），最后 setResizable(false)。
- 退出时恢复的是「最近一次主窗尺寸」而不是硬编码 1100×760，避免用户拉大过主窗后退出摆件又变小。

#### 1.2.4 多显示器与 DPI

- `Monitor` 有 `position / size / workArea / scaleFactor`，workArea 是物理像素（`node_modules/@tauri-apps/api/window.d.ts:32-76`）。钳制函数统一转逻辑再比较：

      clampMiniPosition(pos, monitor, preset) {
        const wa = monitor ? {
          x: monitor.workArea.position.x / monitor.scaleFactor,
          y: monitor.workArea.position.y / monitor.scaleFactor,
          w: monitor.workArea.size.width / monitor.scaleFactor,
          h: monitor.workArea.size.height / monitor.scaleFactor,
        } : null
        // 无 monitor（被拔掉）→ 用 primaryMonitor() 兜底；仍无 → 不设位置
        const margin = 8
        x = clamp(pos.x, wa.x + margin, wa.x + wa.w - preset.w - margin)
        y = clamp(pos.y, wa.y + margin, wa.y + wa.h - preset.h - margin)
      }

- 小屏降级：可用工作区放不下 display（例如 1024×600 + 任务栏）→ 自动降为 standard，仍放不下 → pocket；只影响本次，不写回设置，用 toast 说明（i18n 新增一条）。
- 拔显示器：Tauri 没有可靠的「显示器移除」事件；策略 = 每次 `enterMini` / 每次 `win.show()`（托盘唤起）时重新 `currentMonitor()` 并钳制；若保存位置落在所有显示器之外，按「离最近显示器 workArea 的边」回吸。
- DPI 变化：监听 `win.onScaleChanged`（typings 有 ScaleFactorChanged）→ 重新钳制 + 让 BuildScene 自己处理画布（已有 resolution MQ 补偿，`BuildScene.tsx:579-596`）。
- 摆件拖拽：`data-tauri-drag-region` 拖动会触发 `tauri://move` 事件；节流 300–500ms 写 localStorage（不要每次 move 都写盘）。只在迷你模式记录，否则会把主窗移动也写进 mini 位置。

#### 1.2.5 窗口按钮 / 关闭 / 托盘交互

| 动作 | 现状 | 三档方案 |
| --- | --- | --- |
| 展开 | 顶栏 expand 按钮 → toggleMini(false)，居中 | 保留按钮（32×32 命中）；恢复主窗尺寸与位置；**不做双击展开**（与系统 drag-region 双击最大化冲突，见风险） |
| 置顶 | 恒 true | pin 开关（仅 standard/display 显示，pocket 从设置生效），写回 `miniWidgetAlwaysOnTop` |
| 关闭 X | 先退出迷你再 hide 到托盘 | 不变；退出迷你 = 恢复主窗尺寸/位置后 hide |
| Alt+F4 / 系统关闭 | 拦截 → handleWindowCloseRequest → 同上 | 不变（mini 下先 exitMini） |
| 托盘左键 | show + unminimize + focus | 不变（关闭时已回主窗形态） |
| 托盘右键 | 打开/退出菜单 | 不变 |
| 退出应用 | 托盘菜单 → flush 握手 → 退出 | 不变；摆件不新增退出入口 |

另外修平一个语义缺口：目前「手动进入摆件」不写 `enableMiniWidget:true`。A1 里让 enterMini 写 true、exitMini 写 false，使「手动进入 → 重启仍在摆件」符合直觉；「关闭收托盘」是否也算退出摆件需 Lead 拍板（§11 决策 6）。

#### 1.2.6 需要新增的 capability（不是依赖，但需记录 + 审批）

在 `src-tauri/capabilities/default.json` 的 permissions 追加两条：

    "core:window:allow-set-min-size",
    "core:window:allow-set-position"

- 最小权限原则：只加这两条，不动 fs/opener/http。
- 拒绝时行为：位置不恢复、最小尺寸不收紧（尺寸仍可切换），DEV warn + 设置页提示「当前构建不允许记忆窗口位置」。
- 若同时要做 A4 的「打开导出文件夹」，还需 `fs:allow-write-file` 与 `opener:allow-open-path`（见 A4），可合并成一次 capabilities 变更评审。

#### 1.2.7 Tauri 配置是否需要改

- **不需要**改 `tauri.conf.json` 的窗口尺寸/最小尺寸：最小尺寸由运行时 setMinSize 控制，配置里的 900×600 继续作为主窗下限。
- 若要把摆件做成「圆角透明小窗」：需要 main 增加 `transparent:true` + 透明 backgroundColor；Windows/WebView2 下透明窗口有已知限制（阴影、拖动、点击穿透），且属于视觉决定 → 默认不做，单独记录评估。
- 若要「开机自启即摆件」：已有 autostart 插件，进入逻辑走 `enableMiniWidget`，无需配置改动。

#### 1.2.8 涉及文件

新增：

- `src/platform/miniWindow.ts`（presets / clamp / layout localStorage 读写；纯逻辑）
- `src/platform/miniWindow.test.ts`
- （可选）`src/components/MiniSizePicker.tsx`：设置页三档缩略选择器；若不想拆文件，先内联在 SettingsDialog 的迷你件组

修改：

- `src/App.tsx`：toggleMini → enterMini/exitMini；close 流程；启动自动进入；写回设置；监听 move/scale-change 保存位置
- `src/components/MiniDeskToy.tsx`：新增 `size: MiniSize` prop，按档位渲染与裁剪；32px 命中区；pin 开关（optional）
- `src/components/SettingsDialog.tsx`：迷你件组增加三档 seg + 置顶 seg（若要减负，同时把这组抽成子组件）
- `src/types.ts`：AppSettings 加 2 个可选字段
- `src/storage/adapter.ts`：normalizeState 里加枚举/布尔归一化
- `src/i18n/types.ts` + `src/i18n/locales/zh.ts` + `en.ts`：新增 settings.miniWidgetSize* / alwaysOnTop*
- `src-tauri/capabilities/default.json`：2 条窗口权限
- `src/App.test.tsx`：getCurrentWindow mock 增加 setMinSize/setPosition/setResizable/setAlwaysOnTop/isMaximized/onResized 等；断言 enter/exit 调用顺序
- `src/components/MiniDeskToy.test.tsx`：三档渲染差异

#### 1.2.9 工作量

**S–M，2–3 人日**：窗口状态机与权限 0.5–1 人日；三档布局与裁剪 1 人日；设置项 + i18n + normalize 0.3；测试 0.3；真机 DPI/多屏走查 0.5（不可压缩，必须真机）。

#### 1.2.10 风险

| 风险 | 级别 | 触发条件 | 缓解 / 验证 |
| --- | --- | --- | --- |
| 最小尺寸钳制让 setSize 无效（260×380 变 900×600） | 中 | 升级 Tauri/tao，或改为 setSizeConstraints 之后 | 显式 setMinSize(preset) 先于 setSize；真机量 `innerSize()` 断言等于 preset；单测只测顺序，真机测结果 |
| 权限未批导致位置/最小尺寸不生效 | 低 | capabilities 未加两条 | catch 降级 + DEV warn；设置页提示；不要静默全吞 |
| 多显示器恢复跑出可视区（拔屏/缩放变化） | 中 | 拔掉副屏、改缩放、任务栏自动隐藏 | 每次 show/enter 重新钳制；单测覆盖 clamp 边界；真机拔屏 |
| 双击标题与系统最大化冲突 | 中 | Windows drag region 双击 | 不做双击，保留显式按钮；或在非 drag 区域做；真机验证 |
| 内容裁切（pocket 150px） | 中 | 长习惯名、CJK 字重、150% DPI | 每档 layout 预算 + ellipsis + DEV 断言；四主题 + zh/en 截图 |
| 透明/圆角视觉决定悬空 | 低 | 用户看到方角 | 默认不透明；如要透明单独立设计记录 |
| lazy chunk 首帧空白/闪变 | 低 | 首次进入摆件 | 空闲时预加载 MiniDeskToy chunk；或用 Suspense fallback 画一个同尺寸骨架 |
| 关闭收托盘 vs 启动进入摆件的语义歧义 | 低 | 用户关掉摆件后重启仍在摆件（或反之） | 明确 `enableMiniWidget` 语义并写进设置提示；Lead 拍板（§11 决策 6） |

#### 1.2.11 测试与验收

单测（vitest）：

- `miniWindow.test.ts`：三档 layout 预算不变量；`clampMiniPosition` 正常/负坐标/超宽/超高/无 monitor/显示器被拔；`loadLayout/saveLayout` 坏 JSON、缺字段、版本不匹配回默认；`resolveMiniSize`（未知字符串 → standard）。
- `App.test.tsx`（扩展 mock）：进入迷你 → 断言 `setMinSize(preset)` 先于 `setSize(preset)`，`setAlwaysOnTop(true)` 按设置，`setResizable(false)` 最后；退出 → 顺序相反且 `setMinSize(900,600)`；关闭请求在迷你态先 exit 再 hide。
- `MiniDeskToy.test.tsx`：pocket 不渲染进度文本/多胶囊；display 渲染 5 个；三档都渲染 canvas；按钮命中尺寸断言（style width/height ≥32）。

手工验收（必须真机 `npm run tauri dev`）：

1. 100% / 125% / 150% 缩放下三档无文字裁切、无横向滚动；窗口实际 innerSize 等于档位。
2. 双屏：摆件拖到副屏，重启后位置仍在副屏可视区；拔掉副屏后从托盘唤起 → 回主屏可视区（或降档）。
3. 置顶开关开/关：切换后覆盖其他窗口 / 允许被覆盖；重启保持。
4. 展开 → 恢复主窗原尺寸与位置；关闭 → 收托盘；托盘左键 → 主窗正常；托盘退出 → 正常退出且存档已 flush。
5. 快捷键 / 键盘：仅鼠标交互验证（摆件无键盘需求）；reduced-motion 下无动画。
6. 四主题截图 + zh/en 文案无溢出。

门禁：`npx tsc --noEmit`、`npm test`、`npm run design:check` 全绿。

#### 1.2.12 能否不改数据 schema

**不升 schemaVersion，但 AppSettings 会增加 2 个可选字段**（miniWidgetSize / miniWidgetAlwaysOnTop）。旧档缺字段由 normalizeState 补默认；旧客户端读到新字段会原样透传（settings 整体持久化 + 合并并集）；摆件窗口位置只进 localStorage，不进存档。

---

## 2. A2 落成年鉴

### 2.1 现状事实

- 统计页只有「指标 + 13 周热图 + 手账长廊」两视图 + 月度画报入口，**没有年度维度**（`src/pages/Stats.tsx:28,174-200,301`；`Heatmap` 默认 13 周，`src/components/Heatmap.tsx:33`）。
- 月度画报只画**当月 + 当前在建蓝图**（`src/components/MonthlyPosterModal.tsx:41-45,136-140`），不能切历史月/历史建筑；导出是单页 PNG（`:377-386`）。
- 拍立得是单座建筑的纪念卡（`src/components/PolaroidModal.tsx:34-73`），含时间轴/铭言；与年鉴是「专辑 vs 总览」的关系。
- `completedBlueprintIds` 只是「完成集合」，**数组顺序不是落成顺序**：合并时 `Array.from(completedSet).filter(...).sort()` 会按 id 字母序重排（`src/sync/merge.ts:263-270`）。→ 建筑落成年份/顺序**只能从 builds.placedAt 推导**，不能依赖数组顺序。
- 可派生性结论（逐页）：

| 年鉴页签 | 内容 | 数据来源 | 可派生？ | 备注 |
| --- | --- | --- | --- | --- |
| 封面 | 年份、第 N 年、当年落成建筑剪影、一句数据生成的话 | builds + completedBlueprintIds + checkIns | ✓ | 剪影用已落成蓝图的等距缩略图/剪影 |
| 这一年 | 打卡数、积木数、落成数、全勤天数、最长连击、专注小时、随笔数 | checkIns / builds / dayClaims / habits | ✓ | 最长连击需新增「按年切片」的 streak 计算（现有 `currentStreak/bestStreak` 是跨年全局） |
| 十二个月 | 12 个月热图（灰阶）、全勤日、最长连击段 | checkIns + habits | ✓ | 复用 `dayCompletionRatio`（`src/logic/checkin.ts:127-132`，空日返回 -1） |
| 建筑年表 | 每座落成日期 + 等距缩略图 + 铭言 | builds.placedAt + foundationNotes | ✓ | 落成日 = 该 blueprint 块数达容量时的 max(placedAt) |
| 时间形状 | 最常打卡时段、最常星期、Top3 习惯 | checkIns.at / checkIns.date / habits | ✓（有时区限制） | at 是 ISO UTC，按时段聚合需用当前设备本地时区还原；跨时区旅行会让历史时段漂移（诚实限制，不做补偿） |
| 一句话 | 从当年随笔里按规则挑一条 | checkIns.note/starred | ✓ | 规则：starred 优先 → 最长 → 最早；署名习惯名 |
| （修复砖） | 年度修复砖使用数 | repairBricks | **✗** | 只有当前库存，无发放/消耗历史；建议年鉴不出现修复砖，避免假事实 |

- 时间口径：checkIns.date / dayClaims.date 已是本地日期键 `YYYY-MM-DD`；builds.placedAt 是 ISO UTC，必须 `dateKey(new Date(placedAt))` 转本地再取年份（画报已经这么做：`MonthlyPosterModal.tsx:286`）。
- 空年份：没有可展示数据 → 空态；**不生成任何伪造数字**（AGENTS 硬约束 5 / A6）。
- 性能：实测单年聚合 0.2–0.6ms（§0.2），年鉴逻辑层不是瓶颈；瓶颈在画布绘制与字体。
- 字体：全仓库没有 `document.fonts.ready`（grep 为空），画报导出未等待字体 → CJK 缺字/字重回退风险。
- 调色板：画报用主题调色板（`paletteFromDocument`），相纸用固定硬编码色板（`PolaroidModal.tsx:114-122`）。年鉴必须二选一并在设计记录里写明（建议：主题调色板 + 固定纸底，与画报一致）。

### 2.2 是否需要新字段

**不需要。** 七个页签全部可从现有 AppState 派生，零改动类型。两个想显示但不可派生的点按「不做/降级」处理：

- 修复砖年度使用量 → 不做（无历史）。
- 年鉴「已读/角标已消费」→ 设备本地 localStorage（`blockhabit.yearbookSeen.v1`），不进存档（跨设备各看一次无伤大雅）。

如果未来要做「年鉴收藏/用户署名/年度精选记忆」才需要新字段；其中「精选记忆」可以直接复用 CheckIn.starred，仍不需要新字段。

### 2.3 纯逻辑模块建议（new: `src/logic/yearbook.ts`）

    export interface YearbookStats {
      checkIns: number
      blocks: number
      completedBuildings: number
      perfectDays: number            // dayClaims（去墓碑）
      focusMinutes: number
      notes: number
      longestStreak: number
    }

    export interface MonthBucket {
      month: number                  // 1..12
      days: Array<{ key: string; ratio: number; future: boolean }>
      checkIns: number
      perfect: boolean[]             // 可选：哪些天全勤
    }

    export interface BuildingEntry {
      blueprintId: string
      completedAt: string | null     // 本地日期键；无法判定时 null
      firstPlacedAt: string | null
      days: number | null            // 首块→落成 的日历天数
      blocks: number
      foundationNote?: string
    }

    export interface YearbookModel {
      year: number
      stats: YearbookStats
      months: MonthBucket[]
      buildings: BuildingEntry[]
      timeShape: { peakHour: number | null; peakWeekday: number | null; topHabits: Array<{ habitId: string; name: string; count: number }> }
      quote: { text: string; habitName: string; date: string } | null
      hasData: boolean
    }

    export function availableYears(state: AppState): number[]
    export function buildYearbook(state: AppState, year: number, now?: Date): YearbookModel
    export function yearbookSummaryText(model: YearbookModel, lang: Language): string   // aria-label + Markdown 导出共用

    // 内部纯 helper（可独立导出给 B3 复用）
    export function completionDateOf(state: AppState, blueprintId: string): string | null   // max(placedAt) → 本地日期键
    export function yearStreak(habit: Habit, checkIns: CheckIn[], year: number): { longest: number; current: number }

关键规则（都要单测）：

1. 只统计 `!deletedAt` 的 checkIns；dayClaims 用 `deletedDayClaims` 按「claimedAt vs deletedAt 谁更晚」过滤（与 merge 同口径）。
2. 年份归属：checkIns/dayClaims 用 date 前缀；builds 用本地 dateKey(placedAt) 前缀。
3. 专注小时只累加 `actualMinutes`（不把 `targetMinutes` 当事实，避免「目标即完成」的假数据）。
4. 落成：按 `BLUEPRINT_CAPACITY`（已有，`src/logic/builds.ts:13-16`）判断块数达标 → 取 max(placedAt)；`completedBlueprintIds` 有但块数不足（旧档/撤销）→ completedAt 记 null 并在 UI 标「落成时间不可考」，不伪造年份。
5. 闰年：每月天数用 `new Date(year, month, 0).getDate()`（画报已用同法，`MonthlyPosterModal.tsx:81`）。
6. Top3 习惯按当年打卡数排序；并列按 habit.createdAt 升序（稳定、可复现），不做评分。
7. 空年份：hasData=false，所有数组为空，UI 走空态。
8. 排序稳定性：所有 Map/Set 遍历结果转数组后显式排序，避免不同引擎顺序差异导致画布快照抖动（测试会更稳）。

测试文件：`src/logic/yearbook.test.ts`（deep-dive 3.2.7 要求：空数据/部分年份/跨年/墓碑/闰年/时区边界/Top 习惯并列/随笔规则）。约 15–18 个用例。

### 2.4 画布复用方案（这是 A2 的主要工作量）

#### 2.4.1 先抽「模型舞台」：new `src/render/modelStage.ts`

现状是同一段算法在 3 处复制（画报 `MonthlyPosterModal.tsx:141-210`、相纸 `PolaroidModal.tsx:135-182`、图鉴 `BlueprintThumb.tsx:42-96`）：算屏幕包围盒 → 求 scale/pan → drawGroundBase → 画家排序 → drawCube（含 noStuds / bonus / spriteScale）。建议抽成：

    export interface StageViewport { x: number; y: number; w: number; h: number }
    export interface StageOptions {
      blocks: BlockDef[]
      palette: Palette
      viewport: StageViewport
      pad?: number              // 默认 30
      maxScale?: number         // 默认 1.5（与现有画报一致）
      maxZ?: number             // 只画前 N 块（在建进度），undefined = 全模型
      bonusByIndex?: boolean[]
      spriteScale?: number      // 导出固定 2
      groundBase?: boolean
    }
    export function measureModelScreenBounds(blocks, cfg): { minX; maxX; minY; maxY }
    export function fitModelScale(bounds, viewport, pad, maxScale): { scale; panX; panY }
    export function drawModelStage(ctx: CanvasRenderingContext2D, opts: StageOptions): void

收益：A2、A4、B3 的「建筑缩略图 / 封面剪影 / 档案卡大图」都只调用它；三处旧复制改调用后视觉**必须零回归**（用现有四主题像素 diff 流程验收）。

#### 2.4.2 new `src/render/yearbookCanvas.ts`

- 输入 `YearbookModel` + 主题 token 快照（getComputedStyle 读一次）+ 可选尺寸档。
- 建议尺寸：单页 1080×1440（3:4，@2x 绘制，CSS 尺寸 540×720）或 A4 竖版 1240×1754；**不做超长拼图**（deep-dive 3.2.5 已否掉 12 屏拼接）。
- 版面：封面/标题区 → 统计 4–6 格 → 12 月热图网格（月份 × 天，或 4×3 小月历）→ 建筑年表条（缩略图调用 modelStage）→ 时间形状 → 引言 + 页脚。
- 颜色：**一律用解析后的 hex/rgba**（实测 canvas 不支持 var()；color-mix 在新 Chromium 可用但不是所有 WebView2 版本，见 §0.2）。
- 字体：绘制前 `await document.fonts.ready` + 等一帧 rAF；字重 400/500/600/700，字族沿用令牌。
- 导出：`canvas.toBlob` 优先（比 toDataURL 少 33% 内存）；复制走 `ClipboardItem`，失败降级下载。

#### 2.4.3 new `src/components/YearbookModal.tsx`

- 结构：`.overlay + .dialog`（宽 760，桌面）→ 左侧年份 tablist（有数据的年份，降序）+ 右侧 canvas 预览（等比缩放，最大 720 宽）+ 底部按钮 [保存图片][复制][导出 Markdown][关闭]。
- 空态：无任何年份 → 一句「还没有落成」类文案 + 关闭（不显示空白画布）。
- 无障碍：年份 tablist 支持左右键；canvas 加 `aria-label={yearbookSummaryText(...)}`；按钮有可访问名。
- 复用 `useDialogA11y`（Esc/焦点陷阱，`src/components/useDialogA11y.ts`）。
- 移动端：先不做画布（`isMobile` 显示「桌面端查看年鉴」提示），避免在手机上加一个重画布入口。

### 2.5 涉及文件

新增：

- `src/logic/yearbook.ts`、`src/logic/yearbook.test.ts`
- `src/render/modelStage.ts`、`src/render/modelStage.test.ts`
- `src/render/yearbookCanvas.ts`
- `src/components/YearbookModal.tsx`、`src/components/YearbookModal.test.tsx`（轻量：空态/年份切换/按钮存在）
- `design/records/D-20261110-060-*.md`（如 Lead 未落）→ 必须先有记录

修改：

- `src/pages/Stats.tsx`：右上入口按钮 + 已读角标 + Modal 挂载
- `src/components/MonthlyPosterModal.tsx` / `PolaroidModal.tsx` / `BlueprintThumb.tsx`：改用 modelStage（视觉零回归）
- `src/i18n/types.ts` + zh/en：`t.yearbook.*`（title/yearTab/empty/save/copy/markdown/stats labels/aria 模板…）
- `src/platform/guideTips.ts`（可选）：年鉴首次角标

### 2.6 工作量

**S–M，3–5 人日**：yearbook 纯逻辑 0.5–1；modelStage 抽取 + 三处回归 1；yearbookCanvas 版面 1.5–2；Modal + i18n + 入口 0.5；测试与四主题截图 0.5。

### 2.7 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| 画布 CJK 缺字/字重错 | 中 | 首次导出时字体未加载 | 绘制前 await fonts.ready + rAF；四主题 + zh/en 截图；回退字族已有 |
| modelStage 抽取造成画报/相纸视觉回归 | 中 | 三处算法细节不同（pad/maxScale/0.54 基准线） | 抽取时把差异参数化；改前后同数据四主题像素 diff 0 |
| 年鉴与月度画报定位重叠 | 低 | 用户不知道点哪个 | 文案明确「月度=过程，年度=总结」；入口并列 |
| 「年份/落成时间」口径被误读 | 中 | 旧档块数不足/撤销导致无法判定 | UI 明确「不可考」；不推算假日期 |
| 长画布内存/导出慢 | 低 | 用户选超大尺寸 | 固定两档尺寸；toBlob；禁止超长拼图 |
| 文案越界成评价 | 低 | 追求「Wrapped 感」 | 规则模板 + VOICE 审核；只陈述事实 |

### 2.8 测试与验收

- `yearbook.test.ts`：空年份、单年、跨年、闰年 2 月、墓碑排除、dayClaims 墓碑、落成日推导、块数不足的旧档、Top3 并列、随笔挑选、availableYears 排序、hasData。
- `modelStage.test.ts`：包围盒含 stud 顶部/块底；fit scale 上限；只画前 N 块；画家排序稳定性（同数据两次结果一致）。
- 画布：jsdom 环境用 stub ctx 断言「调用了哪些绘制原语 + canvas 物理尺寸 = CSS×2 + fonts.ready 被 await」；**不做像素断言**。真机/浏览器四主题截图人工比对。
- 性能：用 3 年真实形态数据（1000 打卡 / 1385 块）断言 `buildYearbook` < 50ms（实测 0.22ms，留足余量）；首次打开 Modal 到 canvas 可交互 < 200ms。
- 导出：PNG 尺寸正确、文件名含年份、复制失败降级下载；Markdown 脱离应用可读；空年份不生成文件。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 2.9 能否不改数据 schema

**能，零字段改动。** 年鉴全部由现有 AppState 派生；「已读」标记在 localStorage。

---

## 3. A3 WebDAV 预设 + 分步自检

### 3.1 现状事实

- 设置页 WebDAV 组是「手填 endpoint / 用户名 / 密码 + 自动同步 + 立即同步 + 一行状态」，没有预设、没有测试连接、没有分步诊断（`SettingsDialog.tsx:755-874`）。
- 错误码 6 种（auth/network/conflict/no-collection/http/cors），映射到 i18n 人话（`src/sync/webdav.ts:9`；`SettingsDialog.tsx:136-151`）；CORS 被误报为网络错误已修（`isLikelyCors`，`webdav.ts:16-20`）。
- 明文 `http://` 端点会被 CSP 拦掉（`tauri.conf.json:40` 的 connect-src 只有 https:/wss:），用户看到的可能是 CORS/网络类错误（审计 C24）。`getSyncUrl` 只对**无协议**的输入补 https://，显式写 http:// 会保留（`webdav.ts:33-44`）。
- 凭据在 localStorage 键 `blockhabit_webdav_config`，密码明文，表单 800ms 防抖落盘（`useSync.ts:9,28-46,97-107`）；不随「导出数据」导出、不进 WebDAV 同步文件（这点是对的，但用户不知道）。
- 可直接复用的请求层：`httpFetch`（桌面原生 HTTP 绕 CORS，浏览器 fetch 回落，`src/platform/http.ts:11-23`）、`getSyncUrl`（URL 规范化）、`encodeUrlPath`（路径段编码，**未导出**）、`getAuthHeaders`（UTF-8 Basic，`webdav.ts:68-89`）、`WebDavError` 与 `isLikelyCors`。
- 测试现状：`webdav.test.ts` 用 stub global fetch 覆盖状态码分支；`webdav.e2e.test.ts` 起本地 HTTP 服务器模拟 WebDAV 语义（GET/PUT/If-Match/PROPFIND/MKCOL）。→ 诊断模块完全可以沿用「注入 transport」的写法做单测。
- 请求超时：GET 15s / PUT 30s（`webdav.ts:4-5`），用 `AbortSignal.timeout`。plugin-http 的 fetch 还支持 `connectTimeout`（`@tauri-apps/plugin-http` 的 ClientOptions，typings 第 65 行），可用于让「连不上」更快失败。

### 3.2 presets 结构（new: `src/sync/providers.ts`，纯数据 + 纯函数）

    export type ProviderId = 'nextcloud' | 'jianguoyun' | 'synology' | 'generic'

    export interface WebDavProvider {
      id: ProviderId
      /** i18n 键名（名称/提示/帮助都走 t.webdavProviders.*，不硬编码文案） */
      requiresAppPassword: boolean
      /** 从 base（域名或完整 URL）+ username 生成集合 URL（不含同步文件名） */
      buildEndpoint(input: { base: string; username: string }): string
      /** 该服务商的填写提示 i18n key */
      hintKey: string
    }

    export const WEBDAV_PROVIDERS: Record<ProviderId, WebDavProvider>

    /** 把用户输入规范化为「集合 URL」：补协议、去 query/hash、保证尾斜杠、路径段编码 */
    export function normalizeCollectionUrl(raw: string): string
    /** 从集合 URL 推导同步文件 URL（复用 getSyncUrl 的 .json 直通语义） */
    export function collectionToSyncUrl(url: string): string

四种预设的 endpoint 生成（建议值，需在实现时对照服务商官方文档再核一次）：

| id | 名称 | endpoint 生成 | 必须提示 |
| --- | --- | --- | --- |
| nextcloud | Nextcloud | `{base}/remote.php/dav/files/{username}/BlockHabit/` | 必须用「应用密码」（2FA 下登录密码无效）；用户名要 URL 编码 |
| jianguoyun | 坚果云 | `https://dav.jianguoyun.com/dav/BlockHabit/` | 必须用「第三方应用密码」；base 固定（只填账号） |
| synology | 群晖 WebDAV | `{base}/home/BlockHabit/`（套件路径可改；base 含端口，如 https://nas:5006） | 需在套件中心启用 WebDAV Server；自签证书会失败 |
| generic | 通用 WebDAV | 用户手填完整集合 URL | 目录必须已存在；尾斜杠/编码由我们规范化 |

结构要点：

- 只存 `providerId + base + username`，**不存密码副本**；切换预设时清空旧 endpoint 并提示（避免「看起来切了其实还在连旧地址」）。
- `WebDavConfig` 增加可选字段 `providerId?: ProviderId`（localStorage 内的配置结构，不是 AppState schema，不需要迁移；读不到就当 generic）。
- Nextcloud 的 endpoint 含 username → 改用户名要重新生成 endpoint（UI 上把 base 与 username 分开，endpoint 由两者派生，而不是让用户直接编辑全 URL）。
- 预设不联网、不探测（deep-dive 已否掉自动探测）。

### 3.3 诊断阶段（new: `src/sync/diagnose.ts`）

设计成「阶段计划 + 可注入 transport + 结果归类」，纯逻辑可测：

    export interface DiagnoseTransport {
      request(input: { url: string; method: string; headers: Record<string, string>; body?: string; timeoutMs: number }): Promise<{ status: number; headers: Record<string, string>; body: string }>
    }

    export type DiagnoseStageId = 'normalize' | 'tls' | 'auth' | 'read' | 'write' | 'delete'

    export interface DiagnoseStageResult {
      id: DiagnoseStageId
      status: 'pass' | 'fail' | 'skip' | 'warn'
      /** 人话 i18n key（如 webdav.diagnose.errors.tlsUntrusted） */
      messageKey: string
      /** 脱敏后的详情（允许复制给服务商排障，绝不包含密码） */
      detail?: string
      httpStatus?: number
      elapsedMs: number
    }

    export interface DiagnoseResult {
      ok: boolean
      stages: DiagnoseStageResult[]
      /** 供 UI 展示的下一步建议 key */
      nextStepKey?: string
      /** 临时文件是否已清理（false 时给出手动清理路径） */
      cleanedUp: boolean
    }

    export async function diagnoseWebDav(config: WebDavConfig, transport?: DiagnoseTransport): Promise<DiagnoseResult>

阶段与请求（每步 10s 超时、可取消、串行）：

| # | 阶段 | 请求 | 通过 | 失败归类 |
| --- | --- | --- | --- | --- |
| 1 | normalize | 纯函数：`normalizeCollectionUrl` | 得到合法 http(s) URL 且主机非空 | not-a-url / no-host / not-https（warn：明文不推荐，见下） |
| 2 | tls | `PROPFIND` 集合 URL，Depth:0（不带或带 Auth 都可） | 2xx/207 | 证书/握手失败 → tls（按错误文本归类）；连接超时 → timeout；DNS 失败 → dns |
| 3 | auth | 同 URL，带 Basic Auth | 2xx/207 | 401 → auth；403 → forbidden；405 → method-not-allowed（提示换通用服务器/权限） |
| 4 | read | 用同步文件 URL GET | 200（读到文件，校验 JSON 可解析）或 404（文件尚不存在=正常） | 401/403 同上；5xx → server-error；非 JSON → warn（不阻断） |
| 5 | write | PUT `blockhabit-diagnose-<ts>-<rand>.json`（极小 JSON） | 201/204 | 507 → quota；405 → method-not-allowed；409 → no-collection（父目录不存在）；412 → conflict |
| 6 | delete | DELETE 该临时文件 | 2xx/204/404 | 失败 → warn + 给出手动清理文件名（不把「删不掉」判成整体失败） |

实现细节：

- **TLS/DNS 只能启发式**：JS 侧拿不到结构化错误（plugin-http 抛的是字符串化的 Rust 错误）。`classifyTransportError(err)` 按关键词归类（certificate / invalid peer certificate / tls / handshake / dns / lookup / connection refused / timeout / timed out / network），命中不了归 `unknown-network` 并原样展示脱敏 message。**不要假装比实际更精确**。
- 浏览器环境：只显示「浏览器受跨域限制，请用桌面端测试」，**不发起任何请求**（与 deep-dive 一致）。
- `http://` 端点：现状会被 CSP 拦；建议在 normalize 阶段直接判 `not-https` 并 fail，文案说明「桌面端只允许 https（CSP 限制）；如需自建 http，请改用导出/导入」。**不要**为了让 http 能用去改 CSP（安全面变宽，需单独评审）。
- 临时文件命名带时间戳 + 随机串；测试用 transport 注入，真实调用走 `httpFetch` + `getAuthHeaders`。
- 结果只读不写正式同步文件；失败不影响现有自动同步配置（诊断后不自动启用同步）。

### 3.4 复用哪些现有函数（明确清单）

| 复用什么 | 位置 | 怎么复用 |
| --- | --- | --- |
| `httpFetch` | `src/platform/http.ts:11-23` | 真实 transport 的底层 fetch；桌面绕 CORS |
| `getAuthHeaders` | `src/sync/webdav.ts:81-89` | 生成 Basic 头（含 UTF-8 base64） |
| `getSyncUrl` / `encodeUrlPath` | `webdav.ts:33-66` | 同步文件 URL 推导；**encodeUrlPath 目前是私有函数，需要导出或抽到 `src/sync/url.ts`** |
| `WebDavError` 的码表 | `webdav.ts:9,22-31` | 诊断结果映射到既有 UI 文案（新增码见 3.5） |
| `isLikelyCors` | `webdav.ts:16-20` | 判断「浏览器跨域」并给出桌面端提示 |
| `isTauriRuntime` | `src/platform/http.ts:12-14` | 浏览器直接跳过诊断 |
| 设置页错误文案模式 | `SettingsDialog.tsx:136-151` | 诊断阶段结果同样走 i18n key 映射，不拼英文 |
| 测试写法 | `src/sync/webdav.test.ts` / `webdav.e2e.test.ts` | stub transport（同 stub fetch 思路） |

### 3.5 错误码 → 人话映射

现有 6 码保留；诊断与同步共用一套扩展码（新增到 `WebDavErrorCode` 或诊断专用枚举，建议后者，避免影响 `syncErrors` 既有语义）：

| 码 | 触发 | 人话方向（i18n） | 下一步 |
| --- | --- | --- | --- |
| not-a-url / no-host | 输入不规范 | 地址不完整 | 用预设或填完整域名 |
| tls | 证书/握手失败 | 证书不受信任或 TLS 版本不匹配 | 自签证书需换受信任证书；不要建议关校验 |
| dns | 域名解析失败 | 找不到服务器 | 检查域名拼写/网络 |
| timeout | 连接/请求超时 | 服务器无响应 | 检查端口/防火墙/服务是否启动 |
| auth | 401 | 用户名或应用密码错误 | 去服务商后台创建「应用密码」；2FA 下登录密码无效 |
| forbidden | 403 | 账号无权限 | 检查目录权限/只读挂载 |
| no-collection | 404/409 目录不存在 | 目录不存在 | 先在网盘里创建 BlockHabit 目录，或换路径 |
| method-not-allowed | 405 | 服务器不允许该操作 | 换通用预设/检查 WebDAV 是否启用 |
| quota | 507 | 空间不足 | 清理网盘或换目录 |
| server-error | 5xx | 服务器内部错误 | 稍后重试/联系服务商 |
| unknown-network | 其它 | 未能识别的网络错误 | 复制脱敏详情 |

i18n：`t.settings.webdav.diagnose.*`（阶段名、错误、下一步、复制详情、清空凭据），zh/en 同步。

### 3.6 凭据在 localStorage 的风险与缓解（不引入 keyring）

风险（如实写在 UI 提示里）：

1. 明文存储：同一台机器上，任何能读到 WebView2 用户数据目录（`%LOCALAPPDATA%\...\EBWebView`）的进程/人都能拿到密码；浏览器 dev 模式下就是 localStorage。
2. 应用内脚本可读：CSP 已限制 script-src 'self'（无 inline/无外部），降低 XSS 面，但不能证明为零。
3. 备份/漫游：若用户把浏览器 profile 或系统漫游目录纳入备份，密码随之备份到别处。
4. 共享电脑：其他 Windows 用户若可访问同一用户目录（或未加密磁盘），密码可被读取。
5. 密码会随「内存快照/崩溃转储」存在（诊断包已不含密码——需保持这一点，并在代码里加断言）。

不引入依赖的缓解（按优先级）：

1. **只推荐应用专用密码**：预设文案强制提示；Nextcloud/坚果云/群晖都支持可撤销的应用密码。README/设置页说明「仅用于同步，可随时在服务端撤销」。
2. **「不保存密码」选项**：`WebDavConfig` 加 `rememberPassword?: boolean`（默认 true，保持现状）；false 时 `saveWebDavConfig` 前剥掉 password、只在内存保留 → 重启后不自动同步（auto-sync 需要凭据，UI 明示「重启后需重新输入」）。这是零依赖下最有效的降险。
3. **清除凭据按钮**：一键删 localStorage 键 + 清内存 config（已有 saveWebDavConfig，加一个 remove），并提示「不会删除云端数据」。
4. **不回显**：读回配置时 password 输入框不显示已保存值（只显示占位符「已保存（不回显）」）；需要修改才重填。这能减少旁人窥屏与 DOM 抓取面。
5. **诊断详情脱敏**：`sanitizeDetail()` 移除 URL userinfo、Authorization 头、password 字段；单测断言结果字符串不含密码。
6. **不导出**：导出数据/档案包/诊断包里永不包含 WebDAV 配置（现已如此，A4 也要保持 + 测试）。
7. 文档层面：把「密码存本机明文」写进设置页 hint 与 README 的安全说明，不藏着（A7 诚实原则）。

不做（本轮）：keyring/stronghold（需新依赖）、OAuth（WebDAV 无统一协议）、自动探测服务商。

### 3.7 涉及文件

新增：

- `src/sync/providers.ts` + `providers.test.ts`
- `src/sync/diagnose.ts` + `diagnose.test.ts`
- （可选）`src/sync/url.ts`：从 webdav.ts 抽出 getSyncUrl/encodeUrlPath 供诊断复用，避免 webdav.ts 继续膨胀
- `src/components/WebDavDiagnosePanel.tsx`（设置页子组件；SettingsDialog 已 953 行，建议外置）

修改：

- `src/sync/types.ts`：WebDavConfig 加 `providerId?`、`rememberPassword?`
- `src/sync/useSync.ts`：`saveWebDavConfig` 支持剥离密码；新增 clearCredentials；导出 provider 字段透传
- `src/sync/webdav.ts`：导出 encodeUrlPath 或改引用 url.ts（行为不变）
- `src/components/SettingsDialog.tsx`：WebDAV 组改造（预设 seg + 测试连接按钮 + 分步结果列表 + 清除凭据）
- `src/i18n/types.ts` + zh/en：`t.settings.webdav.*` 扩展 + `t.webdavProviders.*` + `t.settings.syncErrors.*` 新码
- `design/records/`：设置页结构变更需记录

### 3.8 工作量

**S–M，2–3 人日**：providers 0.3；diagnose + 归类 + 脱敏 0.8–1；设置页 UI 0.8；i18n 0.2；测试 0.5（含 mock transport 覆盖 200/401/403/404/405/507/超时/TLS 文本）。

### 3.9 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| TLS/DNS 归类不准，给出误导性「下一步」 | 中 | 各平台/Rust reqwest 错误文本不同 | 只归类高置信关键词；归类不出就显示 unknown-network + 原始脱敏 message；文档标注限制 |
| http:// 端点永远失败（CSP） | 中 | 局域网自建 WebDAV | normalize 阶段直接判 not-https 并给明确文案；不改 CSP |
| 预设路径随服务商改版失效 | 中 | Nextcloud/群晖路径变化 | 预设只拼 base，路径可被用户编辑；「通用」永远可用 |
| 密码明文存储争议 | 中 | 安全审计/用户质疑 | rememberPassword 开关 + 不回显 + 清除按钮 + 文案诚实 + keyring 单独立项 |
| 诊断临时文件残留 | 低 | DELETE 失败/网络中断 | 文件名带前缀+时间戳，结果里给出手动清理名；下次诊断先尝试清理旧前缀文件（可选） |
| 请求头/详情泄露敏感信息 | 低 | 详情进剪贴板 | sanitizeDetail + 单测断言不含 password/Authorization |
| 诊断耗时让用户以为卡住 | 低 | 六阶段串行 + 超时 | 每阶段即时更新 UI（流式状态）+ 总耗时显示 + 可取消 |

### 3.10 测试与验收

- `providers.test.ts`：四种预设 endpoint 生成（含用户名 URL 编码、base 去尾斜杠、Nextcloud 用户名变化重算、jianguoyun 固定 base、generic 直通）；`normalizeCollectionUrl` 对无协议/带 query/带 hash/中文路径的处理。
- `diagnose.test.ts`（注入 transport）：200 全通过；401 在 auth 阶段失败且 read/write/delete skip；PROPFIND 返回 405；GET 404 视为「还没有同步文件」通过；PUT 507 归类 quota；DELETE 失败只 warn 且 ok 仍可 true（或按产品口径 ok=false 但 cleanedUp=false，需定）；超时/TLS 文本归类；**结果 JSON 不含密码**；取消信号。
- 手工验收：至少一个真实 Nextcloud/坚果云（或群晖）连通一次；错误密码 → auth 人话；不存在目录 → no-collection + 「先创建目录」；浏览器预览 → 显示桌面端提示且无网络请求（DevTools Network 空）。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 3.11 能否不改数据 schema

**能。** WebDAV 配置在 localStorage（设备本地），AppState 零改动；新增的 providerId/rememberPassword 只影响 localStorage 配置结构，读取时容错即可。

---

## 4. A4 一键档案包

### 4.1 现状事实

- 现有导出能力：①「导出数据」JSON 下载（`SettingsDialog.tsx:181-186`）；②应用内自动/手动备份 5+5 份（`storage/backups.ts`）；③「打开数据目录」（`backups.ts:134-142`，用 `opener.openPath`）；④本地诊断包纯文本下载（`platform/diagnostics.ts:169-206`，`downloadTextFile` 的 Blob+<a> 写法可复用）。
- 依赖现状：**@tauri-apps/plugin-fs 已安装**（`writeFile` 支持 Uint8Array / ReadableStream，typings 第 798 行；`mkdir/remove/rename/exists` 可用）；**@tauri-apps/plugin-dialog 没有安装**（package.json 无）→ 没有系统「另存为/选目录」对话框；@tauri-apps/api 的 `path` 提供 `downloadDir()/desktopDir()/appDataDir()`（无需装插件）。
- capabilities 现状（`src-tauri/capabilities/default.json`）：fs **没有 `fs:allow-write-file`**（只有 write-text-file）、scope 只有 `$APPDATA` 与 `$APPDATA/blockhabit*`；opener 只有 `opener:default`，含 `reveal-item-in-dir` 但**不含 `open-path`**。→ 现状下二进制写不了、`openDataDir()` 大概率静默失败。
- 存档体积：实测 429KB（1095 打卡 + 1095 块，pretty）；紧凑化约 250–280KB（§0.2）。
- 渲染能力已验证：`BlueprintThumb` 就是离屏 canvas 画整座建筑（`src/components/BlueprintThumb.tsx:23-97`），可直接做「每座建筑一张 PNG」。
- 已知缺口：没有 `document.fonts.ready` 等待；没有 sha256 工具；没有 ZIP 工具。三件都要新写（纯 TS，无依赖）。

### 4.2 无新依赖实现 ZIP：可行（含可选 DEFLATE）

#### 4.2.1 STORE（method 0）最小实现

- 结构：每个文件 = 本地文件头（0x04034b50，30 字节固定 + 文件名）→ 原始字节；末尾中央目录（每文件 0x02014b50，46 字节 + 文件名）+ EOCD（0x06054b50，22 字节）。
- 关键字段：version needed = 20；general purpose flag = 0x0800（bit 11，文件名 UTF-8，中文 README/文件名必须）；method = 0；crc32；compressed size = uncompressed size；DOS 时间/日期（年-1980）；无 data descriptor（我们内存里先有完整字节，size/crc 已知）。
- ZIP64 不需要：档案包 <30 个文件、<4GB。
- 代码量：`crc32`（查表 256 项，约 15 行）+ 写头/目录/EOCD（约 100–130 行）+ 输入校验与单测 ≈ **150–180 行**，符合 deep-dive 「≤200 行」的门槛。
- 实测：CRC32 8MB = 13ms（§0.2）；10MB 档案包 CRC 开销 <20ms。
- 内存：先在内存里攒 parts（文件名 + Uint8Array），最后 `new Blob(parts)`；plugin-fs 的 `writeFile` 接受 `ReadableStream<Uint8Array>`（typings 第 798 行），可直接 `blob.stream()` 落盘，**避免再复制一份完整 Uint8Array**（峰值 ≈ 文件总量 + 单个最大文件）。

#### 4.2.2 可选：用 CompressionStream 做 DEFLATE（method 8），零依赖

- 浏览器/Node 的 `CompressionStream('deflate-raw')` 产出 **raw DEFLATE（RFC 1951）**，正是 ZIP method 8 需要的数据；实测（Node）238KB JSON → 8KB（重复性高的合成数据，真实数据预计 3–6×），往返一致。
- 策略：文本文件（state.json / README.md / checksums.txt / manifest.json）先 deflate 再写入，method=8；PNG 已是压缩格式，直接 STORE。
- 兼容性：需要 WebView2（Chromium）支持 `deflate-raw`；**必须 try/catch 降级为 STORE**（不能因为压缩不可用就整个导出失败），并在单测里覆盖「CompressionStream 不存在 → 全 STORE 仍产出合法 ZIP」。
- 风险：这是可选优化，不是 A4 的必需项；先做 STORE，DEFLATE 作为第二个 PR，避免一张 PR 同时引入两种风险。

#### 4.2.3 SHA-256

- 优先 `crypto.subtle.digest('SHA-256', bytes)`（实测 8MB = 6ms）。
- 兜底：**不能假设 WebView2 一定有 secure context 的 subtle**（无法在本环境验证）。方案：运行时探测；缺失时用纯 TS SHA-256 兜底（约 60–80 行，纯整数运算，10MB 量级预计 100–300ms，可接受），或退化为「不提供 sha256，只提供文件大小清单」——推荐前者，因为 deep-dive 把「可验证」当作档案包的核心价值。
- 校验和只证明**完整性**，不证明来源（没有签名）；README 必须写清这一点。

### 4.3 Tauri 目录导出 vs 浏览器回退

#### 4.3.1 桌面端（唯一可行路径：appDataDir 下的 exports 目录）

没有 dialog 插件，也无法在 capabilities 里安全地写任意用户目录（scope 只到 $APPDATA）。因此：

1. 目录形如 `appDataDir/exports/BlockHabit-Archive-<UTC 时间戳>/`（fs scope 已覆盖 $APPDATA，只需加 `fs:allow-write-file`）。
2. 先写到 `appDataDir/exports/.tmp-archive-<stamp>/`，全部成功后再 `rename` 成正式目录；失败/取消就 `remove(recursive:true)` 清理（`fs:allow-remove` 已授权）。rename 只在同卷内保证原子性（同目录下成立）。
3. 「打开文件夹」：用 `revealItemInDir(README.md 或 zip 路径)`——该权限在 `opener:default` 里已授权，**不需要新增 opener 权限**；`openPath` 才需要 `allow-open-path`（也可以顺手加，但要接受「打开任意路径」的能力面）。
4. 可选：同一份内容再打一个 `.zip`（单文件便于发给别人/上传网盘）。
5. 建议同时修掉 `openDataDir()` 的权限坑：改用 `revealItemInDir(blockhabit.json)`，或在 capabilities 加 `opener:allow-open-path`。

需要新增的 capability（与 A1 合并成一次评审）：

    "fs:allow-write-file"

（如果决定用 `openPath` 打开导出目录，再加 `opener:allow-open-path`；否则只用 revealItemInDir 就够。）

#### 4.3.2 浏览器回退

- 浏览器没有目录写入能力；可下载单个 ZIP（我们自己的实现）或逐文件下载。
- 推荐：**浏览器固定产出 ZIP 单个下载**（一次交互、结构不散、校验清单在内），比「12 张 PNG 触发 12 次保存提示」体验好；deep-dive 的「逐文件下载」作为兜底选项保留（用户勾选「分文件下载」时用）。
- 浏览器 localStorage 存档 + 无 Tauri fs，导出全部在内存完成；10MB 级 ZIP 的 Blob 下载在主流浏览器没问题。
- 下载用现有 `downloadTextFile` 的写法扩展成 `downloadBlob(blob, filename)`（避免 base64 膨胀）。

#### 4.3.3 双端一致的 UI 流程

    [导出完整档案包]
      → 选择内容（默认全选）：数据 / 建筑图 / 年鉴（若 A2 可用）
      → 进度：渲染建筑图 i/12 → 计算校验和 → 写入/下载
      → 完成：显示「档案包已生成 · 3.7 MB」+ 桌面端 [打开文件夹] / 浏览器 [再次下载]
      → 失败：保留已完成部分（桌面端留在 .tmp 让用户可看）或清理，并说明原因 + 可重试

### 4.4 包结构（建议定稿）

    BlockHabit-Archive-2026-11-10T1030Z/
    ├─ README.md                人读说明（是什么/含什么/怎么恢复/怎么校验/隐私提醒）
    ├─ manifest.json            appVersion / schemaVersion / contentVersion / exportedAt / platform / files[{path,bytes,sha256}]
    ├─ data/
    │  ├─ blockhabit-state.json 与「导出数据」完全一致（可直接被「导入数据」读回）
    │  └─ checksums.txt         "<sha256>  <relative path>"（外部可 sha256sum -c 校验）
    ├─ buildings/
    │  ├─ 01-plant.png          已落成建筑：透明背景 2× 等距渲染，固定取景
    │  ├─ ...
    │  └─ README.md            建筑名 / 落成日期 / 奠基石铭言（有则写）
    └─ yearbook/
       └─ 2026.png              （A2 完成后；可选）

规则：

- 只导出**已落成**建筑（块数达 `BLUEPRINT_CAPACITY`）；在建蓝图可选导出 `in-progress-<id>.png`，但文件名必须显式标明，避免十年后误读为已完成。
- 落成日期用本地日期键（由 placedAt 推导，口径同 A2/B3）。
- README 用当前语言 + 一段英文摘要（或双语小节）；内容：BlockHabit 是什么、档案包含什么、如何用应用「导入数据」恢复、checksums 怎么校验、**不含任何 WebDAV 凭据 / 不含账号信息**、档案含个人笔记请注意保管。
- manifest 记录出包时的 `schemaVersion` 与 `contentVersion`，未来低版本应用能明确判断「读不了」而不是瞎猜。

体积估算（3 年真实形态数据）：

| 内容 | 估算 | 说明 |
| --- | --- | --- |
| state.json | 0.25–1 MB | 实测 429KB@1095 打卡 |
| 12 张建筑 PNG（2×，透明底） | 2–5 MB | 单张约 150–400KB（等距少色块，PNG 压缩友好） |
| 年鉴 PNG（可选） | 0.5–2 MB | 单页 1080×1440 @2x |
| 文本（README/manifest/checksums） | < 20 KB | — |
| 合计 | **约 3–8 MB**；ZIP STORE ≈ 合计，DEFLATE 后主要省 state.json | 峰值内存 < 2× 合计（<30MB），可接受 |

### 4.5 与导入 / 未来兼容的边界

- `data/blockhabit-state.json` 必须能被现有「导入数据」读回：走 `prepareImport`（严格校验 + v1 迁移）。**必须加 round-trip 单测**：exportData() → 写字符串 → prepareImport → 与导出前 state 深度相等（注意：exportData 是三处白名单之一，A4 不得改变其输出）。
- 未来 schemaVersion 升级：旧应用读新档案的 state 会拒绝（严格校验 schemaVersion），README 说明「请用同版本或更新版本的应用恢复」；manifest 里的版本号让人能判断。
- 档案包是**只读快照**，没有增量/合并语义；将来若做「从档案包恢复」，唯一入口就是 data/state.json（建筑图/年鉴永远是人看的派生文件，不参与恢复）。
- 不含 WebDAV 配置（现在也不含）；导出逻辑里要加一条**防御性断言**：序列化结果中不得出现 password 字段/配置键（测试用假配置跑一遍导出，断言字符串不含密码）。
- checksums 只能发现损坏，不能验证来源（无签名）；README 写清，避免安全承诺过度。

### 4.6 进度与失败恢复

- 分片：建筑渲染每座 `await` 一帧（`requestAnimationFrame`）让 UI 呼吸；进度回调 `{ phase: 'render'|'checksum'|'write', done, total }`。
- 取消：`AbortController`；桌面端取消后删除 `.tmp` 目录；浏览器取消直接丢弃内存。
- 失败：磁盘满/权限拒绝/rename 失败 → 清理 tmp + 人话 toast；不覆盖已有档案目录（同名冲突加 `-2` 后缀）。
- 并发保护：模块级 `exporting` 标志 + 按钮 disabled（双击不会生成两份）。
- 长任务不阻塞：单座建筑渲染在离屏 canvas 同步绘制（<50ms），可接受；不要用 Worker（跨线程传 canvas 复杂，收益小）。

### 4.7 涉及文件

新增：

- `src/platform/zip.ts` + `zip.test.ts`（crc32 / STORE / 可选 DEFLATE / 中央目录解析断言）
- `src/platform/sha256.ts` + `sha256.test.ts`（WebCrypto 路径 + 纯 TS 兜底，用已知向量断言）
- `src/logic/archive.ts` + `archive.test.ts`（纯逻辑：文件清单、manifest 组装、checksums、只含已完成建筑、排除凭据、README 生成）
- `src/render/buildingShot.ts`（离屏渲染单座建筑 → PNG bytes；内部调用 modelStage，A2 也可复用）
- `src/components/ArchiveExportPanel.tsx`（设置页子组件：选项、进度、取消、结果）
- `src/platform/download.ts`（`downloadBlob`，从 diagnostics 的 downloadTextFile 扩展）

修改：

- `src/components/SettingsDialog.tsx`：数据安全组增加「导出完整档案包」入口（面板外置）
- `src-tauri/capabilities/default.json`：`fs:allow-write-file`（+ 可选 `opener:allow-open-path`）
- `src/i18n/types.ts` + zh/en：`t.archive.*`（选项/阶段/失败/说明/隐私提醒）
- `design/records/`：新表面 + 包结构记录

### 4.8 工作量

**M，3–5 人日**：zip 0.5–1；sha256 0.3；离屏建筑渲染 + 取景统一 0.5–1；文件组织/进度/清理 0.7；设置页 UI + i18n 0.5；测试 0.5–0.7。

### 4.9 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| ZIP 实现细节错（CRC/偏移/UTF-8 标志） | 中 | 自研格式手滑 | 纯函数单测 + 用 Node `unzip`/PowerShell `Expand-Archive` 做真实解压验收；先 STORE 后 DEFLATE |
| WebView2 无 crypto.subtle / 无 CompressionStream | 中 | 旧运行时 | 探测 + 纯 TS SHA-256 兜底 + STORE 兜底；两者都要测「能力缺失」分支 |
| fs 权限不足导致桌面导出失败 | 中 | capabilities 未批 `fs:allow-write-file` | 权限评审一次过；失败给人话提示 + 引导「导出 JSON」降级 |
| 没有 dialog 插件，用户找不到文件 | 中 | 导出到 appDataDir | 完成后自动 `revealItemInDir` + 文案写清路径；不用 openPath 权限也能定位 |
| 离屏渲染字体/DPR 差异 | 中 | fonts 未就绪、DPR 非 2 | 固定 2×、`spriteScale:2`、await fonts.ready、四主题截图 |
| 档案包体积/内存 | 低 | 多年数据 | 分片渲染、toBlob、可选 DEFLATE；实测量级 3–8MB |
| 隐私误期待 | 低 | 用户把档案发出去 | README 明示含个人笔记、不含凭据、无加密 |
| 半成品目录残留 | 低 | 取消/崩溃 | .tmp 命名 + 成功 rename + 失败清理 + 下次导出先清同名 tmp |
| Windows 路径长度/中文名 | 低 | 用户名很长 | 目录名短、蓝图 id 用 ascii、文件名只用 ascii |

### 4.10 测试与验收

- `zip.test.ts`：空 ZIP（只有 EOCD）；单文件/多文件 CRCs 与 sizes 正确；UTF-8 中文文件名；DOS 时间合法；总长度与中央目录偏移自洽；STORE 与 DEFLATE 两种；模拟无 CompressionStream 时全 STORE。**外部解压验收**：生成一个含 state.json + 1 张 PNG 的 zip，用 PowerShell `Expand-Archive` 解压后逐字节比对。
- `sha256.test.ts`：已知向量（空串、abc、1MB 随机）；WebCrypto 与纯 TS 两条路径结果一致；纯 TS 路径在「无 subtle」环境下可用。
- `archive.test.ts`：只导出已完成建筑；manifest 文件清单与 bytes/sha256 一致；checksums.txt 与 manifest 一致；导出字符串不含 password；README 必含恢复与校验说明；空数据（0 建筑）仍生成合法包；时间戳/文件名合法。
- 集成（jsdom + mock fs）：桌面路径「写 tmp → rename」调用顺序、取消后 remove、目录已存在时加后缀；浏览器路径「单 zip 下载」。
- 手工验收：桌面导出 → 打开文件夹 → 双击 state.json 能看懂 → 用应用导入该 JSON 数据一致 → PowerShell 解压 zip 校验 checksum；浏览器导出单 zip；四主题 + zh/en。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 4.11 能否不改数据 schema

**能，零字段改动。** 档案包是导出侧只读产物；不新增 AppState 字段（contentVersion 若 B1 落地会被顺带写进 manifest，但那是 B1 的字段）。

---

## 5. B1 扩展蓝图包（内容二期）

### 5.1 现状：新增一座蓝图要改哪些地方

1. `src/logic/blueprints/generators.ts`：写一个 `makeXxxBlueprint()` 生成器（用 `createBlueprintBuilder`，`:12-49`）。
2. `src/logic/blueprints/index.ts`：import、`export const xxxBlueprint = makeXxxBlueprint()`、加入 `blueprints` Record、**追加到 `blueprintOrder` 末尾**（`:17-58`）。
3. i18n：`t.blueprints[id]` zh/en 两处（`src/i18n/types.ts:447`；漏配只会显示 id，不报错）。
4. 图鉴/容量/进度**不需要**手工登记：`BLUEPRINT_CAPACITY` 由 `blueprints` 自动派生（`src/logic/builds.ts:13-16`），图鉴遍历 `blueprintOrder`（`GalleryDialog.tsx:58`），建造页「全部落成」按 `blueprintOrder.length`（`Build.tsx:61`），展台按 `blueprints` 查找（`showcase.ts:104-140`）。**代码里没有硬编码 12 座**。
5. AGENTS 铁律：`generators.ts` 的建筑数据属设计性资产，新增/修改必须先写 design/records，通过 `design:check` 与人工审核。

### 5.2 旧客户端 / 同步遇到未知 blueprint 的**现有行为**（这是 B1 真正的难点）

| # | 场景 | 现有代码路径 | 实际后果 |
| --- | --- | --- | --- |
| 1 | 旧客户端读新存档（本地） | `sanitizeState` 把 builds 中未知 blueprintId 的块**过滤掉**、`completedBlueprintIds` 过滤、`activeBlueprintId` 回落 plant（`adapter.ts:170-210`） | 新建筑积木与完成记录**静默消失**，且下一次自动保存**落盘覆盖**（数据丢失）。因为 schemaVersion 相同，旧客户端不会进 needsUpgrade 分支 |
| 2 | 旧客户端导入新 JSON | `validateState` 要求 builds/completed/active 全部是白名单 id（`adapter.ts:135-165`；`KNOWN_BLUEPRINT_IDS` 由 blueprintOrder 生成） | 整档拒绝（导入失败），本地不被破坏；用户只看到「不兼容」类提示 |
| 3 | 旧客户端 WebDAV 同步 | `fetchPreparedRemote` → `prepareImport` 返回 null → `SyncFlowError('incompatible')`（`useSync.ts:67-80`） | 同步失败且**不可通过重试恢复**（直到升级）；不会写坏远端，但多设备同步被锁死 |
| 4 | 渲染 | `getBlueprint` 未知 id warn 后回落 plant（`index.ts:60-70`）；`Showcase.tsx:150` 用 `getBlueprint(selectedBlueprintId)` | 若未知 id 走进渲染，会把 plant 当成该建筑画/计数 → 进度与画面**说谎** |
| 5 | 合并 | `mergeAppState` 只接收 `prepareImport` 后的合法 state；`rebuildBuilds` 的容量表对未知 id 用 `capacities[id] ?? group.length`（`builds.ts:21`） | 目前未知 id 到不了 merge；一旦以后放开校验，需要专门处理容量与投影 |
| 6 | 托盘/今日/画报 | `TraySync`、`Today`、`MonthlyPoster` 都直接 `getBlueprint(activeBlueprintId)`（`App.tsx:118,253`；`Today.tsx:87`；`MonthlyPosterModal.tsx:136`） | 同上：未知 active id 时全站按 plant 显示（进度错但不会崩） |

**结论**：在「不升 schemaVersion、纯追加蓝图」的方案下，旧客户端**会丢新数据**。所以 B1 的第一件事不是画建筑，而是把「内容版本」变成可门禁的一等公民。

### 5.3 内容版本门方案（最小可行，不改 schemaVersion）

#### 5.3.1 数据与常量

- 新增 `src/logic/blueprints/manifest.ts`：

      export const CONTENT_VERSION = 1        // 当前 12 座 = 1；追加内容包时 +1
      export interface ContentPack { id: string; version: number; releasedAt: string; blueprintIds: string[] }
      export const CONTENT_PACKS: ContentPack[] = [{ id: 'base', version: 1, releasedAt: '2026-11-10', blueprintIds: [...] }]

- `AppState` 增加**可选** `contentVersion?: number`（`src/types.ts`）。
- 语义：schemaVersion 管「数据形状」，contentVersion 管「蓝图注册表内容」；两者独立。**不要把新蓝图塞进 schemaVersion 升级**——那会触发整档迁移/拒绝导入/needsUpgrade，代价远大于收益。

#### 5.3.2 读写兼容（必须同时改的点，缺一即被静默丢弃）

1. `normalizeState`：`contentVersion = HEAD 是合法整数 ? 它 : 1`（缺省视为 1）。
2. `loadAndMigrate`：**在 sanitize 之前**判断 `v.contentVersion > CONTENT_VERSION` → 直接返回 `{ state: null, needsUpgrade: true }`（复用现有 needsUpgrade 通道：挂起持久化 + 提示升级 + 阻止同步，`appStore.ts:679-710`；`useSync.ts:137-141`）。
3. 三处白名单：`persistState`（`appStore.ts:723-754`）、`exportData`（`:618-655`）、`useSync.buildLocalState`（`useSync.ts:48-65`）都加 `contentVersion`（写 `CONTENT_VERSION`）。
4. `mergeAppState`：返回 `contentVersion = max(local, remote)`（`merge.ts:278-293` 的返回对象里加）。
5. `validateState`：可选字段不校验（未知字段本来就透传）；但要**先**处理 contentVersion（见第 2 点，在 loadAndMigrate 层），否则严格路径会返回「拒绝」而不是「需要升级」。
6. `importData`：走 `prepareImport`，contentVersion 过高 → null → 现有「格式不兼容」提示可接受；若要更友好，后续给 prepareImport 加返回原因（不在本轮）。

#### 5.3.3 旧客户端门禁后的 UX（诚实但难看，需产品确认）

- 命中 needsUpgrade 时：存档不被读取、持久化被挂起、只显示现有 `needsUpgradeToast`（「存档来自更新版本，请升级应用」）+ 空界面。数据是安全的，但旧版本等于不可用。
- 这是**有意选择**：比「静默删数据」或「假装能读」都诚实。替代方案见 5.3.4。
- 提醒：一旦新客户端写过一次存档/同步文件，旧设备就进入这个状态 → 发布说明必须写「本次更新后请同时更新所有设备」。

#### 5.3.4 可选增强（phase 2，不做也行）：保留未知蓝图

若产品不接受「旧版本不可用」，可改造成「保留未知、只读兼容」：

- `sanitizeState`：未知 blueprint 的 builds/active/completed **原样保留**，只把 active 标成 `unknownBlueprint: true`。
- `getBlueprint`：未知 id 返回一个**空 blocks 的占位蓝图**（而不是 plant），避免画出错误建筑。
- `rebuildBuilds`：已知蓝图重建，未知蓝图的块组**原样透传**（index 保持）。
- UI：顶部常驻「此存档含更新版本建筑，请升级查看」；禁止向未知蓝图继续产块（checkIn 时若无可用 slot 就不掉块，本来就有此路径）。
- `validateState`：允许未知 id，但返回 `hasUnknownBlueprint` 供 UI 提示；同步允许通过（这样旧设备仍能同步打卡，只是看不到新建筑）。
- 工作量：+2–3 人日；风险更高（渲染/计数/图鉴多处要防未知 id）。**建议 0.5.0 先用门禁，观察是否需要 phase 2。**

#### 5.3.5 兼容矩阵测试（必做）

| 组合 | 期望 |
| --- | --- |
| 旧客户端 × 新存档（含 contentVersion 2） | needsUpgrade；不写盘；数据文件哈希不变 |
| 新客户端 × 旧存档（无 contentVersion） | 视为 1；正常加载；保存后写入 contentVersion=当前 |
| 新客户端 × 旧存档 → 保存 → 旧客户端 | 旧客户端 needsUpgrade（确认门禁生效） |
| 双端同步：旧端无法同步 | 旧端 syncNow 返回 false 且 lastSyncError 不写坏远端（远端文件哈希不变） |
| 降级安装：卸载新装旧 | 数据文件完整、旧客户端提示升级、无静默清洗 |

### 5.4 内容包 manifest / 图鉴 / 容量 / 解锁顺序

- **manifest 是构建期元数据，不是运行时下载**：0.5.0 的方案是「内容随安装包内置、免费年度扩建」，所以不需要签名/下载/解包，也就不需要内容包校验签名（免掉一条供应链安全面）。
- **图鉴/解锁顺序**：新蓝图一律追加到 `blueprintOrder` 末尾 → 既有用户的 `firstIncompleteIndex` 自动指向新包第一座（已完成 12 座的用户）；未完成的用户继续按顺序建。
- **容量**：`BLUEPRINT_CAPACITY` 自动；建议单座 40–120 块（deep-dive），超 220 块的模型在 13 寸 + 集成显卡上要注意 BuildScene 帧耗（现最大 castle ≈218 块，已是上限参考）。
- **存档兼容**：旧数据（builds/completed/foundationNotes/showcasePlacements）完全不动；新蓝图只是多了可用的 id 空间。展台网格 26×26 够放 18 座（按包围盒碰撞，`showcase.ts:56-140`）。
- **图鉴总数**：`GalleryDialog` 标题用 `blueprintOrder.length`（`GalleryDialog.tsx:43`）——自动正确；文案里不要写死「12 座」。
- **待解锁展示**：deep-dive 3.5.5 要求「新包建筑只显示剪影+名字」——现有 `BlueprintThumb` 已能画整模型，剪影需要新参数（灰度/单色），属视觉记录范围。
- **检查脚本**：不新增 npm script（避免改 package.json），把校验写进 vitest：`src/logic/blueprints/content.test.ts` 断言：id 唯一、order 与 manifest 一致、每座有 zh/en 名称、坐标无重复、无悬空（每块下方或同层有支撑，允许 1 格悬挑？按现有生成器实际做法放宽为「无完全悬空块」）、总块数在 40–220、容量与 blocks.length 一致。

### 5.5 是否需要内容版本号

**需要，且必须与 schemaVersion 分离。** 理由：

1. 旧客户端只认蓝图 id 白名单，任何新 id 都会触发「不认」；只有 contentVersion 能在**读取前**拦住，避免 sanitize 的破坏性清洗。
2. 内容版本会让「数据能不能读」与「应用版本够不够新」直接挂钩，用户可解释、可支持。
3. schemaVersion 是数据形状契约，升级它要写迁移、会拒绝旧档导入；内容追加不应该承担这个代价。

### 5.6 涉及文件

新增：

- `src/logic/blueprints/manifest.ts`
- `src/logic/blueprints/content.test.ts`（构建期校验）
- 6 座新生成器（在 `generators.ts` 内追加函数，或拆 `generators-city.ts`；建议拆文件避免 generators.ts 继续长大——AGENTS 800 行建议）
- `design/records/D-20261110-063-*.md` + 后续「内容版本兼容」记录

修改：

- `src/logic/blueprints/index.ts`：注册 + 顺序
- `src/types.ts`：`contentVersion?`
- `src/storage/adapter.ts`：normalize / loadAndMigrate 门禁
- `src/store/appStore.ts`：persistState / exportData 白名单
- `src/sync/useSync.ts`：buildLocalState 白名单
- `src/sync/merge.ts`：carry max(contentVersion)
- i18n：新蓝图名 + 图鉴/建造文案 + 版本提示
- `src/pages/Build.tsx` / `GalleryDialog.tsx`：全落成后的「扩建包已就绪」文案（动态，不写死数字）

### 5.7 工作量

**L**：兼容门禁 3–5 人日（含 5 组兼容矩阵测试与真机双版本验证）；内容生产 6–10 人日（6 座蓝图 + i18n + 图鉴剪影 + 落成文案）；合计 9–15 人日。若只做门禁 + 1 座样例蓝图（验证流程），可压到 4–6 人日。

### 5.8 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| 旧客户端静默丢新数据 | **高** | 未做 contentVersion 门禁就发新蓝图 | 门禁先行；兼容矩阵测试；发布说明要求全设备升级 |
| 三处白名单漏加字段 | 高 | 复制现有 persist 代码 | 单测：保存/导出/同步后 contentVersion 仍在；把三处白名单抽成共享 `serializeState()`（推荐顺手重构，风险低收益高） |
| 双端同步在跨版本期永久失败 | 中 | 新端已写、旧端未升 | 门禁 + 明确提示 + 发布说明；phase 2 的只读兼容可缓解 |
| 内容质量/美术成本超预算 | 中 | 6 座蓝图设计 | 先 1 座样板过审再批量；生成器 + 图鉴缩略图自动出图 |
| 内容包让「第 191 天之后」叙事变复杂 | 中 | 用户困惑 | 设置页「内容路线」+ 图鉴动态总数 |
| 性能回退（更多模型/更大蓝图） | 低 | 单座过大 | 40–220 块硬约束；沿用现有性能基线（190 块场景） |
| 设计资产改动未记录 | 中 | 直接改 generators.ts | 按 AGENTS §2 走记录 + 人工审 + design:check |

### 5.9 测试与验收

- `content.test.ts`：注册表完整性（唯一性/顺序/名称/容量/坐标/悬空/块数区间）；图鉴顺序与 manifest 一致；总数与「全部落成」判定一致。
- 兼容矩阵（§5.3.5）：可用 vitest 构造两套「蓝图注册表」（旧集合/新集合）跑 loadAndMigrate/sanitize/validate/merge；真机再手测「装旧版读新档」。
- `appStore.test / persistence.*.test`：contentVersion 在保存/导出后仍在；needsUpgrade 时确实不写盘（现有 persistence.upgrade.test.ts 可扩展）。
- `merge.test.ts`：contentVersion 取 max；未知 id（phase 2 时）不丢块。
- 手工：全落成旧档 + 新包 → 建造页提示「扩建包已就绪」→ 图鉴解锁第一座 → 建到落成 → 年鉴（A2）统计到新建筑 → 同步到第二台设备 → 再降级安装旧版验证门禁。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 5.10 能否不改数据 schema

**不能完全不动**，但**不需要升 schemaVersion**：需新增可选字段 `contentVersion?: number`（含上述 5 处代码点 + 3 处白名单）。旧档缺省 = 1，未知字段透传已验证（`normalizeState` 展开保留、`merge` 的 settings/顶层按字段合并——顶层需按 5.3.2 第 4 点显式 carry）。

---

## 6. B2 桌面专注陪伴

### 6.1 现状事实

- `timerStore`：`sessions: Record<habitId,{startedAt,targetMs}>`，只有 start/cancel，**无持久化、无延长、无通知标记**（`src/store/timerStore.ts:1-32`）。
- 今日页 `HabitRow` 的行为（`src/components/HabitRow.tsx:82-84,121-134,198-241`）：
  - `isFocus = habit.kind === 'focus' && targetMinutes`；`targetMs = (targetMinutes ?? 25) * 60000`；
  - 点卡片：未开始 → `startTimer`；running 且进度 ≥80% → 直接完成打卡；20%–80% → 二次确认；ended → `performCheckIn(habit.targetMinutes)`；
  - `actualMinutes = max(1, round(elapsed / 60000))`（只有 running 早完成时用；ended 路径用的是 targetMinutes）。
- 全局 `TimerWatcher`（`src/App.tsx:53-98`）：1s interval 轮询，到点 toast + `notify()`，用 **内存 ref Set<sessionKey>** 去重；组件卸载/重启后丢失。
- `notify()` 已有统一出口与惰性授权（`src/platform/notify.ts:1-37`），Tauri 插件在窗口隐藏时也能弹。
- 托盘 tooltip 由 `TraySync` 在依赖变化时 invoke（`src/App.tsx:101-135`）→ 每秒更新会变成高频 IPC，不可取。
- 会话与习惯生命周期无关联：`deleteHabit/archiveHabit` 不清 timerStore（`src/store/appStore.ts:220-267`）→ 过期会话可能永远留着，TimerWatcher 会为已删习惯发通知（名字回退 'Habit'，`App.tsx:79`）。
- 跨午夜：`checkIn` 用**确认时刻**的 `todayKey()`（`appStore.ts:304-307`）→ 23:50 开始、00:15 确认会记到第二天。这是现有语义，B2 要保留并写清（不偷偷改成开始日）。
- 迷你件目前不消费 timerStore（`MiniDeskToy.tsx` 只读 habits/checkIns/builds）。

### 6.2 需要的状态与持久化

#### 6.2.1 会话结构（扩展，不改 AppState）

    // src/store/timerStore.ts
    export interface TimerSession {
      startedAt: number
      targetMs: number
      /** 已发过「到点」通知的时间戳（重启后不再重复通知） */
      notifiedAt?: number
      /** 累计延长次数（最多 2 次，每次 5 分钟） */
      extensions?: number
    }

    // localStorage（设备本地，不进存档/同步）
    // key: blockhabit.focusSessions.v1
    interface FocusSessionsV1 {
      version: 1
      sessions: Record<string, TimerSession>
    }

理由：专注会话是**设备本地行为**（多设备同步没意义，还会互相打断），deep-dive 3.6.4 已定「进 localStorage、不进存档」；因此 AppState 零改动。

#### 6.2.2 新纯逻辑 `src/logic/focusSession.ts`

    export type FocusPhase = 'focusing' | 'ready' | 'expired'

    export interface FocusView {
      phase: FocusPhase
      elapsedMs: number
      remainingMs: number
      targetMs: number
      /** 实际分钟（向上取整、至少 1） */
      actualMinutes: number
    }

    export function viewSession(session: TimerSession, now: number): FocusView
    export function isSessionStale(session: TimerSession, now: number, ttlMs?: number): boolean   // 默认 24h
    export function extendSession(session: TimerSession, minutes?: number, maxExtensions?: number): TimerSession
    export function primarySessionId(sessions: Record<string, TimerSession>, now: number): string | null  // 最早结束者
    export function formatRemaining(ms: number): string     // mm:ss（>1h 用 h:mm:ss）

规则与单测（deep-dive 3.6.6 已列）：

1. 时钟回拨（`now < startedAt`）：elapsed 记 0，phase=focusing，并在 DEV warn；不产生负数倒计时。
2. 到期判定 `now - startedAt >= targetMs` → ready；超过 `targetMs + 24h` → expired（可清理）。
3. 延长：`targetMs += 5*60000`，`extensions+1`，上限 2 次（防止无限拖延）；延长后已过的时间不清零。
4. 跨午夜：只影响 final 打卡日期（确认时 todayKey），不影响时长计算。
5. `actualMinutes` = `max(1, ceil(elapsed/60000))`（现有 HabitRow 是 round，B2 统一为 ceil 更符合「至少做过这么久」的诚实口径？→ 建议沿用现有 round 以免行为漂移，文档标注即可；两种都能接受，但要统一）。
6. 多会话：primarySession 取最早结束；全部会话都参与通知。

#### 6.2.3 timerStore 改造

- 模块加载时从 localStorage 读一次（try/catch，坏 JSON 丢弃并清理键）；`typeof localStorage === 'undefined'` 时纯内存。
- `start/cancel/extend/markNotified` 每次变更后**立即**写 localStorage（会话数量个位数，写入成本可忽略；不需要防抖）。
- 新增 `prune(validHabitIds: Set<string>)`：App 挂载与 habits 变化时调用，清掉已删/已归档习惯的会话（归档也应清，避免通知幽灵习惯）。
- 保持 `start(habitId,targetMs)` 语义（重复 start 覆盖）；`cancel` 保持。
- 单测：`src/store/timerStore.test.ts`（localStorage stub）：持久化/恢复/坏 JSON/prune/跨日。

### 6.3 窗口隐藏 / 最小化 / 重启时的行为（诚实边界）

| 场景 | 实际行为 | 处理 |
| --- | --- | --- |
| 窗口隐藏到托盘 / 最小化 | WebView2（Chromium）会节流隐藏页面的定时器，1s interval 可能被压到分钟级 | 时间基准是绝对时间戳，恢复后立刻算对；到点通知**可能延迟最多约 1 分钟**。补偿：监听 `visibilitychange` 与 window focus，立即重算并补发未通知的会话；文档/设置里写明「后台通知可能略延迟」 |
| 窗口在后台但可见（被其他窗口遮住） | 通常仍 1s，但可能被降频 | 同上补偿 |
| 应用退出后重启 | 会话从 localStorage 恢复；若离开期间已到点 → 直接 ready + toast「离开期间计时已结束」 | 恢复时 `now >= startedAt+targetMs` → `notifiedAt` 置为「已通知过」避免重复弹；但要在应用内提示一次 |
| 系统休眠 | Date.now 跨休眠正确 | 同上 |
| 修改系统时间（回拨/前拨） | 回拨：elapsed=0；前拨：可能直接 ready | 单测覆盖；前拨不做特殊防御（诚实显示 ready） |
| 到点后用户一直不确认 | ready 状态保留；通知只发一次（notifiedAt） | 不做循环提醒（A5 禁止循环动效/打扰） |
| 托盘 tooltip | 只在阶段变化（focusing→ready→done）时更新，**不做每秒倒计时** | 避免每秒 IPC；迷你件内倒计时是本地渲染，不走 IPC |

可选（需 Lead 决策）：若产品要求「隐藏时精确到秒通知」，需要 Rust 侧定时器 + 新 tauri command（不加 npm 依赖，但要改 Rust/权限）——本轮建议不做，先把「打开/恢复时正确」做对。

### 6.4 摆件倒计时 + 结束落块

#### 6.4.1 MiniDeskToy 的专注模式（依赖 A1 的 size prop）

| 状态 | pocket（220×150） | standard / display |
| --- | --- | --- |
| focusing | 习惯名（1 行省略）+ mm:ss + 细进度条 | 习惯名 + 倒计时（大号）+ 环形/线性进度 + 3D 建筑 |
| ready | 「时间到」+ [落一块]（主按钮）+ [再来 5 分钟] | 同上 + 建筑 + [放弃] |
| done | 落块动画（BuildScene animateIndex）+ 自动回 idle（约 1.6s） | 同上 |
| 放弃 | 需要二次确认——**不要用全屏 ConfirmDialog**（220px 窗口放不下），改为面板内两段式：「放弃」→「确认放弃？」（3s 内再点生效，或点别处取消） |

- 完成打卡复用 `checkIn(habitId, actualMinutes)`（现有 action）；成功后再 `cancelTimer`；`checkIn` 返回 `placed/complete` 可用于 toast/庆祝音（现 MiniDeskToy 已有类似逻辑）。
- 落块动画：`BuildScene` 支持 `animateIndex`（`BuildScene.tsx:37-48,600-611`），MiniDeskToy 目前**没有传**；B2 在刚打卡后传 `animateIndex = placedCount-1`（backed by 本地 state 或 checkIn 返回值），用完清空。
- 桌面主窗 `HabitRow` 只需消费扩展后的会话（targetMs 已含延长）——现有渲染会自动跟随。
- 声音：现有 `playSnapSound/playJellySound/playCelebrationSound` 已尊重静音/音量设置，直接复用。
- 通知：唯一来源仍是 TimerWatcher（App 内），迷你件不自己发通知，避免双弹。

#### 6.4.2 与现有「focus 打卡」的关系

- 现有三档交互（≥80% 直接完成、20%–80% 确认、ended 完成）保留；摆件只提供「到点后确认」与「延长」两个动作，不改变主窗行为，减少回归面。
- 早完成（未到点）在摆件上不提供（空间不足 + 与仪式感冲突）；用户展开主窗即可。

#### 6.4.3 不做监控的边界（写进文档与首次使用提示）

- 只记录**用户自己点开始的计时器**；不感知你是否真的在专注。
- 不枚举进程/窗口、不读剪贴板、不截图、不访问摄像头/麦克风、不装驱动、不要管理员权限。
- 不拦截其他应用/网站（与 Focus Bear 等「阻断类」产品的明确区隔）。
- 到点不自动完成打卡（数据诚实：人不在时自动完成等于造假）。
- 应用退出后不做后台通知（没有常驻进程；与现有提醒能力一致，文档如实写）。

### 6.5 涉及文件

新增：

- `src/logic/focusSession.ts` + `focusSession.test.ts`
- （可选）`src/components/FocusMiniPanel.tsx`：摆件专注面板，避免 MiniDeskToy 过长
- `src/store/timerStore.test.ts`

修改：

- `src/store/timerStore.ts`：持久化 + extend + markNotified + prune
- `src/App.tsx`：TimerWatcher 改「持久化 notifiedAt + visibility/focus 补偿」；初始化 prune；托盘 tooltip 只阶段变化
- `src/components/MiniDeskToy.tsx`：专注模式（依赖 A1 的 size prop）；animateIndex
- `src/components/HabitRow.tsx`：消费扩展字段（延长后的 targetMs）；actualMinutes 口径统一
- `src/i18n/types.ts` + zh/en：`t.focus.*`（专注中/时间到/落一块/再等5分钟/放弃确认/离开期间已结束/后台延迟提示）
- `design/records/`：摆件新表面（专注态）需记录

### 6.6 工作量

**M，3–4 人日**：focusSession 纯逻辑 0.5；timerStore 持久化 + prune 0.5；TimerWatcher 通知去重与补偿 0.5；摆件专注态（依赖 A1）1；HabitRow 对齐 0.3；i18n + 测试 0.7。

### 6.7 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| 隐藏/最小化时通知延迟 | 中 | Chromium 定时器节流 | 绝对时间 + visibility/focus 补偿 + 文案诚实；不做后台服务 |
| 重启后重复通知 | 中 | 内存 Set 丢失 | `notifiedAt` 持久化；恢复时已到期只提示不通知 |
| 会话与习惯生命周期脱钩（幽灵会话） | 中 | 删除/归档习惯 | prune + 单测；TimerWatcher 对无效 id 跳过并清理 |
| 跨午夜打卡日期语义被误解 | 中 | 23:50 开始跨夜 | 保留现状（确认日），文档提示 + 测试；不改成开始日 |
| 多会话同时到点刷屏 | 低 | 用户同时开多个专注 | 通知合并为一条「N 个专注已结束」或逐条但去重；摆件只显示最早结束 |
| 全屏确认弹窗塞不进迷你窗 | 低 | 220×150 | 放弃确认用两段式内联，不用对话框 |
| 延长被当无限拖延 | 低 | 用户反复延长 | 最多 2 次（10 分钟），之后只能完成或放弃 |
| 通知权限被拒 | 低 | 用户拒绝 | 降级为应用内 toast（现有 notify 行为） |

### 6.8 测试与验收

- `focusSession.test.ts`：focusing/ready/expired；时钟回拨；延长上限；跨午夜；24h 过期；primarySession 选择；actualMinutes 口径。
- `timerStore.test.ts`：写 localStorage、重启恢复、坏 JSON、prune、cancel 清理、notifiedAt 持久化。
- `App.test.tsx`（扩展）：TimerWatcher 到点只通知一次；恢复已到期会话不重复通知；visibilitychange 补偿触发。
- `MiniDeskToy.test.tsx`（依赖 A1 改动）：三档专注态渲染；ready 显示按钮；放弃两段式；打卡后 animateIndex 传入。
- 手工验收：启动专注 → 摆件切 focusing；隐藏窗口到托盘 → 到点后恢复窗口 → 立刻 ready + 一次通知；关闭应用 → 等到超时 → 重启 → 会话在且 ready；跨午夜场景（可改系统时间或 mock）；删掉习惯 → 会话被清；静音下无声音；reduced-motion 无动画。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 6.9 能否不改数据 schema

**能，零 AppState 改动。** 会话只进 localStorage（设备本地）；不加设置字段（如确实要「摆件显示专注」开关，也放 AppSettings 可选字段，不升版本）。

---

## 7. B3 建筑即编年史

### 7.1 现状事实（可复用的数据与代码）

- `BuildScene` 已把「块序位 → 打卡事实」做成 O(1) 映射：`blockMetaByIndex: Map<index,{pb?,ci?,habitName?}>`，用 `checkIns.placedBlockId` 反查（`src/render/BuildScene.tsx:121-141`），并在悬停时组装 `BrickInspectPopover` 的入参（`:677-700`）。→ B3 的「时间线点开看当天打卡与随笔」可以直接复用这套映射（抽取成纯逻辑，见 7.3）。
- `BrickInspectPopover` 是纯展示组件，入参 `BrickInspectInfo { index,x,y,habitName,date,note?,mood?,starred? }`（`src/components/BrickInspectPopover.tsx:9-27`）——B3 档案卡可以复用同一气泡或直接复用它的数据形状。
- `PolaroidModal` 已做：`bonusByIndex`（`:50-57`）、`blueprintNotes`（按 placedBlockId 关联、starred 优先、最多 4 条，`:59-73`）；背面时间轴就是这 4 条随笔（`:276-323`）。→ B3 的「关键块/随笔时间线」已有 80% 代码，但它是**拍立得专用、内联在组件里**，需要抽出来。
- **一个数据诚实问题**：拍立得正面用 `todayStr`（导出当天）作为 `cardDetails` 的日期（`PolaroidModal.tsx:89,205,213`）——它不是落成日。B3 明确「落成日期」时，应从 builds 推导（`placedAt` 最大值），并顺手修正拍立得这个口径。
- `FoundationNoteDialog` 已存在，入参 `blueprintId`（`src/components/FoundationNoteDialog.tsx:18`），直接复用编辑。
- 统计页「手账长廊」是**跨习惯**的随笔流（`Stats.tsx:100-126`），与 B3 的**按建筑**聚合是不同切面；B3 不应重复实现筛选，只做「建筑内」子集。
- 落成日可推导：某 blueprint 的块数达 `BLUEPRINT_CAPACITY` 时取 `max(placedAt)` → 本地日期键。`completedBlueprintIds` 没有时间且合并后会按 id 排序（`merge.ts:263-270`），**不能**作为落成顺序来源。
- 查询成本：builds ≤ 约 1400 条、checkIns 同量级；实测同年鉴的聚合 0.22ms（§0.2）→ 按建筑聚合是 O(n) 单遍，完全不需要缓存或新索引。

### 7.2 是否需要新字段

**不需要。** 全部可从现有字段派生：

| 档案卡内容 | 数据来源 | 备注 |
| --- | --- | --- |
| 落成日期 | builds 中该 bp 的 max(placedAt) → 本地日期键 | 块数需达容量；不足则「不可考」 |
| 耗时天数 | min(placedAt) → max(placedAt) 的日历天数 | 空档日不算，只算首尾差 |
| 总块数 / 奖励块数 | builds.length / builds.filter(bonus) | 全勤块 fromHabitId='__day__' |
| 全勤贡献块数 | builds 中 fromHabitId='__day__' 计数 | 与 dayClaims 交叉校验（dayClaims.blockId 可能为空） |
| 投入最多的习惯 | builds.fromHabitId 计数（排除 '__day__'） | 并列取 habit.createdAt 较早者 |
| 关键块（首块/25%/50%/75%/末块） | 按 index 取 `builds` 排序后前 5 个锚点 | index 已在每个蓝图内连续 0..N-1（`rebuildBuilds` 保证） |
| 随笔时间线 | checkIns（!deletedAt、note 有值、placedBlockId ∈ 该 bp 的块） | 复用拍立得的选择规则（starred 优先） |
| 铭言 | foundationNotes[blueprintId] | 可编辑（FoundationNoteDialog） |
| 「第 N 座」 | 所有蓝图按落成时间排序后取序号 | 不能用 completedBlueprintIds 数组顺序 |

「精选记忆块」这类未来功能也不需要新字段：`CheckIn.starred` 已经是「精选」语义，可直接用。

### 7.3 纯逻辑模块建议（new: `src/logic/buildingArchive.ts`）

    export interface BuildingArchive {
      blueprintId: string
      completedAt: string | null          // 本地日期键
      firstPlacedAt: string | null
      days: number | null
      totalBlocks: number
      bonusBlocks: number
      dayClaimBlocks: number
      topHabits: Array<{ habitId: string; name: string; count: number }>
      /** 关键块锚点（index 0 / 25% / 50% / 75% / 末块） */
      milestones: Array<{ index: number; date: string | null; blockId: string; habitId: string; habitName: string; note?: string; mood?: MicroMood; starred?: boolean }>
      /** 随笔时间线（已按规则排序，最多 N 条） */
      notes: CheckInNoteEntry[]
      foundationNote?: string
      /** 块数不足/旧档导致无法判定 | null */
      completedAtUnknown: boolean
    }

    export function buildBuildingArchive(state: AppState, blueprintId: string): BuildingArchive
    export function blockMetaIndex(state: AppState, blueprintId: string): Map<number, { pb: PlacedBlock; ci?: CheckIn; habitName?: string }>
    export function completionDateOf(state: AppState, blueprintId: string): string | null
    export function listArchiveBuildings(state: AppState): string[]   // 已落成，按落成时间倒序

- `blockMetaIndex` 从 `BuildScene` 的 `blockMetaByIndex` 抽出（同一实现），BuildScene 改为调用它；这样浏览气泡与档案卡永远同源，不会出现「气泡和档案卡说的不是同一天」。
- 依赖 A2 的 `completionDateOf`：A2 的 `yearbook.ts` 内部也调用它（A2 §2.3 已列为导出 helper），避免两处各写一份。
- 单测：空建筑、未落成、块数不足的旧档、只有全勤块、无随笔、Top 习惯并列、跨年落成、墓碑撤销后块数减少。

### 7.4 组件与画布

- `src/components/BuildingArchiveModal.tsx`（宽 720，桌面 dialog；移动端 BottomSheet）：
  - 顶部：等距大图（复用 A2 的 `modelStage`）+ 建筑名 + 落成日期 + 「第 N 座」；
  - 数据区：总块数 / 耗时天数 / 奖励块 / 投入最多习惯；
  - 时间线：首块→末块的关键块，点击展开当日打卡（复用 `BrickInspectPopover` 的数据形状，或内联一个只读条目；**不要**在窄窗里再复制一个浮层定位系统，直接内联展开更稳）；
  - 铭言：显示 + [编辑]（FoundationNoteDialog）；
  - 底部：[拍立得]（PolaroidModal，已支持 blueprint prop）+ [保存档案卡 PNG]（A2 画布模块，新增一个 `drawArchiveCard` 或用 yearbookCanvas 的通用页）。
- 入口：图鉴 `GalleryDialog` 中已落成的卡片 → 点击打开档案（现在点击是「选择蓝图」，需要区分「选择/查看档案」：已落成卡片点主区域开档案，角落小按钮才选择；或双击）。这是交互设计决定，需要记录。
- 与 A2 的关系：年鉴的「建筑年表」每行可链接到档案卡（同一份 `BuildingArchive`），年鉴=按年总览，档案=按建筑专辑，边界清晰、共用 selectors。

### 7.5 查询成本

- `buildBuildingArchive` 单次：1 次 builds 过滤 + 1 次 checkIns 建 Map + 1 次 habits Map = O(builds + checkIns)；实测同年鉴 0.22ms → 档案卡打开时现算即可（<5ms），不需要缓存、不需要新索引、不需要 precompute。
- 时间线渲染：>100 块时关键块只有 5 个 + 随笔 ≤ 数十条 → 不分页也不卡；若未来要列全部块，才需要分段（deep-dive 3.7.3 已提示）。

### 7.6 涉及文件

新增：

- `src/logic/buildingArchive.ts` + `buildingArchive.test.ts`
- `src/components/BuildingArchiveModal.tsx` + 轻量测试（空态/未落成/铭言编辑入口）
- （复用 A2）`src/render/modelStage.ts`、`yearbookCanvas` 的通用页绘制

修改：

- `src/render/BuildScene.tsx`：`blockMetaByIndex` 改为调用 `blockMetaIndex`（视觉零回归）
- `src/components/PolaroidModal.tsx`：落成日口径修正（用 completionDateOf 而不是 todayStr）——**属于文案/数据口径修正，需要记录**
- `src/components/GalleryDialog.tsx`：已落成卡片入口（开档案 vs 选择）
- `src/pages/Showcase.tsx`（可选）：展台点已落成模型 → 档案卡
- `src/i18n/types.ts` + zh/en：`t.archiveBuilding.*`
- `design/records/`：新表面（档案卡）

### 7.7 工作量

**S–M，2–3 人日**：逻辑 + 映射抽取 0.7；档案卡组件 0.8；画布复用 0.3；图鉴入口交互 0.3；测试 0.4。

### 7.8 风险

| 风险 | 级别 | 触发 | 缓解 |
| --- | --- | --- | --- |
| 与 A2 重复实现聚合/画布 | 中 | 各写一套 | 统一 `completionDateOf` / `blockMetaIndex` / `modelStage`；代码评审把关 |
| 旧档无法判定落成日 | 中 | 导入 v1、块数不足、撤销过 | `completedAtUnknown` + UI 明示「不可考」，不猜 |
| 图鉴卡片点击语义冲突（选择 vs 查看） | 中 | 已落成卡片两种动作 | 主区域=查看档案，显式小按钮/菜单=设为当前建造；记录 + 键盘可达 |
| 长列表面板（700+ 块）性能 | 低 | 未来列全部块 | 只渲染关键块 + 随笔；未来再分段 |
| 拍立得日期口径变更引起视觉/文案回归 | 低 | 用户已习惯导出当天 | 记录 + 发布说明；只改日期来源，不改版式 |
| 气泡与档案卡数据不一致 | 低 | 两套映射 | 同一 `blockMetaIndex` + 单测 |

### 7.9 测试与验收

- `buildingArchive.test.ts`：空/未落成/已落成；首末块与天数；奖励块统计；全勤块计数；Top 习惯并列；关键块锚点（小模型 <5 块时不重复）；墓碑排除；旧档 completedAtUnknown；跨年。
- `BuildScene` 回归：抽取 `blockMetaIndex` 后悬停气泡数据不变（现有 BuildScene 测试/手工截图）。
- 手工：图鉴 → 已落成建筑 → 档案卡（日期/天数/习惯/时间线）→ 点开随笔 → 编辑铭言 → 拍立得 → 保存档案卡 PNG；未落成建筑给出「尚未落成」；Esc 关闭；键盘可达；四主题 + zh/en。
- 性能：打开档案卡 < 50ms（真机）、无长任务告警。
- 门禁：`npx tsc --noEmit` / `npm test` / `npm run design:check`。

### 7.10 能否不改数据 schema

**能，零字段改动。** 落成日/耗时/关键块/Top 习惯全部由 builds + checkIns + foundationNotes 派生；无需 buildingStory 之类的字段（deep-dive 3.7.4 已否掉 v1 加字段）。

---

## 8. 实施顺序建议

### 8.1 依赖关系（谁必须先做）

    Wave 0（共享地基，1–2 天，可并行）
      ├─ 0a capabilities 一次性评审：core:window:allow-set-min-size、core:window:allow-set-position、fs:allow-write-file（+可选 opener:allow-open-path）
      ├─ 0b serializeState() 重构：合并 persistState / exportData / buildLocalState 三处白名单；顺带修 repairBrickMonth 丢失（独立 chore 提交 + 回归测试）
      ├─ 0c 抽 src/render/modelStage.ts（A2/A4/B3 共用；先做零回归验证）
      └─ 0d i18n 命名空间与「新增字段三处白名单」checklist 写进 CONTRIBUTING/AGENTS 附录

    Wave 1（0.3.0）：A1 + A3（并行）
      A1 依赖 0a；A3 依赖 0b（saveWebDavConfig 改造）与既有 http/webdav
      ⚠ SettingsDialog 是共同写点 → 先把「迷你件组」「WebDAV 组」「数据安全组」抽成子组件再并行

    Wave 2（0.3.0–0.4.0）：A2 → B3
      A2 依赖 0c；B3 依赖 A2 的 completionDateOf / modelStage / 画布
      B2 可插在 A1 之后并行（改 MiniDeskToy，冲突点已被 A1 稳定）

    Wave 3（0.4.0）：A4
      依赖 0a（fs 权限）+ A2（年鉴图可选）+ B3（buildingShot 渲染可共享）

    Wave 4（0.5.0）：B1
      依赖 0b（serializeState）+ 内容生产 + 兼容门禁 + 发布说明
      B1 不应早于 A4：A4 的 manifest 会记录 contentVersion，需先有字段

### 8.2 建议批次与 DoD

| 批次 | 内容 | DoD（每批都必须满足） |
| --- | --- | --- |
| 0 | 地基重构 + 权限评审 | tsc/test/design:check 全绿；repairBrickMonth 回归测试通过；modelStage 抽取后四主题像素 diff = 0 |
| 1 | A1 + A3 | 各自单测通过；真机窗口清单（DPI/多屏/托盘）走查；WebDAV 至少 1 个真实服务器连通 |
| 2 | A2 + B3 + B2 | 年鉴四主题截图；档案卡全流程；专注态真机 + 隐藏/重启场景；无 schemaVersion 变更 |
| 3 | A4 | zip 外部解压验收 + round-trip 导入 + 桌面/浏览器双路径；capabilities 最小权限 |
| 4 | B1 | 兼容矩阵 5 组全过；内容检查测试；双设备升级流程手测；发布说明 |

### 8.3 不建议的顺序

- 不要先做 B1：门禁没做就发新蓝图 = 旧客户端静默丢数据（最重要的顺序约束）。
- 不要先做 A4：它想复用 A2/B3 的画布与图；先做会逼出两份渲染代码。
- 不要 A2 与 B3 同时从零写：先 A2 抽出共享 selectors，再 B3 组装，否则一定重复。

---

## 9. 最高风险 5 条

| # | 风险 | 为什么最高 | 触发条件 | 缓解与验证 |
| --- | --- | --- | --- | --- |
| 1 | **B1 旧客户端静默丢新建筑数据** | 是**数据不可逆丢失**（sanitize 过滤 + 自动保存覆盖），且用户不会立刻发现 | 新蓝图随版本发布，而某台设备还是旧版；或跨版本同步 | contentVersion 门禁先行（§5.3）；5 组兼容矩阵测试；发布说明「全设备一起升」；可选 phase 2 只读兼容 |
| 2 | **A1 窗口尺寸/权限/多屏的隐式行为** | 桌面端行为只能真机验证，且涉及 setMinSize/setPosition 两条未授权 capability；多屏/DPI 是经典长尾 bug 区 | 用户 150% 缩放、双屏、拔屏、任务栏自动隐藏；或 Tauri 升级改变最小尺寸语义 | 显式 setMinSize 契约 + clamp 纯函数单测 + 真机走查清单；权限不批时降级可用；先把 260×380 的隐式依赖写进记录 |
| 3 | **A4 桌面落盘能力与 WebView2 能力差异** | 目标环境没有 dialog 插件、fs 只到 appDataDir、没有 fs 写二进制权限；sha256/CompressionStream 是否可用未知 | 权限未批、旧 WebView2、用户找不到导出文件 | 最小权限清单（fs:allow-write-file + revealItemInDir）；sha256/CompressionStream 全部「探测 + 兜底」；zip 用外部工具解压验收；UI 明示路径 |
| 4 | **A2/A4/B3 画布导出质量（字体/颜色/一致性）** | 三份重复的模型绘制 + 无 fonts.ready + canvas 对 CSS 颜色函数兼容不一 → 「导出图缺字/错色」是最容易被用户截图吐槽的缺陷 | 首次打开就导出、CJK 字重、旧内核、抽取 modelStage 时参数不一致 | 先抽 modelStage 并像素 diff 验收；导出前 await fonts.ready；画布只用 rgba/hex；四主题 + zh/en 逐张人工比对 |
| 5 | **A3 诊断误报与凭据明文** | 错误归因不准会把用户引向错误方向（比没有诊断更糟）；密码明文是长期安全债 | 自签证书、反向代理、非标准 405、DNS/网络抖动；共享电脑 | 只做高置信归类 + unknown 兜底原样展示；脱敏单测；rememberPassword/不回显/清除凭据；文案诚实 + keyring 单独立项 |

次级风险（不在前五，但需跟踪）：B2 的隐藏窗口通知延迟与跨午夜语义；A1 双击与系统最大化冲突；A3 预设路径随服务商改版失效；B1 内容美术成本。

---

## 10. 「每项是否可以不改数据 schema」汇总

| 项 | AppState 顶层字段 | AppSettings | 其它存储 | schemaVersion | 结论 |
| --- | --- | --- | --- | --- | --- |
| A1 | 无 | +miniWidgetSize? / +miniWidgetAlwaysOnTop?（可选，normalize 补默认） | localStorage: windowLayout.v1（位置/主窗尺寸） | 2 不变 | 不升版本，但**不是零改动**（settings 2 个可选字段） |
| A2 | 无 | 无 | localStorage: yearbookSeen.v1（已读角标） | 2 不变 | **零字段** |
| A3 | 无 | 无 | localStorage: WebDavConfig +providerId? +rememberPassword? | 2 不变 | **零 AppState 字段** |
| A4 | 无 | 无 | 无（只输出文件） | 2 不变 | **零字段** |
| B1 | **+contentVersion?**（可选，缺省 1） | 无 | 无 | 2 不变 | **必须加可选字段**，但不升 schemaVersion；需改 5 处代码 + 3 处白名单 + merge carry |
| B2 | 无 | 无（如需摆件专注开关再加可选） | localStorage: focusSessions.v1 | 2 不变 | **零字段** |
| B3 | 无 | 无 | 无 | 2 不变 | **零字段** |

补充说明：

1. 「可选字段 + 不升 schemaVersion」成立的前提是：`normalizeState` 保留未知字段（已验证：先展开 `...s` 再覆盖已知项，`adapter.ts:313-346`）、`merge` 的 settings 是对象展开并集、`validateState` 不校验未知字段。**顶层**字段则必须显式 carry（merge 返回对象是手写的，§5.3.2 第 4 点）。
2. 三处白名单是硬隐患：`persistState`（`appStore.ts:723-754`）、`exportData`（`:618-655`）、`useSync.buildLocalState`（`useSync.ts:48-65`）。**建议 Wave 0 抽一个 `serializeState(state)` 供三处共用**，从此新增字段只改一处；顺带修 `repairBrickMonth` 没被持久化的既有 bug（重启会重新补月度修复砖额度）。
3. 任何新增顶层字段都要同时改：类型、normalize、三白名单（重构后一处）、merge carry、以及「导入/同步严格校验」是否需要认识它。

---

## 11. 需要 Lead / 人类拍板的岔路口

1. **capabilities 一次性评审**：是否批准 A1 的 `core:window:allow-set-min-size`、`core:window:allow-set-position` 与 A4 的 `fs:allow-write-file`（可选再加 `opener:allow-open-path`）？这是「配置能力面」而非依赖，但会扩大安装包可做的事情；建议一次评审、写进记录、最小授权。
2. **A1 圆角透明摆件窗**：是否改 main 窗口 `transparent:true`（影响阴影/点击/拖动，属视觉决定）？默认不做。
3. **A1 关闭语义**：「关闭收托盘」是否等于「退出摆件」（即 `enableMiniWidget` 置 false）？当前代码是「退出并写 false」，但 deep-dive 想要「关闭后下次启动仍在摆件」的话需要改成「关掉设置才算退出」。
4. **A2 年鉴导出形态**：单页 3:4 / A4 竖版 / 多页？主题色板还是固定纸底？是否同时导出 Markdown（建议要）。
5. **A3 明文 http 端点**：拒绝（推荐，明确文案）还是改 CSP 放行（安全面变宽，需安全评审）？
6. **A4 主形态**：文件夹优先 + ZIP 可选（推荐）还是 ZIP 为主？浏览器端是否固定单 ZIP。
7. **B1 兼容策略**：只做门禁（旧版不可用，最安全最省）还是追加 phase 2「保留未知、只读兼容」（更友好但 +2–3 人日且风险更高）？发布节奏（0.5.0？）。
8. **B2 通知边界**：能接受「应用在前台/后台但运行中才提醒，隐藏时可能延迟约 1 分钟」吗？若不能，需要 Rust 侧定时器（新 command + 权限，超出本笔记的「零依赖」边界）。
9. **顺手修既有 bug**：`repairBrickMonth` 未持久化（重启可刷月度修复砖）建议作为 Wave 0 的独立 chore 修复并补测试——是否在本轮一起做？

---

## 附录 A：本次阅读清单与未验证项

**已读（行号为本次阅读时的代码版本）**：
`AGENTS.md`、`design/README.md`、`design/AESTHETIC.md`、`design/TOKENS.md`、`design/SURFACES.md`（§12/§8/§12 与设置页）、`design/records/D-20261110-003/004/005/006`（抽查相关条）、`docs/superpowers/specs/2026-11-10-blockhabit-innovation-deep-dive.md`（全文）、`src/App.tsx`、`src/main.tsx`、`src/components/MiniDeskToy.tsx`、`src/store/timerStore.ts`、`src/store/appStore.ts`（关键段）、`src/types.ts`、`src/storage/adapter.ts`、`src/storage/tauriStorage.ts`、`src/storage/backups.ts`、`src/storage/index.ts`、`src/sync/types.ts`、`src/sync/useSync.ts`、`src/sync/webdav.ts`、`src/sync/merge.ts`（关键段）、`src/platform/http.ts`、`src/platform/notify.ts`、`src/platform/diagnostics.ts`、`src/logic/blueprints/index.ts`、`src/logic/blueprints/generators.ts`、`src/logic/builds.ts`、`src/logic/blueprint.ts`、`src/logic/checkin.ts`（关键段）、`src/logic/repairBricks.ts`、`src/logic/showcase.ts`（签名）、`src/render/isoCube.ts`（符号）、`src/render/BuildScene.tsx`（关键段）、`src/components/BrickInspectPopover.tsx`、`src/components/MonthlyPosterModal.tsx`、`src/components/PolaroidModal.tsx`（关键段）、`src/components/BlueprintThumb.tsx`、`src/components/SettingsDialog.tsx`（关键段）、`src/components/GalleryDialog.tsx`（关键段）、`src/components/TrayMenu.tsx`、`src/components/HabitRow.tsx`（关键段）、`src/pages/Stats.tsx`（关键段）、`src/pages/Build.tsx`（符号）、`src/i18n/index.ts`、`src/i18n/types.ts`（关键段）、`src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`、`src-tauri/capabilities/default.json`、`src-tauri/gen/schemas/acl-manifests.json`（权限集）、`package.json`、`node_modules/@tauri-apps/api/window.d.ts`、`node_modules/@tauri-apps/plugin-fs/dist-js/index.d.ts`、`node_modules/@tauri-apps/plugin-http/dist-js/index.d.ts`、`node_modules/@tauri-apps/plugin-opener/dist-js/index.d.ts`。

**本环境无法验证（实现时必须补）**：

1. 真机 Tauri：程序化 setSize 是否被 minWidth/minHeight 钳制；DPI/多屏/拔屏；drag-region 双击是否触发系统最大化；透明窗表现。
2. 真实 WebDAV 服务器：Nextcloud/坚果云/群晖的 PROPFIND/405/507 行为与错误文本；自签证书报错文本。
3. WebView2 的 `crypto.subtle`、`CompressionStream('deflate-raw')`、`ClipboardItem` 可用性（需真机探测；本笔记只给了兜底方案）。
4. 系统通知在窗口隐藏/最小化时的实际延迟（Chromium 节流策略随版本变化）。
5. PowerShell/资源管理器对导出 ZIP 的兼容性（需生成真实包后手动解压验收）。

---

## 附录 B：新增模块草案清单（便于排期）

| 模块 | 类型 | 约行数 | 测试 | 归属 |
| --- | --- | --- | --- | --- |
| src/platform/miniWindow.ts | 纯逻辑 + Tauri 窗口操作 | 180–240 | miniWindow.test.ts | A1 |
| src/sync/providers.ts | 纯数据/纯函数 | 80–120 | providers.test.ts | A3 |
| src/sync/diagnose.ts | 纯逻辑 + 注入 transport | 220–300 | diagnose.test.ts | A3 |
| src/logic/yearbook.ts | 纯逻辑 | 250–350 | yearbook.test.ts | A2 |
| src/render/modelStage.ts | 画布 | 120–160 | modelStage.test.ts | A2/A4/B3 |
| src/render/yearbookCanvas.ts | 画布 | 350–500 | 布局单测（jsdom stub） | A2 |
| src/components/YearbookModal.tsx | UI | 250–350 | 轻量 | A2 |
| src/platform/zip.ts | 纯逻辑 | 150–200 | zip.test.ts | A4 |
| src/platform/sha256.ts | 纯逻辑 | 80–120（含兜底） | sha256.test.ts | A4 |
| src/logic/archive.ts | 纯逻辑 | 200–280 | archive.test.ts | A4 |
| src/render/buildingShot.ts | 画布 | 80–120 | 快照/尺寸断言 | A4/B3 |
| src/logic/focusSession.ts | 纯逻辑 | 120–160 | focusSession.test.ts | B2 |
| src/logic/buildingArchive.ts | 纯逻辑 | 150–220 | buildingArchive.test.ts | B3 |
| src/logic/blueprints/manifest.ts | 纯数据 | 40–60 | content.test.ts | B1 |
| src/logic/blueprints/content.test.ts | 测试（构建期校验） | 120–180 | — | B1 |
| serializeState() 重构 | 重构（无新文件或 storage/serialize.ts） | 60–100 | persistence/import 回归 | Wave 0 |

> 行数只用于排期估算，不构成实现约束；按 AGENTS §4，单文件超 800 行应拆分。

---
