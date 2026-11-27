> 本文档由 design-scribe 于 2026-11-10 从代码事实抽取；修改设计必须先改这里再改代码。

# SURFACES.md —— 界面表面规格

**共 14 个表面**。每节：用途 / 结构骨架 / 复用组件 / 关键尺寸 / 必须遵守 / 已知例外。
**全局骨架**（App.tsx:400–497）：`.app`（flex 列、`background: var(--bg)`）→ 标题栏（桌面 `.titlebar` `10px 12px 10px 20px` ui.css:16；移动端 44px 高可点设置键 App.tsx:403–436）→ `main.content`（唯一滚动容器 ui.css:57–61）→ 底部导航（桌面 `.tabbar` / 移动 `BottomTabBar`）。所有弹窗挂 `main` 之外。`body{overflow:hidden}`（theme.css:122–125）。

## 1. 今日页 Today.tsx

- **用途**：一天的打卡主场，唯一允许"演出落块"的入口。
- **结构**：容器（`padding:24px 24px 80px; max-width:720`，Today.tsx:193）→ 页头（h1 **24px** 日期 + 建造进度胶囊 + `met/total` 计数 + 新建键）→ 分类 chip 行（仅当有分类）→ 全勤卡（全完成时）→ 回声胶囊 → 提醒横幅 → **按时段分组**（`any/morning/afternoon/evening`，栅格）→ 已归档区（虚线折叠）。
- **复用**：`.habit-grid/.habit-card`（HabitRow）、`.pill-action`、`.card`、`.echo-capsule-bar`、`.reminder-banner`、`.archive-*`、`.toast`。
- **尺寸**：卡片双列 `gap:12px`（ui.css:441–445）、卡片 `min-height:172px` / 内距 `15px`；时段小标题 `12px + letter-spacing .14em`（Today.tsx:459–466）；空态卡 `padding:52px 24px` + 56×56 图标块（r18）。
- **必须**：完成态只能由 `habitMetOnDay` 判定（Today.tsx:472–474，A6）；卡片点击=打卡、按钮点击 `stopPropagation`；元信息只用 `--ink-2`；页面只保留一个"+"入口。
- **窄屏头部（D-20261124-087）**：`.today-header` 允许 `flex-wrap`，操作组 `.today-header-actions` 整组换行、`flex-shrink:0`；蓝图胶囊与完成计数 `white-space:nowrap`。移动布局下操作组占满一行、左对齐，「+」保持右端。
- **专注入口（B4 / D-20261110-064）**：今日简报下方一条紧凑入口条（`data-testid="today-focus-entry"`，`1px --line` + `--surface` + `--r-md`），仅在「存在可开始的专注习惯（未完成、有目标时长）且当前没有任何专注会话」时出现；点击复用 `timerStore.start` 并在成功 toast「专注中」；`aria-label` 含习惯名与目标时长；移动端最小高度 ≥48px；不新增颜色。
- **例外**：全勤卡用 `--accent@7%/45%` 底色（Today.tsx:294–295，A1③ 的既有例外）；空态图标底也用 accent 14%（415）——**属越界，见 TOKENS §7**。

## 2. 建造页 Build.tsx + render/BuildScene.tsx

- **用途**：看建筑长成的地方；唯一带 3D 交互（旋转/缩放/悬停读砖/透视考古）的表面。
- **结构**：顶栏（名称 + `n/m 块` + 6px 进度条 max 260 + [奠基铭言|纪念相纸] + 光照时段胶囊 + 透视考古开关 + 图鉴）→ 画布区（flex 1）→ 右上角悬浮旋转控件（绝对 `right:18; top:18`、胶囊 999、`3px 8px` 内距）→ 左下角奠基铭言卡 / 开荒引导文案 → 落成仪式全屏层。
- **复用**：`BuildScene`、`.btn.ghost/.primary`、`.brick-inspect-popover`、`GalleryDialog/PolaroidModal/FoundationNoteDialog`。
- **尺寸**：顶栏 `14px 20px` + `border-bottom:1px solid var(--line)`（Build.tsx:51–61）；按钮统一 `padding:7px 12px; font-size:13`；进度 6px 高、`border-radius:999`。
- **必须**：画布占满剩余高度且不产生滚动；旋转只重绘、不重播动画；**不在这里新增文字按钮以外的装饰**（顶栏已 5 个控件，达上限）；X-Ray 开关必须与设置默认态区分（本会话态 vs `settings.enableXRayInspection`）。
- **窄屏顶栏（D-20261124-087）**：顶栏拆为 `.build-top-bar-main`（名称 / 块数 / 进度）与 `.build-top-bar-actions`（铭言 / 相纸 / 光照 / 透视 / 图鉴）；窄宽时 actions 整行落到第二行，按钮与文字 `white-space:nowrap`；画布容器 `min-height:0 + overflow:hidden`，底部地基说明必须留在 tab bar 之上。
- **例外**：旋转控件浮层带 `boxShadow: 0 2px 8px rgba(0,0,0,.06)`（Build.tsx:153）——唯一在画布上允许的阴影。

## 3. 统计页 Stats.tsx

