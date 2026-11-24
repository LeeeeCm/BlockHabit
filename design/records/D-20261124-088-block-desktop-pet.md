---
id: D-20261124-088
date: 2026-11-24
title: 积木桌宠取代三档摆件（透明悬浮窗 / 自主走动 / 可拖拽）
status: superseded
owner: Claude
surface: [mini-widget, settings, titlebar]
axioms: [A1, A2, A5, A6, A7]
files: [src-tauri/tauri.conf.json, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, src/main.tsx, src/pet/, src/platform/petWindow.ts, src/platform/petMotion.ts, src/App.tsx, src/app/TitleBar.tsx, src/components/settings/LabGroup.tsx, src/types.ts, src/storage/adapter.ts, src/store/appStoreHelpers.ts, src/platform/miniWindow.ts, src/i18n/]
supersedes: [D-20261110-059, D-20261124-083]
reviewer: pending
---

## 背景与问题

D-20261110-059 的三档摆件（口袋 / 标准 / 展台）与 D-20261124-083 的标题栏尺寸键，本质是「可调尺寸的常驻小窗」。用户明确只需要一个**桌宠**：积木风格、会动、常驻桌面；摆件尺寸选择不再需要。D-20261110-066 技术方案里「不做桌面宠物动画 / 透明窗口」的边界由本次人类要求推翻。

## 竞品与方案调研（2026-11-24）

- **Shimeji 系**：窗口透明、无边框、置顶；行为由状态机 + 权重选择动作，窗口随角色移动；资源包驱动动画。
- **Shijima-Qt**：Shimeji 的 Qt 重实现，强调窗口追踪、多屏与 Wayland 兼容；说明「窗口跟随角色」是桌宠的通用形态。
- **Desktop Goose**：用「自主游走 + 交互干扰」制造存在感；但抢鼠标、拖窗口等行为不适合本产品。
- **hucarry/tauri-desktop-pet**：Tauri 2 窗口 213×160，`transparent + decorations:false + alwaysOnTop + skipTaskbar + shadow:false`；`WalkDriver` 左右行走碰边反弹，逐像素 alpha 命中，拖动重定位，状态机分层选择动作，IPC 节流、常驻内存 <50MB。
- **0x7c09/kai**：Canvas 精灵图 + 140ms/帧；点击/双击切换 waving/jumping；指针拖动通过 `move_pet_window` 命令移动窗口；拖动超过 2px 才判定为拖动，并抑制后续点击。
- **Tauri 2 官方**：透明窗口需 `transparent: true`；Windows 下 `setPosition` / `startDragging` / `setIgnoreCursorEvents` / `setAlwaysOnTop` 各有独立权限；透明窗口建议 `noRedirectionBitmap` 规避首帧白闪。

结论：采用「小型透明置顶窗 + 角色在窗内动 + 窗口随行走平移」的通用形态；不做抢鼠标、不做桌面层嵌入。

## 设计决定

- **窗口**：新增 `pet` 窗口，逻辑 160×180，`transparent`、`decorations:false`、`alwaysOnTop:true`、`skipTaskbar:true`、`shadow:false`、`resizable:false`、`visible:false`、`focus:false`、`backgroundColor:#00000000`。
- **角色**：一只由等距积木堆成的方块小兽——身体 / 头 / 两只脚 / 顶部凸点；沿用 `isoCube` 的三面明暗、圆角与 1px 墨线，不新增色相；眼睛/嘴只用 `--ink`，奖励色只用于极小的庆祝方块。
- **动作**：idle 呼吸 + 眨眼；walk 身体轻摆 + 双脚交替；点击跳一下；双击唤起主窗；右键隐藏。动作由纯函数状态机选择，不读取打卡数据（A6：不伪造成长/情绪）。
- **移动**：`petMotion` 纯函数按时间步进计算窗口位置，碰工作区边缘反弹；窗口位置约 20fps 更新（IPC 节流），角色内部动画 60fps；位置存设备本地 `windowLayout.pet`，旧 `mini` 位置迁移。
- **开关**：设置与标题栏只保留一个「桌面宠物」开关（默认关）；删除尺寸 / 置顶控件、三档预设、迷你件的快捷打卡与专注面板。专注计时仍在今日页，不受影响。
- **限制（v1 明确不做）**：逐像素点击穿透、桌面层嵌入、抢鼠标、跨窗口拖拽其他应用、宠物养成/等级/喂食。

## 取舍与被否方案

- 否掉「继续用主窗缩成宠物」：主窗与宠物不能同时存在，且改尺寸会反复破坏主窗布局。
- 否掉「全屏透明覆盖层 + 角色在层内移动」：会拦截整个桌面点击，必须做逐像素穿透，复杂度与风险都高。
- 否掉「精灵图资源」：本产品没有角色美术资产；用现有 iso 积木程序化绘制，风格一致且无版权风险。
- 否掉「保留三档尺寸作为宠物大小」：用户明确不要；宠物大小固定，位置可拖。

## 影响面

- 删除 `MiniDeskToy` 与 `minidesk/` 组件、三档预设与相关测试；`focusSession` 数据与今日页专注入口保留。
- 新增 `pet` 窗口、Rust 命令（显示/隐藏/唤起主窗）、capabilities 权限、PetWindow 前端入口。
- 设置 / 标题栏 / i18n / 存档字段从 `miniWidget*` 迁移到 `enablePet`；旧档自动迁移一次。
- 新增宠物状态机与位置计算单测；桌面端需人工验收透明窗、拖动、双屏与任务栏。

## 验收标准

1. 开启后出现 160×180 透明置顶桌宠，无标题栏/任务栏项，不抢主窗焦点。
2. 角色会呼吸、眨眼、左右走动并碰边反弹；拖动可改变位置，重启后位置保持（按工作区钳制）。
3. 双击桌宠唤起主窗并回到今日页；右键隐藏；设置/标题栏开关同步。
4. 关闭开关后桌宠窗口隐藏，主窗尺寸与位置不受影响。
5. `npx tsc --noEmit`、`npm test`、`cargo check`、`npm run design:check` 通过；桌面端人工走查上述 4 条。

## 变更履历

- 2026-11-24 created (Claude)
- 2026-11-24 实现并桌面验收：pet 窗口 160×180 透明置顶出现；角色行走导致窗口位移；双击唤起主窗；右键隐藏并同步 `enablePet=false`；浏览器 `?pet-preview` 可单独验收绘制。

- 2026-11-24 superseded by D-20261124-091（形象/大小/右键设置/打卡联动 v2）。
