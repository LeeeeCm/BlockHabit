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
- **例外**：全勤卡用 `--accent@7%/45%` 底色（Today.tsx:294–295，A1③ 的既有例外）；空态图标底也用 accent 14%（415）——**属越界，见 TOKENS §7**。

## 2. 建造页 Build.tsx + render/BuildScene.tsx

- **用途**：看建筑长成的地方；唯一带 3D 交互（旋转/缩放/悬停读砖/透视考古）的表面。
- **结构**：顶栏（名称 + `n/m 块` + 6px 进度条 max 260 + [奠基铭言|纪念相纸] + 光照时段胶囊 + 透视考古开关 + 图鉴）→ 画布区（flex 1）→ 右上角悬浮旋转控件（绝对 `right:18; top:18`、胶囊 999、`3px 8px` 内距）→ 左下角奠基铭言卡 / 开荒引导文案 → 落成仪式全屏层。
- **复用**：`BuildScene`、`.btn.ghost/.primary`、`.brick-inspect-popover`、`GalleryDialog/PolaroidModal/FoundationNoteDialog`。
- **尺寸**：顶栏 `14px 20px` + `border-bottom:1px solid var(--line)`（Build.tsx:51–61）；按钮统一 `padding:7px 12px; font-size:13`；进度 6px 高、`border-radius:999`。
- **必须**：画布占满剩余高度且不产生滚动；旋转只重绘、不重播动画；**不在这里新增文字按钮以外的装饰**（顶栏已 5 个控件，达上限）；X-Ray 开关必须与设置默认态区分（本会话态 vs `settings.enableXRayInspection`）。
- **例外**：旋转控件浮层带 `boxShadow: 0 2px 8px rgba(0,0,0,.06)`（Build.tsx:153）——唯一在画布上允许的阴影。

## 3. 统计页 Stats.tsx

- **用途**：手账目录 —— 指标热图 + 手账长廊两种视图。
- **结构**：容器（`28px 24px 80px; max-width:680`，Stats.tsx:160）→ 页头（h1 **20px** + 13 周副标 + 专注累计）→ 右侧 [月度画报] + 修复砖徽章 → `.apple-segmented` 双视图 → 回声胶囊 → 指标视图（每习惯一张 card：热图 + 名称/频率 + 4 个数值 + 近期随笔）或手账视图（检索卡 + 习惯下拉 + 心境 chip + 卡片列表 + 加载更多）。
- **复用**：`Heatmap`、`.apple-segmented`、`.card`、`.micro-mood-chip`、`.chronicle-card`、`ConfirmDialog/MonthlyPosterModal`。
- **尺寸**：习惯卡 `padding:16px 18px; margin-bottom:14px`；热图 `cell:13 / weeks:13`，间距 `max(3, round(cell×0.22))`、圆角 `max(4, round(cell×0.28))`（Heatmap.tsx:29–31、89）。
- **必须**：热图颜色只走灰阶点亮（`--ink` 按完成度叠在 `--surface` 上，全完成日满亮），绿色只保留给进度条；不得出现第二套色阶（D-20261110-035）；格子必须是 `<button>` 且带 aria-label（补签可达性，Heatmap.tsx:79–85）；补签只允许过去 7 天且需二次确认。
- **例外**：修复砖徽章与回声胶囊用 accent（Stats.tsx:209、244–245）——越界。

## 4. 展台 Showcase.tsx + render/ShowcaseScene.tsx

- **用途**：已落成建筑的沙盘陈列，可拖拽自由摆位。
- **结构**：顶栏（标题 **16px** + 拖拽提示 12px + [自动排列] + 陈列计数胶囊）→ 画布（flex 1，`background: var(--bg)`）→ 空态提示卡（绝对 `left:24; bottom:24`）→ 点选建筑 → `PolaroidModal`。
- **复用**：`ShowcaseScene`（26×26 网格、slabH 12）、`.btn.ghost`、`.toast`。
- **尺寸**：顶栏 `14px 22px` + 1px 底边；计数胶囊 `3px 12px` + 999 圆角；自动排列按钮 `4px 12px; font-size:12`。
- **必须**：落位必须过 `canPlaceModel`（AABB 无重叠 + 不出界）；非法落位画红虚线脚印 + `haptic('warning')`；满位要 toast（`fullHint`）而不是静默覆盖。
- **例外**：拖拽提示图标、自动排列图标用 accent（Showcase.tsx:61、74）——越界。