- **用途**：手账目录 —— 指标热图 + 手账长廊两种视图。
- **结构**：容器（`28px 24px 80px; max-width:680`，Stats.tsx:160）→ 页头（h1 **20px** + 13 周副标 + 专注累计）→ 右侧 [纪念品] + 修复砖徽章 → `.apple-segmented` 双视图 → 回声胶囊 → 指标视图（每习惯一张 card：热图 + 名称/频率 + 4 个数值 + 近期随笔）或手账视图（检索卡 + 习惯下拉 + 心境 chip + 卡片列表 + 加载更多）。
- **复用**：`Heatmap`、`.apple-segmented`、`.card`、`.micro-mood-chip`、`.chronicle-card`、`ConfirmDialog/MonthlyPosterModal`。
- **尺寸**：习惯卡 `padding:16px 18px; margin-bottom:14px`；热图 `cell:13 / weeks:13`，间距 `max(3, round(cell×0.22))`、圆角 `max(4, round(cell×0.28))`（Heatmap.tsx:29–31、89）。
- **必须**：热图颜色只走完成绿（`--progress-green` 按完成度叠在 `--surface` 上，全完成日满亮；D-20261124-090 取代 D-035 的灰阶），蓝色不参与热图；格子必须是 `<button>` 且带 aria-label（补签可达性，Heatmap.tsx:79–85）；补签只允许过去 7 天且需二次确认。
- **导出入口（D-20261124-084）**：页头只保留一个「纪念品」胶囊，打开 `MemorabiliaDialog`；月度画报 / 年鉴 / 建筑档案 / 拍立得 / 完整档案包都从该弹层进入，不再在页头并排两个按钮。
- **窄屏页头（D-20261124-087）**：`.stats-header` 允许换行，操作组 `.stats-header-actions` 整组换行、`flex-shrink:0`；移动布局下操作组占满一行、左对齐，360px 下「纪念品 / 修复积木」不得溢出。
- **例外**：修复砖徽章与回声胶囊用 accent（Stats.tsx:209、244–245）——越界。

## 4. 展台 Showcase.tsx + render/ShowcaseScene.tsx

- **用途（D-20261127-127 / D-20261128-129）**：已落成建筑的多沙盘陈列；左抽屉切沙盘、右抽屉「堆场」收放未陈列建筑；右键 / 长按建筑旋转 90° 或收拢回堆场。展台**不生成任何植被**，沙盘颜色只作用于底座。
- **结构**：顶栏（标题 **16px** + 当前沙盘名 + 拖拽/右键提示 12px + [自动排列] + 陈列计数胶囊）→ 画布（flex 1，`background: var(--bg)`）→ 左抽屉（沙盘列表 / 新建 / 颜色）与右抽屉（堆场）→ 右键菜单（portal 到 body）→ 点选建筑 → `PolaroidModal`。
- **多沙盘**：`showcaseSandboxes`（id / placements / design）+ `activeSandboxId`；上限 **4**，至少保留 1 个；新建立即切换，按序号自动轮换颜色（苔绿 → 石白 → 暖沙 → 素盘）。一座建筑**同一时间只陈列在一个沙盘**；删除沙盘只回收摆放，建筑回堆场，不删完成态。
- **沙盘颜色**：`design` 的四种取值只改变底座顶面/裙边颜色（苔绿 `#4f776a`、石白 `#a89f91`、暖沙 `#e9c46a`、素盘不染色）；颜色与主题块面按比例混合，保持顶 > 左 > 右的明暗阶梯，建筑积木不染色。
- **堆场**：`completedBlueprintIds` 减去所有沙盘 placements 的派生视图，分「待陈列」与「在其他沙盘」两段；点击即放上当前沙盘（自动找第一个空位），在其他沙盘的建筑点击即移动过来。每行 `BlueprintThumb` **84×56**，在其他沙盘的条目用单色剪影；沙盘满时 toast `yardFull`。
- **旋转 / 收拢**：右键菜单「旋转 90°」「收拢回堆场」；旋转写入 `ShowcasePlacement.rotation`（0–3，缺省 0）并持久化；先过 `canRotatePlacement`（不出界 / 不与邻居 AABB 重叠），失败 toast `rotateBlocked` 并保持原状。收拢 = 从当前沙盘移除 placement。移动端长按 **520ms** 打开同一菜单；左键点击仍打开拍立得。
- **抽屉**：左右各一枚 **44px** 宽竖向标签（`‹/›` + 竖排「沙盘 / 堆场」+ 数量徽章），与 **252px** 面板是同一块表面：统一 **360px** 高、同一 `--surface` 背景与 1px `--line` 边框，标签侧圆角、贴窗口的外侧为尖角（左抽屉去左圆角，右抽屉去右圆角），标签与面板之间无分割线。展开用 `grid-template-columns: 0fr → 1fr` 平滑延伸（`--dur-lg` / `--ease-standard`，不做透明度淡入），默认收起，关闭时 `inert` + `aria-hidden`；覆在画布两侧，不改变画布尺寸；切沙盘用 `viewFitKey` 重新取景。DOM 顺序固定为「标签 → 面板」，左侧用 `flex-direction: row-reverse` 反转视觉，保证 Tab 能直接进入面板内容；移动端面板宽 `min(252px, 72vw)`。
- **复用**：`ShowcaseScene`（26×26 网格、slabH 12）、`BlueprintThumb`（堆场）、`.btn.ghost`、`.toast`、`.sc-*`（`ui-showcase.css`）。
- **尺寸**：顶栏 `14px 20px` + 1px 底边；抽屉 360px 高（左右一致），标签 44×360；颜色 chip 两列等分；右键菜单最小 184px。
- **必须**：落位必须过 `canPlaceModel`（AABB 无重叠 + 不出界，按各 placement 的持久化旋转计算）；非法落位画红虚线脚印 + `haptic('warning')`；满位要 toast（`fullHint` / `yardFull`）而不是静默覆盖；沙盘颜色只影响底座，不上 UI、建筑或抽屉背景。
- **窄屏（D-20261124-087）**：顶栏 `flex-wrap`，标题 `white-space:nowrap`，hint 可整段换行；画布容器 `min-height:0 + overflow:hidden`，不得溢出到 tab bar 之后；抽屉标签保持 ≥44px 触控目标。
- **历史（D-20261111-068，已退役）**：全落成解锁的「装饰模式」、会话旋转与「换一组植被」已由本方案取代；D-20261128-129 进一步移除展台植被与植被种子，只保留底座颜色。旧入口、会话旋转、植被与相关文案不再存在。原文保留在本记录与 SURFACES 历史版本中。
- **例外**：拖拽提示图标、自动排列图标用 accent——越界。

