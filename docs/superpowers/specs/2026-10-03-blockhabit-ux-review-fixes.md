# BlockHabit 体验评审修复方案（详细设计）

> 日期：2026-10-03
> 输入：2026-10-03 全量体验/美术/功能评审（代码走查 + 四主题浏览器实测 + 业界对比）
> 关系：与 `2026-09-30-blockhabit-optimization-design.md` 互补——本文只做"评审新发现 + 快速见效"项；同步重设计（schema v2 / WebDAV Rust HTTP / 墓碑）仍归该文档批次三，本文不重复实施。

## 0. 问题回顾与批次划分

评审确认的高优先级问题（按危害排序）：

| # | 问题 | 危害 |
| --- | --- | --- |
| 1 | 纸白主题（默认）缺 `--block-right`/`--block-ghost`，canvas `addColorStop('')` 抛异常 → 建造页与打卡落块弹窗整树卸载白屏 | 新用户第一天打卡必踩，核心奖励回路断裂 |
| 2 | 提醒用 Web `Notification`，WebView2 默认拒绝且异常被吞 → 系统通知从不弹出 | 提醒只剩应用内提示音，托盘/隐藏窗口时完全失效 |
| 3 | 撤销打卡无任何保护：误点绿勾瞬时摧毁打卡+积木+可能的全勤 | 不可逆破坏，无补救 |
| 4 | counter 型习惯未达标也显示"已完成"绿勾 | 统计语义失真（达标判定用 `habitMetOnDay`，UI 却用"有打卡即完成"） |
| 5 | 自动同步死代码：`enabled` 无任何 UI 能置 true，启动/定时间隔同步永不运行 | 多设备用户只能手动同步 |
| 6 | 点缀色纪律：`iso.ts`/`BuildScene.tsx` 硬编码 `#f59e0b`，与品牌琥珀 `#F5B301` 不一致，燕麦/雾灰主题高亮不跟随 | 主题体系漏洞（优化方案 §4.3 主题色收口的遗留点位） |
| 7 | 墨黑主题积木"黑上黑"：右脸 `#0f0f0f` 对背景 `#0a0a0a` 几乎不可见 | 建造页主视图可读性差 |
| 8 | 模型"浮"在地基上，无地面接触阴影 | 落地感缺失 |
| 9 | 图鉴 12 个模型纯文字卡片 | 收集感/期待感浪费，渲染器明明现成 |
| 10 | 幽灵设置：`enableMiniWidget` 存而不用；`enableXRayInspection` 存而不用 | 设置面板失信 |

**本轮不做**（记录原因）：
- 习惯硬删除墓碑 + WebDAV 走 Rust HTTP：属 9·30 方案批次三（schema v2），独立半做会与其迁移管线设计冲突，保持归口。
- Web Notification → Rust 侧常驻调度（退出后仍提醒）：需 Rust 定时器/权限编排，本轮先把"应用运行中（含窗口隐藏托盘）"的通知修通，退出态提醒进 backlog。
- 图鉴缩略图之外的美术大改（植被随机化、DPR 上限、画布文字换行）：见"已接受的取舍"。

## 1. 批次一：纸白主题崩溃修复（P0）

### 1.1 `theme.css` 补齐 `:root` 积木调色板

`:root` 增加：
```css
--block-right: #8a8a8a;
--block-ghost: #dcdcdc;
```
取值原则：纸白主题块顶 `#f4f4f4` / 左脸 `#c9c9c9`，右脸应比左脸深 1.5~2 档形成受光面差（取 `#8a8a8a`），ghost 用于幽灵块/X 射线底色，取比地基填充更可见的 `#dcdcdc`。

### 1.2 回归测试 `src/theme.test.ts`

读 `src/theme.css` 原文，对四个主题块（`:root`、`[data-theme='dark']`、`[data-theme='oat']`、`[data-theme='fog']`）断言四个 token（top/left/right/ghost）全部存在且为合法 CSS 颜色（非空、非 `''`）。防止未来新增主题再漏。

**验收**：浏览器纸白主题打开建造页正常渲染；打卡落块弹窗正常；四主题截图走查。

## 2. 批次二：撤销打卡保护 + counter 完成态（P1）

### 2.1 撤销确认

两处撤销路径统一加 `ConfirmDialog`（复用现有组件，`danger: false`，确认文案"撤销打卡"）：
- `HabitRow.tsx` `handleStatusClick` 的 `done` 分支（绿勾点击）
- `HabitRow.tsx` 完成态 pill 的撤销入口

确认弹窗文案明确后果：`撤销今日打卡？该积木会被回收，连击与全勤奖励同步重算。`（i18n key：`today.undoConfirmTitle` / `today.undoConfirmBody` / `today.undoConfirmAction`）