## 5. 图鉴弹窗 GalleryDialog.tsx

- **用途**：12 座蓝图的解锁顺序与切换当前目标。
- **结构**：`.overlay > .dialog`（宽 **500**）→ `.dialog-header`（标题 + 总数 + 关闭）→ `.dialog-body > .gallery-grid`（**3 列**）→ 每卡：`BlueprintThumb` 缩略图 + 名称 14px/600 + 状态 11.5px → `.dialog-footer`（关闭）。
- **尺寸**：`gap:10px`、卡片 `padding:14px 12px`（ui.css:570–586）；锁定态 `opacity:.5` 且 hover 不动。
- **必须**：解锁顺序 = `blueprintOrder`（logic/blueprints/index.ts:30–43），前一座未落成才锁；锁定态不加锁图标（用状态行表达）。
- **例外**：无。

## 6. 设置弹窗 SettingsDialog.tsx

- **用途**：偏好 / 感官 / 系统 / 数据 / WebDAV 五组。
- **结构**：桌面 `.dialog`（宽 **480**）· 移动 `BottomSheet` → `.dialog-body` 内 5 个 `.apple-group`：界面偏好（语言/主题/快捷键/音效/音量）· 感官与氛围（7 个 `.seg` 排）· 系统集成 · 数据安全（导出/导入/修复砖库存）· WebDAV → `.dialog-footer` 常驻「完成」。
- **尺寸**：`.apple-group` = `ink@2.5%` 底 + `1px --line` + `--r-md` + `14px 16px` + `gap:10px`（ui.css:334–343）；组标题 `11px/700 + uppercase + letter-spacing .05em`（345–352）；每行 `.field` `margin-bottom:12px`。
- **必须**：所有开关必须来自 `settings.*` 且写回 store；关闭态文案不得出现"未实现占位"（历史上出现过幽灵开关）；组内每行一个决策，不叠加说明文字超过 2 行。
- **例外**：WebDAV 组出现在系统集成之后，语义上属"数据"，位置为历史遗留（不阻塞，改版时并入数据组）。

## 7. 习惯弹窗 HabitDialog.tsx

- **用途**：新建/编辑习惯（瞬时 / 专注 / 步进三种类型）。
- **结构**：桌面 `.dialog.habit-dialog`（宽 **460**，ui.css:237–240）· 移动 `BottomSheet` → `.dialog-header` → `.dialog-body` 表单流（名称 → 类型 seg → 频率 seg + 星期/次数 → 时段 seg → 到点提醒 → 目标时长/目标数值 → 分类 → 备注）→ 底栏（归档 / 取消 / 保存）。
- **复用**：`.field`、`.seg`、`TimeStepper`（`.ts-btn/.ts-num`，22px 方块、等宽数字）。
- **尺寸**：输入 `padding:9px 12px` + `1.5px` 描边、聚焦变 `--ink`（ui.css:279–292）；星期格 `height:34px; border-radius:8px`（HabitDialog.tsx:279–290）。
- **必须**：校验错误就地显示在字段下方（`--danger` 11.5px）；未选星期必须拦住保存；关闭前不丢已填内容（仅 Esc/取消丢弃）。
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

## 12. 迷你悬浮摆件 MiniDeskToy.tsx

- **用途**：常驻桌面的 260×380 小窗（App.tsx:249），一键打卡。
- **结构**：外框 r-md + `0 12px 36px rgba(0,0,0,.18)` → 顶栏（拖拽区 logo 16px + 标题 13px + 展开/关闭 24px 键）→ 3D 区（flex 1）→ 底栏（进度 11px 文本 + 3.5px 进度条 + 待办胶囊 ≤3 个）。
- **必须**：拖拽区必须 `data-tauri-drag-region`；关闭=隐藏窗口而非退出；手动退出要写回 `enableMiniWidget:false`（App.tsx:261–264）。
- **例外**：进度条 3.5px（其余表面 5–6px），尺寸压缩属合理例外。

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