## 5. 图鉴弹窗 GalleryDialog.tsx

- **用途**：全部蓝图（当前 35 座，随内容包动态；`blueprintOrder` 为唯一来源）的解锁顺序与切换当前目标。
- **结构**：`.overlay > .dialog`（宽 **500**）→ `.dialog-header`（标题 + 总数 + 关闭）→ `.dialog-body > .gallery-grid`（**3 列**）→ 每卡：`BlueprintThumb` 缩略图 + 名称 14px/600 + 状态 11.5px → `.dialog-footer`（关闭）。
- **尺寸**：`gap:10px`、卡片 `padding:14px 12px`（ui.css:570–586）；锁定态 `opacity:.5` 且 hover 不动。
- **必须**：解锁顺序 = `blueprintOrder`（logic/blueprints/index.ts:30–43），前一座未落成才锁；锁定态不加锁图标（用状态行表达）。
- **缩略图（D-20261124-092）**：缩略图 132×92、外层 `.gallery-thumb` 裁剪；建造中只画已落块（`placedCount`），并叠一层极淡完整轮廓提示计划形态；fit `pad=12 / maxScale=0.72`，高模型不得顶到卡片边。
- **例外**：无。

## 6. 设置弹窗 SettingsDialog.tsx

- **用途**：通用 / 数据与同步 / 关于 / 实验室 **四组**，全部可折叠。
- **结构**：桌面 `.dialog`（宽 **480**）· 移动 `BottomSheet` → `.dialog-body` 内分组：**通用**（语言/主题/提醒/晚间收尾 + 声音子段 + 系统子段：开机自启 / 全局快捷键）· **数据与同步**（导出/导入、习惯导入、诊断包、备份、WebDAV）· **关于**（内容路线/版本）· **实验室**（进阶视觉开关与页面提示）→ `.dialog-footer` 常驻「完成」。
- **内容路线（C2 / D-20261110-063 §3.5.5）**：只展示事实 —— 当前内置蓝图数与积木数（从 `blueprintOrder`/manifest 动态计算，禁止硬编码）、当前 contentVersion、年度免费扩建节奏（随安装包内置、不联网下载、不额外收费）、跨设备升级说明（更高内容版本会让旧设备拒绝读取并暂停保存）、本地优先与无遥测承诺。**不得写死未来内容包日期**；文案 zh/en 齐全，数值随内容版本自动更新。
- **版本与更新（D-20261111-069）**：内容路线组内一行「版本与更新」——当前版本 + 检查更新按钮；状态机 idle/checking/up-to-date/available/error；**只有用户点击才联网**，无启动自动检查、无静默下载；发布链路未配置时按钮禁用并如实说明（不得出现点了没反应的按钮）；取消只忽略迟到结果（插件无 abort API，UI 不得误报失败）；不新增颜色/控件类型。
- **尺寸**：`.apple-group` = `ink@2.5%` 底 + `1px --line` + `--r-md` + `14px 16px` + `gap:10px`（ui.css:334–343）；组标题 `11px/700 + uppercase + letter-spacing .05em`（345–352）；每行 `.field` `margin-bottom:12px`。
- **必须**：所有开关必须来自 `settings.*` 且写回 store；关闭态文案不得出现"未实现占位"（历史上出现过幽灵开关）；组内每行一个决策，不叠加说明文字超过 2 行。
- **摆件控制（D-20261124-091，重建中）**：桌宠分组与代码不在当前提交；设置里暂时没有桌宠入口。
- **习惯导入（D-20261124-085）**：数据安全组内、导出/导入备份之后新增「从其他应用导入习惯」：CSV/JSON → 预览可导入/跳过数量 → 用户确认后才写入；只导入习惯定义，不导入历史打卡。
- **全局快捷键（D-20261124-086）**：系统集成组新增「全局快捷键唤起」，默认关；开启后 `Ctrl/⌘+Alt+H` 显示主窗、取消最小化、聚焦并回到今日页；注册失败回滚开关并提示。
- **动作行与说明（D-20261126-114）**：设置内所有动作按钮放在 `.settings-actions`（flex 等分，单个也占满行宽，边界与「导出备份 / 导入备份」两列一致）；说明文字用 `.settings-hint` 独立成行、落在按钮**下方**。仅「立即同步」（状态行左 + 按钮右）与「检查更新」（关于组内右对齐）保留并排。
- **WebDAV（D-20261126-114）**：不再提供服务商选择，只保留「通用」 —— 一个始终可编辑的 WebDAV 地址（含用户名 / 密码 / 记住密码 / 测试连接 / 自动同步）。旧存档的预设端点原样回显，不做改写。
- **积木上限**：设置尾部「修复积木库存」与统计页同读 `REPAIR_MAX`（4），不得写死数字。
- **桌宠颜色**：`.settings-swatch-grid` 6 列等分，材质色 11 + 跟随主题 = 12 格两行；色值限定 D-067 批准材质色板。
- **晚间收尾时间（D-20261126-117，取代 D-20261126-115）**：「开启 / 免打扰」+ 时间控件同占一行（分段吃剩余宽度）。时间控件**常态只有一行**（`.tw` 36px，靠不可见的 `.tw-sizer` 撑出布局尺寸）；点击后 `.tw-panel` 以当前行为锚点**浮层**上下各展开一行（36 → 86px，`position: absolute`），因此行高、下方元素位置与弹窗 `scrollHeight` 都不变，页面也不会被带着滚。展开态显示墨色边框 + 2px 墨色外环 + 一层极软分层阴影作为聚焦点。左 0–23 / 右 00–59 双列首尾循环，行高 `--tw-row: 26px`，中心 `1px --line` 选中带；滚轮一格 = 一行且按指针所在列分派，展开期间临时锁住最近的可滚动祖先，收起（点外部 / Esc / 失焦）即恢复；键盘 ↑↓/PgUp/PgDn/Home/End 可用；关闭开关时整组 0.45 透明度且不可交互。不用原生滚动与 `scroll-snap`（WebView2 下一格两行并回跳）。
- **分组展开 / 收拢（D-20261127-126）**：所有可折叠分组统一用 `Collapse`（`grid-template-rows 0fr → 1fr` + 透明度，`--dur-md` / `--ease-standard`）；收起动画结束后才卸载子面板（保持惰性挂载，WebDAV/备份不会在弹窗打开时提前发 IPC）；关闭期间 `aria-hidden` + `inert`，焦点不进入隐藏内容；`prefers-reduced-motion` 下立即切换。
- **实验室（D-20261127-127 / D-20261128-129 / D-20261128-130）**：不再包含「建筑微生态彩蛋」开关。建造页微生态已整体下线，展台也不再生成植被；沙盘由每个沙盘自己的底座颜色决定（苔绿 / 石白 / 暖沙 / 素盘）。
- **例外**：无（WebDAV 已并入「数据与同步」组）。