不改 `uncheckIn` 本身——它是合法能力，只是入口要有确认。

### 2.2 counter 完成态对齐

`Today.tsx` 传给 `HabitRow` 的 `done` 从 `checkIns.some(存在当日记录)` 改为 `habitMetOnDay(h, checkIns, day)`（该函数已正确处理 counter 目标值/周频次/休息日豁免）。
- HabitRow 内部逻辑不需要动：`done=false` 时 counter 点击走 `handleStepCounter` 递增，语义正确。
- 注意 `App.tsx` 的 `hasUnfinishedToday`（全勤横幅）已用 `habitMetOnDay`，本改动使两处口径一致。

**验收**：新建 targetValue=3 的 counter 习惯，打卡 1 次不亮绿勾、打卡满 3 次亮绿勾；撤销绿勾出现确认弹窗。

## 3. 批次三：系统通知集成（P1）

### 3.1 依赖与能力

- `package.json`：`@tauri-apps/plugin-notification`
- `src-tauri/Cargo.toml`：`tauri-plugin-notification = "2"`
- `src-tauri/src/lib.rs`：`.plugin(tauri_plugin_notification::init())`
- `capabilities/default.json`：`"notification:default"`

### 3.2 前端封装 `src/platform/notify.ts`

```
ensureNotifyPermission(): Promise<boolean>   // Tauri: isPermissionGranted → false 时 requestPermission；浏览器：'Notification' in window && requestPermission()
notify(title, body): Promise<void>           // Tauri: plugin sendNotification；浏览器: new Notification（保持现有降级）
```

`ReminderWatcher` 把 `new Notification(...)` try/catch 段替换为 `void notify('BlockHabit', body)`。浏览器行为不变；Tauri 下窗口隐藏/托盘态也能弹系统通知（应用进程存活即可）。

权限申请时机：不改设置页结构，`ReminderWatcher` 首次实际触发提醒前惰性申请（避免启动弹权限框打扰）。

**验收**：`tsc` 通过；`cargo check` 通过（桌面侧编译验证）；代码走查确认无裸 `new Notification` 残留于 Tauri 路径。真机通知弹出属手工验收项，记录在案。

## 4. 批次四：自动同步接线（P1）

`useSync` 的启动同步 + 定时间隔逻辑已存在且健壮（含 hydration 等待、间隔判定），只差 UI：

`SettingsDialog` WebDAV 组新增：
- **自动同步** seg（开启/关闭）→ `updateSyncConfig({ enabled })`，关闭时隐藏间隔行
- **同步间隔** seg（15 分钟 / 1 小时 / 3 小时）→ `updateSyncConfig({ autoSyncIntervalMinutes })`，默认 30 → 用 30 分钟档
- 仅当 `endpoint` 非空时可用；提示文案说明"需先填写服务器地址"

i18n：`settings.webdav.autoSync` / `autoSyncOn/Off` / `autoSyncHint` / `interval15m` / `interval30m` / `interval1h` / `interval3h`。

**验收**：填地址 + 开启自动同步 → 重载应用 2s 后自动触发一次同步尝试（浏览器下 CORS 失败也算触发，状态区显示错误而非静默）。

## 5. 批次五：渲染美术三件（P2）

### 5.1 点缀色收口

- `iso.ts` 651/659/668 的 `#f59e0b` → `p.accent`
- `BuildScene.tsx:298` 透视考古发光块 `color: '#f59e0b'` → `palette.accent`

### 5.2 墨黑主题块体对比度

`theme.css` `[data-theme='dark']`：
```
--block-left: #282828 → #303030
--block-right: #0f0f0f → #1c1c1c
--block-ghost: #1e1e1e → #262626
```
右脸与背景（#0a0a0a）拉出可感知分离，左/右脸保持 1.5 档明度差，顶面 `#424242` 不动。截图对比验收。

### 5.3 地面接触阴影

`iso.ts` 新增 `drawGroundShadow(ctx, blocks, c, p, rot, cx, cy)`：
- 取 `groundBoundsOf`（margin 收窄到 0.4）四角投影为屏幕坐标，构造等距椭圆（旋转 ±30° 匹配投影轴）
- 径向渐变 `withAlpha(p.ink, 0.14) → 0`，绘制于 `drawGroundBase` 之后、积木之前
- `BuildScene.tsx` 与 `ShowcaseScene.tsx` 各插一行调用

### 5.4 展台沙盘主题化（顺带）