### 5.1 迷你摆件三档（mini-widget + settings）
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
### 5.4 设置页摆件尺寸 / 置顶（settings）
- 位置：实验室组「常驻悬浮摆件」行之后；尺寸 seg（口袋 / 标准 / 展台）+ 置顶 seg（开启 / 关闭），各配一行 `--fs-caption` 说明。
- 必须：默认 `standard` + 置顶关；使用中变更尺寸/置顶即时应用到当前窗口；设置值随存档同步（设备偏好）。

### 5.6 完整档案包（settings → 数据安全，D-20261110-062）
- 位置：数据安全组内、导出/导入 JSON 之后新增「完整档案包」面板：标题 + 一行说明 + 内容清单（README / manifest / 数据 JSON / 校验清单 / 建筑图）+ 主按钮 [导出完整档案包]。
- 进行中：按钮下方进度文本（`t.archive.progress(done,total)`）+ 可取消；完成后显示结果行 + [打开档案包]（桌面 `revealItemInDir`）；失败显示错误并清理临时目录。
- 桌面产物：`appDataDir/exports/BlockHabit-Archive-<ISO>/`，包含 `README.md`、`manifest.json`、`data/blockhabit-state.json`、`data/checksums.txt`、`buildings/NN-<id>.png`（透明 640×640 RGBA，已落成建筑）；先写 `.tmp` 再 rename，同名加 `-2`；失败/取消递归清理。
- 浏览器：不落盘，直接下载单 ZIP（STORE+CRC32；`CompressionStream` 可用时文本可选 DEFLATE），文件名 `BlockHabit-Archive-<ISO>.zip`。
- 必须：state.json 必须能经 `prepareImport` round-trip；manifest/checksums/实际文件三者一致；**不含 WebDAV 凭据**；新窗口/并发导出有 busy 闸；不新增颜色。

### 5.7 专注陪伴（mini-widget，D-20261110-064）
- 触发：今日页专注习惯开始计时后，摆件检测到活动会话（设备本地 `blockhabit.focusSessions.v1`，绝对时间）。
- 面板：摆件底栏切换为专注面板 —— 习惯名 + 相位文案（专注中 / 时间到，确认后落块）+ 剩余 `mm:ss` + 静态环形进度（`--ink` 描边，无循环动画）+ 主按钮 [确认落块]（ready 时）/ [再等 5 分钟]（最多 2 次）+ [放弃]（二次确认）。
- 三档：口袋只保留倒计时 + 主按钮（32px）；标准显示环形 + 两个按钮；展台增加一行诚实提示。三档均不裁切，英文两行完整。
- 必须：到点只进 ready，绝不自动打卡；确认才 `checkIn(actualMinutes)`；放弃不产生任何打卡；`notifiedAt` 先落盘再通知（重启不重复）；只显示用户主动启动的计时，不监控/不阻断；reduced-motion 无动画。

### 5.8 扩展内容包与图鉴剪影（gallery / build，D-20261110-063）
- 内容：基础 12 座之后追加 6 座免费扩展蓝图（林间树屋 / 玻璃温室 / 钟楼 / 石拱桥 / 山顶天文台 / 旧图书馆），图鉴/建造/容量/展台/年鉴/档案全部按注册表动态总数（18），不硬编码。
- 图鉴：锁定卡使用 `BlueprintThumb` 的 `silhouette` 模式——只用 `--ink` 透明度派生灰阶、透明底、忽略建筑自定义色、不画虚线地基；卡片不再整体压暗，名字与「待解锁」保持可读；已完成/当前建筑视觉不变。
- 解锁：完成基础 12 座后自动指向扩展包第一座，其余按 `blueprintOrder` 顺序解锁；旧 12 座数据与视觉零改动。
- 必须：内容版本门（`contentVersion=2`）先于 sanitize；旧客户端读新档只能 needsUpgrade，不得静默清洗；图鉴 18 卡可滚动，底部关闭按钮固定。