## 7. 习惯弹窗 HabitDialog.tsx

- **用途**：新建/编辑习惯（瞬时 / 专注 / 步进三种类型）。
- **结构**：桌面 `.dialog.habit-dialog`（宽 **460**，ui.css:237–240）· 移动 `BottomSheet` → `.dialog-header` → `.dialog-body` 表单流（名称 → 类型 seg → 频率 seg + 星期/次数 → 时段 seg → 到点提醒 → 目标时长/目标数值 → 分类 → 备注）→ 底栏（归档 / 取消 / 保存）。
- **复用**：`.field`、`.seg`、`TimeStepper`（`.ts-btn/.ts-num`，22px 方块、等宽数字）。
- **尺寸**：输入 `padding:9px 12px` + `1.5px` 描边、聚焦变 `--ink`（ui.css:279–292）；星期格 `height:34px; border-radius:8px`（HabitDialog.tsx:279–290）。
- **必须**：校验错误就地显示在字段下方（`--danger` 11.5px）；未选星期必须拦住保存；关闭前不丢已填内容（仅 Esc/取消丢弃）。
- **「更多设置」（D-20261127-126）**：选填项容器用 `Collapse` 做高度 + 透明度过渡（`--dur-md` / `--ease-standard`），收起动画结束后卸载；按钮 `aria-expanded` 与箭头旋转保持；与上方首个字段的 16px 间距沿用 D-20261124-108，不被折叠容器吃掉。
- **例外**：星期格与频率滑块用 8px 圆角与 `accentColor: var(--progress-green)`（HabitDialog.tsx:313），偏离 `--r-sm` 体系。

## 8. 积木掉落弹窗 BlockDropModal.tsx