`ShowcaseScene.tsx` 裙边 `#f1f5f9`/顶面 `#ffffff`/网格 `rgba(10,10,10,0.08)` 硬编码 → 读 `paletteFromDocument()`，用 `p.top`（顶面）、`withAlpha(p.ink, 0.06)`（网格）、`p.left`（裙边暗面）。深色主题下沙盘不再是一块白板。

## 6. 批次六：图鉴缩略图（P2）

`src/components/BlueprintThumb.tsx`：小 canvas（约 132×96，dpr 缩放）一次性绘制蓝图全部块的静态预览：
- 复用 `iso.ts` 的 `worldToScreen` + `drawCube`（`noStuds: false`、无动画），复用 `groundBoundsOf` 居中取景，`paletteFromDocument()`
- 未解锁模型：绘制后叠 `withAlpha(p.ink, 0.72)` 遮罩 + "待解锁"由现有 status 行表达（不加锁图标，保持极简）
- `GalleryDialog` 卡片插入 `<BlueprintThumb id={id} locked={!unlocked} />`

性能：12 个模型 ≤ 5000 块，一次性同步绘制无压力；精灵缓存天然复用。

**验收**：图鉴每卡显示模型等距预览，深浅主题下均清晰，锁定卡变暗。

## 7. 批次七：幽灵设置接线（P2）

- `enableXRayInspection`：`Build.tsx` x-ray 初值改为读该设置；`SettingsDialog` 感官组新增"透视考古默认"seg（i18n：`xrayDefaultLabel/On/Off`）
- `enableMiniWidget`：`App.tsx` hydration 完成后若为 true → 自动进入迷你模式；`toggleMini(false)`（手动退出摆件）时同步写回 `enableMiniWidget: false`，语义变为"启动时常驻悬浮件，退出后不再自启"。设置项 hint 文案同步修正。

## 8. 已接受的取舍

1. **真机 OS 通知弹出与退出态提醒**：本轮只保证插件链路 + 运行态通知；退出态调度进 backlog（需 Rust 定时编排）。
2. **WebDAV CORS**：fetch 走 WebView 的本质限制仍在（批次三 Rust HTTP 解决）；本轮只是让自动同步"能被打开、能报错"，不再静默。
3. **墨黑对比度数值**：以截图目测验收为准，不做像素级 diff（ sprite 缓存回归工具在 9·30 方案 §12 中延后）。
4. **图鉴缩略图不展示 eco 植被/当前进度块**：绘制蓝图全集的"完成形态"，文案行的"建造中 · n/m"已表达进度。
5. **迷你摆件自启的窗口闪烁**：Tauri 启动时窗口先按 conf 尺寸出现再缩到摆件尺寸，一次性闪烁接受（后续可用 `visible: false` + 就绪后展示优化，backlog）。
6. **README 修正**：只修明确错误的事实性描述（蓝图数量、热图颜色、字体），不重写。

## 9. 验证与交付策略

- 每项先写/改测试再实现（沿用 vitest 文化）；`npm test` 全绿 + `npx tsc --noEmit` 零错误。
- 批次三追加 `cargo check`（MSVC link PATH 按 README 设置）。
- 浏览器四主题截图走查：今日（打卡/撤销确认/counter 绿勾）/ 建造（纸白不白屏、墨黑对比、阴影、点缀色）/ 展台（深色沙盘）/ 图鉴（缩略图）。
- 提交切分：按批次小步提交，`fix:`/`feat:`/`refactor:` 前缀。

## 10. 实施记录（与设计的偏差，2026-10-03 完成）

1. **主题回归测试**：vitest 默认把 CSS（含 `?raw`）mock 成空串，改为 `node:fs` 读文件 + tsconfig exclude（同 `webdav.e2e.test.ts` 惯例）；"四色互不重复"断言被移除——燕麦/雾灰主题刻意让 ghost 复用左脸颜色。
2. **建造页接触阴影跟随已放置积木**（而非蓝图全集脚印）：开荒期 3/190 块时蓝图脚印阴影比建筑大数圈，观感突兀；展台页仍用蓝图全集（模型必然完整）。
3. **展台沙盘**：顶面 `palette.top`、裙边 `palette.left`、网格/阴影 `withAlpha(palette.ink, .08/.06)`；baseKey 追加 top/left 防主题缓存不重绘。
4. **touchGesture.test.ts 的 canvas mock** 补 `createRadialGradient`（阴影径向渐变需要）。
5. **全部验证通过**：354/354 单测、`tsc --noEmit` 零错误、`cargo check` 通过；四主题浏览器截图走查通过（纸白建造/落块弹窗、撤销确认弹窗、图鉴缩略图、墨黑对比、展台深色沙盘、设置自动同步与透视考古开关）。
