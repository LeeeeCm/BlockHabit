---
id: D-20261124-087
date: 2026-11-24
title: 窄窗口响应式页头与画布高度修复（不再逐字竖排 / 溢出）
status: proposed
owner: Claude
surface: [today, build, showcase, stats]
axioms: [A2, A4]
files: [src/pages/today/TodayHeader.tsx, src/pages/today/TodayHeader.test.tsx, src/pages/stats/StatsHeader.tsx, src/pages/Build.tsx, src/pages/Showcase.tsx, src/components/ui-base.css, src/mobile.css, design/SURFACES.md]
supersedes: []
reviewer: pending
---

## 背景与问题

360–390px 窄窗口（移动布局 / 窄浏览器）实测发现三类可见问题：

1. **中文被挤成竖排**：今日页头部、建造页顶栏、展台标题在窄宽下把「绿意盆栽」「黄昏」「透视考古」「图鉴」「展台沙盘」逐字换行；原因是 flex 子项默认可收缩到 min-content，而容器没有整组换行策略。
2. **统计页页头溢出**：360px 下「纪念品 / 修复积木」被挤出右边界；标题、操作组之间没有换行规则。
3. **建造页画布高度溢出**：画布容器的 flex 子项没有 `min-height: 0`，内容固有高度把容器撑到视口下方，底部地基说明被底部 tab bar 遮住（实测 wrapper bottom 923px > 内容区 772px）。

## 设计决定

- 页头拆为「标题 / 操作组」两层：`.today-header(-actions)`、`.stats-header(-actions)`；容器 `flex-wrap`，操作组 `flex-shrink:0`，胶囊 `white-space:nowrap`。窄宽时整组换行，而不是压缩文字。
- 移动布局（`.mobile-app-root`）下操作组占满一行、左对齐；今日页「+」保持右端（`margin-left:auto`）。
- 建造页顶栏拆为 `.build-top-bar-main`（名称 / 块数 / 进度）与 `.build-top-bar-actions`（铭言 / 相纸 / 光照 / 透视 / 图鉴）；窄宽时 actions 整行落到第二行，按钮不竖排。
- 建造 / 展台画布容器加 `min-height:0 + overflow:hidden`，让 flex 子项真正收缩到内容区高度；底部说明回到 tab bar 之上。
- 展台标题 `white-space:nowrap`、标题行允许 hint 换行。
- 不隐藏任何既有控件（光照 / 透视 / 图鉴仍可达），不改变平台判定（粗指针才切移动布局）。

## 取舍与被否方案

- 否掉「窄屏隐藏光照/透视/图鉴」：它们是建造页核心工具，隐藏会让功能不可达；两行顶栏只占约 50px。
- 否掉「按宽度强制切换移动布局」：会改变触屏笔记本的行为；现有平台判定 + CSS 自适应已能覆盖窄桌面窗口。
- 否掉「缩小字号」：字号阶梯是 D-028 的资产，压缩字号会破坏层级。

## 影响面

- 仅布局：无颜色、圆角、字号、动效、数据变化。
- 新增 `TodayHeader` 结构守门测试；Stats 测试补 `.stats-header-actions` 断言。
- 桌面 900px 以上视觉不变（flex-wrap 仅在溢出时生效）。

## 验收标准

1. 360 / 390 / 900px 下四页无横向滚动，无中文逐字竖排。
2. 建造页地基说明完整可见，不被底部 tab bar 遮挡。
3. 统计页 360px 下「纪念品 / 修复积木」完整可见。
4. `npx tsc --noEmit`、`npm test`、`npm run format:check`、`npm run design:check` 通过。

## 变更履历

- 2026-11-24 created (Claude)