- **用途**：打卡成功的唯一演出 + 即刻镌刻。
- **结构**：`.drop-overlay`（ink 35% + blur 12px）→ `.drop-modal`（宽 **440**，r-lg）→ 标题行（**+1 积木** 琥珀胶囊 + 完成文案 + 跳过）→ **3D 舞台 `height:240` `background:var(--bg)`** → 镌刻抽屉（心境 chip + 星标 + 输入 + 镌刻）→ 底部进度（6px 条）。
- **尺寸/时序**：入场 0.24s `cubic-bezier(.34,1.2,.64,1)`；落地后抽屉 `max-height 0→150`（0.32s）；落地后 **3.6s 自动关闭**（BlockDropModal.tsx:64–66），输入/点心境即取消计时。
- **必须**：Esc/点遮罩 = 跳过（`useDialogA11y`）；动画期间不得让弹窗高度跳动；镌刻成功必须有 toast 回执。
- **例外**：标题胶囊是全应用唯一"实心琥珀底 + accent-ink 字"的控件（BlockDropModal.tsx:131–142），视为 A1③ 的合法表达。

## 9. 提醒弹窗 ReminderDialog.tsx（+ 今日横幅）

- **用途**：到点提醒，多个提醒合并一窗。
- **结构**：`.overlay > .dialog.reminder-dialog`（宽 **380**）→ `.dialog-header` → `.dialog-body`：三块**积木依次掉落咬合**（34×22、r5、`3px 3px 0 0 --block-left` 伪厚度）→ `.reminder-list`（每条 `1.5px --line` + r-md + accent 5% 底）→ 三按钮（开始打卡 / 稍后提醒 / 跳过今天）。
- **今日横幅**：`.reminder-banner`（1.5px accent 45% 描边 + accent 8% 底），点击重新打开队列。
- **必须**：队列只呈现一次，不连环弹窗；「临近截止」必须走 `.danger` 语义（现状用了 accent —— 越界）；贪睡次数上限要有 toast。
- **时序**：首块落定 550ms 后播 `playSnapSound`（ReminderDialog.tsx:35–44）。

## 10. 拍立得 / 月度画报（PolaroidModal、MonthlyPosterModal）

- **用途**：可导出的两件"印刷品"，是产品唯一的分享出口。
- **拍立得**：画布 **500×640 @2x**（预览 320×410、r8）→ 正面：白纸 + 440×430 照片框 + 题名 + 铭言 + 品牌水印；背面：`#faf8f5` 米黄 + 双层虚线框 + 奠基石印章卡 + 时间轴（节点圆点、每行 82px）+ 页脚档案行。
- **画报**：`4:5 600×750 / 9:16 540×960 / 1:1 600×600` @2x；`margin:24`；年月 36px + 英文月 15px + 分隔线 → 模型舞台 + 进度 → 30 日矩阵（cell 25 / gap 5 / r4）→ 4 张指标卡（43px 高、r8）→ 引言 → 页脚。
- **必须**：画布内所有颜色都必须来自 `getComputedStyle` 读主题变量（MonthlyPosterModal.tsx:83–90 是正确范式）；导出前显式 `spriteScale:2` 否则图块面模糊；中英文书名号差异必须注释说明（MonthlyPosterModal.tsx:208–209）。
- **例外（已批准）**：拍立得正反面硬编码米白/米黄纸色（`#ffffff/#f8faf5/#faf8f5/#e7e2d7` 等 33 处）是"实体相纸隐喻"，2026-09-30 方案 §7.6 明确保留；**仅限这两个导出表面，不得扩散到 UI**。

## 11. 托盘右键菜单 TrayMenu.tsx

- **用途**：托盘右键的极简弹窗（打开主窗 / 退出）。
- **结构**：透明窗口（`html[data-win='tray-menu']` theme.css:109–113）→ `.tray-menu-root`（`padding:22px`）→ `.tray-menu-card`（r16、`padding:6px`）→ `.tray-menu-head`（logo 22px + BlockHabit）+ 2 个 `.tray-menu-item`。
- **尺寸纪律**：**阴影范围必须 ≤ 22px 窗口留白**，否则在透明窗口边界被裁成"透明膜"（ui.css:617–624 有注释）。当前阴影 `0 2px 8px rgba(0,0,0,.22)`。
- **必须**：背景 transparent（不能画圆角矩形底）；hover 反色（ink 底 / bg 字）；"退出"hover 用 `--danger`。
- **例外**：无。

## 12. 积木桌宠 PetWindow（设计规格见 D-20261124-091 / D-20261127-125）

- **用途**：常驻桌面的积木角色；会呼吸、眨眼、走动；与今日打卡进度联动；双击唤起主窗，右键打开桌宠设置。
- **窗口**：96×128 逻辑像素，`transparent`、`decorations:false`、`isAlwaysOnTop`、`skipTaskbar`、`shadow:false`、`resizable:false`、`focus:false`、不可见启动。
- **形象**：只保留 `block` 单块积木（圆角积木 + 顶面一枚凸点 + 正脸五官）；猫 / 机器人形态与桌宠蓝图已下线。
- **自定义**：大小 小/中/大；材质色（跟随主题或 D-067 批准色）；自主走动开关。右键打开 236×252 独立面板，面板内只有大小与自主走动。
- **联动**：主窗通过 `pet-config` 事件同步今日 `done/total`；完成数增加时跳一下并显示 2.6s 的 `done/total` 气泡。
- **动效**：idle 呼吸 + 随机眨眼；walk 左右移动并碰工作区边缘反弹；点击跳跃；拖动改位置。
- **必须**：位置按当前显示器工作区钳制并存设备本地 `windowLayout.pet`（旧 `mini` 位置迁移）；不抢主窗焦点；不做逐像素穿透——窗口仅 96×128，透明边缘仍会拦截该小方块内的点击；开关默认开。

## 13. 移动端 BottomSheet.tsx / BottomTabBar.tsx

- **BottomSheet**：`maxHeight:85vh`、遮罩 `var(--overlay)+blur 4px`、顶角 `--r-lg`、拖拽把手 36×4.5px r3、**下滑 >75px 关闭**、安全区内距 `max(16px, env(safe-area-inset-bottom))`、标题 17px/700、关闭键 30px 圆形 `ink@6%`、内容 `16px 20px`、底栏 `12px 20px`。**任何移动端弹窗都必须走它**（ConfirmDialog/HabitDialog/SettingsDialog 已接入）。
- **BottomTabBar**：`height: calc(56px + max(12px, safe-area))`、`background: surface@82% + blur 25px saturate 190%`、`border-top: .5px`（**全应用唯一 0.5px 线**）、active 项 `ink@4.5%` 底 + 14px 圆角 + 图标 scale 1.08、指示条 14×2.5px 胶囊、徽章 6px 圆点 / 99% 文本。
- **必须**：移动端所有输入框 `font-size≥16px`（mobile.css:80–90 防 iOS 缩放）；触控目标 ≥44px；只保留 4 个 tab。
- **例外**：tab 指示条与徽章用 accent（BottomTabBar.tsx:41/64/169）——越界，但改动前需先决定"导航状态用什么表达"。

## 14. 表面间通用禁令

1. 弹窗一律 `.overlay + .dialog(`header/body/footer`)` 三段式；`overflow:hidden` 保证圆角硬裁切（ui.css:183）。
2. 不允许出现第二个滚动容器（除 `.dialog-body` 与移动端 `.mobile-content-area`）。
3. 不新建"直角卡片/下划线链接/彩色标签"；标签用 `.pill-action`。
4. 状态色只有三档：绿=完成、蓝=进行中、红=危险；其余靠黑白反转。
5. 空态必须给"下一步动作"（新建 / 去今日打卡 / 自动排列），不允许只有一句"暂无数据"。
6. 每个表面最多 1 个主行动按钮（`.btn.primary`），其余 `.btn.ghost` 或 `.icon-btn`。

---

## 4. 2026-11-10 第四轮增补（D-20261110-052 … -056）

> 以下表面沿用既有令牌与圆角，不新增色相 / 阴影档位；详细决定见对应记录。

### 4.1 今日简报 TodayBrief（today）
- 位置：今日页标题行之下、分类过滤之上；有在册习惯且今天未全部完成时渲染，全部完成隐藏（全勤卡接管）。
- 结构：左侧问候（`--fs-subhead`/700）+ 事实行（`--fs-small`/`--ink-2`）+ 里程碑行（`--fs-caption`/`--ink-2`，图标 12px）；右侧主按钮（`--fs-body`，胶囊）。
- 尺寸：`padding:12px 16px; border:1px solid var(--line); radius:var(--r-md); margin:14px 0 6px`；窄窗口 CTA 自动换行。
- 必须：完成/剩余只由 `habitMetOnDay` 判定；CTA 滚动复用 `.habit-focus-flash`；不新增颜色与阴影。

### 4.2 模板行 HabitTemplates（today 空态）
- 位置：三步说明之后、按钮行之前；一行胶囊 + 前缀「或者，从这些开始」。
- 数据：`src/logic/habitTemplates.ts`；文案 `templates` 组；创建走现有 `addHabit`（daily / instant）。
- 必须：不得伪造进度；模板只是快捷入口，完整表单与右上角 + 保留。

### 4.3 晚间提醒授权卡 EveningNudgeConsent（today）
- 首次打卡后、`consent` 未记录时出现一次；两个按钮（开启 / 暂时不用），选择写 localStorage（`blockhabit.eveningNudge.v1`），不进存档。
- 样式同简报卡（`--surface` / `--line` / `--r-md`），图标用 `--ink-2`。

### 4.4 页面提示 GuideTip（build / showcase / stats）
- 固定态：`left:20; bottom:84; max-width:320; z-index:60`；内联态：文档流 `margin:12px 0`。
- 结构：标题 `--fs-body`/600 + 正文 `--fs-small`/`--ink-2` + 右对齐 ghost 胶囊「知道了」。
- 必须：`role=note`、不抢焦点、Esc 可关（弹窗打开时让给弹窗）、无动画；已读存 `localStorage: blockhabit.guideTips.v1`。

### 4.5 设置页新增
- 提醒组「晚间收尾提醒」：seg 开/关（`min-width:132`）+ `<input type="time">` + 说明；与全局提醒开关联动。
- 实验室组「页面提示 / 重看页面提示」：清空已读并 toast，下次进入三页重新出现。

---

## 5. 2026-11-10 第五轮增补（D-20261110-059 / -060 / -061）

> 以下是对既有表面规格的**增补**；§3 / §6 / §12 的旧描述保留为历史快照，不删除。所有新表面沿用既有令牌、圆角与 1px 线，不新增色相 / 阴影档位。

### 5.1 迷你摆件三档（**superseded by D-20261124-088**，仅历史留存）
- 尺寸（逻辑像素，含边框）：口袋 220×150（header 34 / footer 72 / 3D ≥36；1 个快捷打卡）；标准 280×400（34 / 124；3 个快捷打卡）；展台 420×560（36 / 170；3D + 今日清单 ≤5 行，行高 32）。footer 按 32px 命中区修正（2026-11-10 独立验证 P2-1）。
- 结构：32px 头部按钮（置顶 / 展开 / 关闭）+ 双击拖拽区展开主窗；3D 区 flex 1；底栏按档位切换信息密度（口袋：里程碑 + 1 胶囊；标准：蓝图名 + 进度 + 3 胶囊；展台：进度 + 今日清单）。
- 必须：Tauri 下窗口尺寸 = 预设；进入前显式 `setMinSize` → `setSize`，退出 `setMinSize(900×600)` 并恢复主窗尺寸/位置；置顶默认**关**；位置存设备本地 `blockhabit.windowLayout.v1` 并按当前显示器工作区钳制；浏览器预览按预设尺寸居中模拟（仅开发期）。
- 例外：口袋进度条 3px（其余表面 5–6px），属尺寸压缩的合理例外。

### 5.2 落成年鉴（stats + YearbookModal）
- 入口：统计页页头 [月度画报] 右侧 [年鉴]（`.btn.ghost` 胶囊 + `IconGallery` 14px），不重排原布局。
- 弹层：`.dialog` 宽 **760**；`.dialog-header` 标题「落成年鉴」；主体左侧年份 tablist（vertical，选中 = `--ink` 实底 + `--bg` 字），右侧竖版画布等比预览（约 320×534）；底部 [保存图片 ghost][复制图片 primary][导出 Markdown ghost][关闭 ghost]。
- 画布：逻辑 **720×1200**、导出 **1440×2400**（DPR2）；纸白/墨色/1px 线，所有颜色从 `getComputedStyle` 读取主题令牌；导出前 `await document.fonts.ready`。建筑年表**单页两列、最多 12 座**（每列 6，超出 +N）。
- 必须：零新字段、墓碑排除、建筑只认「块数 ≥ 蓝图容量」且落成日 = `max(placedAt)` 的本地日期；空年份显示诚实空态且不生成文件；不新增颜色与字体。

### 5.3 WebDAV 服务商预设与连接自检（settings）
- 位置：WebDAV 组顶部新增「服务商」seg（Nextcloud / 坚果云 / 群晖 / 通用）+ 应用专用密码提示（按 `requiresAppPassword` 显示）；固定端点（坚果云）地址只读；地址/用户名/密码保持原布局；其下新增 [测试连接][清除保存的凭据]。
- 结果区：1px `--line` 边框 + `--r-sm`；首行状态（成功绿 / 失败 ink）+ 耗时；5 行阶段 ✓/✕（地址 / 连接 / 认证 / 读写 / 清理）；失败时给一条建议 + [复制错误详情]；`aria-live="polite"`。
- 必须：自检独立于同步合并、只写/删唯一临时文件；结果与复制内容不含密码/Basic token；浏览器预览不发起请求，只提示「需在桌面端运行」；http:// 地址被安全策略拦截并明确说明。


### 5.5 建筑档案卡（gallery + BuildingArchiveModal，D-20261110-065）
- 入口：图鉴已落成卡片右下角新增「档案」pill（ghost，11.5px，`aria-label` = 建筑名 · 建筑档案）；点卡片其余区域仍为「选择当前蓝图」，零回归。
- 弹层：`.dialog` 宽 680；顶部建筑名 + 第 N 座 / 共 N 座 + 落成日期；中部等距大图舞台（640×260@2x，`--bg` 底）；数据格（积木/耗时/投入最多/全勤日/奖励块）；关键块时间线（首、25%、50%、75%、末，按钮可展开当天随笔/心境/星标）；底部奠基石铭言内联编辑 + [拍立得][保存档案卡][关闭]。
- 画布：档案卡 640×880 逻辑、@2x 导出 1280×1760；颜色全从 `getComputedStyle` 令牌读取，导出前 `await document.fonts.ready`。
- 必须：落成日必须 = `max(placedAt)`；第 N 座按落成时间而非 `completedBlueprintIds` 顺序；`fromHabitId` 统计投入最多习惯；旧档缺失不伪造日期（显示「不可考」）；Esc/焦点圈闭复用 `useDialogA11y`；不新增持久化字段。
### 5.4 设置页摆件尺寸 / 置顶（**superseded by D-20261124-088**，仅历史留存）
- 位置：实验室组「常驻悬浮摆件」行之后；尺寸 seg（口袋 / 标准 / 展台）+ 置顶 seg（开启 / 关闭），各配一行 `--fs-caption` 说明。
- 必须：默认 `standard` + 置顶关；使用中变更尺寸/置顶即时应用到当前窗口；设置值随存档同步（设备偏好）。

### 5.6 完整档案包（settings → 数据安全，D-20261110-062）
- 位置：数据安全组内、导出/导入 JSON 之后新增「完整档案包」面板：标题 + 一行说明 + 内容清单（README / manifest / 数据 JSON / 校验清单 / 建筑图）+ 主按钮 [导出完整档案包]。
- 进行中：按钮下方进度文本（`t.archive.progress(done,total)`）+ 可取消；完成后显示结果行 + [打开档案包]（桌面 `revealItemInDir`）；失败显示错误并清理临时目录。
- 桌面产物：`appDataDir/exports/BlockHabit-Archive-<ISO>/`，包含 `README.md`、`manifest.json`、`data/blockhabit-state.json`、`data/checksums.txt`、`buildings/NN-<id>.png`（透明 640×640 RGBA，已落成建筑）；先写 `.tmp` 再 rename，同名加 `-2`；失败/取消递归清理。
- 浏览器：不落盘，直接下载单 ZIP（STORE+CRC32；`CompressionStream` 可用时文本可选 DEFLATE），文件名 `BlockHabit-Archive-<ISO>.zip`。
- 必须：state.json 必须能经 `prepareImport` round-trip；manifest/checksums/实际文件三者一致；**不含 WebDAV 凭据**；新窗口/并发导出有 busy 闸；不新增颜色。

### 5.7 专注陪伴（**摆件面板部分 superseded by D-20261124-088**；专注会话本身保留于今日页）
- 触发：今日页专注习惯开始计时后，摆件检测到活动会话（设备本地 `blockhabit.focusSessions.v1`，绝对时间）。
- 面板：摆件底栏切换为专注面板 —— 习惯名 + 相位文案（专注中 / 时间到，确认后落块）+ 剩余 `mm:ss` + 静态环形进度（`--ink` 描边，无循环动画）+ 主按钮 [确认落块]（ready 时）/ [再等 5 分钟]（最多 2 次）+ [放弃]（二次确认）。
- 三档：口袋只保留倒计时 + 主按钮（32px）；标准显示环形 + 两个按钮；展台增加一行诚实提示。三档均不裁切，英文两行完整。
- 必须：到点只进 ready，绝不自动打卡；确认才 `checkIn(actualMinutes)`；放弃不产生任何打卡；`notifiedAt` 先落盘再通知（重启不重复）；只显示用户主动启动的计时，不监控/不阻断；reduced-motion 无动画。

### 5.8 扩展内容包与图鉴剪影（gallery / build，D-20261110-063）
- 内容：基础 12 座之后追加 6 座免费扩展蓝图（林间树屋 / 玻璃温室 / 钟楼 / 石拱桥 / 山顶天文台 / 旧图书馆），图鉴/建造/容量/展台/年鉴/档案全部按注册表动态总数（18），不硬编码。
- 图鉴：锁定卡使用 `BlueprintThumb` 的 `silhouette` 模式——只用 `--ink` 透明度派生灰阶、透明底、忽略建筑自定义色、不画虚线地基；卡片不再整体压暗，名字与「待解锁」保持可读；已完成/当前建筑视觉不变。
- 解锁：完成基础 12 座后自动指向扩展包第一座，其余按 `blueprintOrder` 顺序解锁；旧 12 座数据与视觉零改动。
- 必须：内容版本门（`contentVersion=2`）先于 sanitize；旧客户端读新档只能 needsUpgrade，不得静默清洗；图鉴 18 卡可滚动，底部关闭按钮固定。

## 15. 纪念品中心 MemorabiliaDialog（D-20261124-084）

- **用途**：统计页唯一的导出入口，聚合月度画报 / 落成年鉴 / 建筑档案 / 拍立得 / 完整档案包。
- **结构**：`.overlay > .dialog`（宽 **560**）→ `.dialog-header`（标题 + 关闭）→ `.dialog-body`：一行说明 → 2 列自适应卡片（画报 / 年鉴）→「建筑档案与相纸」：已落成建筑下拉 + [打开档案][拍立得] → `.field` 内嵌 `ArchiveExportPanel` → `.dialog-footer`（关闭）。
- **嵌套**：月度画报 / 年鉴 / 建筑档案 / 拍立得直接复用既有弹层；任一下级打开时，纪念品中心让出 Esc / 焦点圈闭。层级：本弹层 `z-index:110`，档案卡 115，相纸与画报/年鉴 120。
- **必须**：只列已落成建筑；空态如实显示「还没有落成的建筑」，不出现选择框、不生成假条目；不新增画布、不新增持久化字段、不新增颜色；移动端走 `BottomSheet`。
- **例外**：无。
