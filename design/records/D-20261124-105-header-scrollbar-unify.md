---
id: D-20261124-105
date: 2026-11-24
title: 四页顶栏齐高齐位、统计标题归位与全项目隐藏滚动条
status: proposed
owner: Claude Code
surface: [global, today, stats]
axioms: [A2, A4]
files: [src/components/ui-base.css, src/components/ui-overlay.css, src/theme.css, src/pages/today/TodayHeader.tsx, src/pages/stats/StatsHeader.tsx, src/pages/Build.tsx, src/pages/Showcase.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

用户反馈三处回归：

1. 今日页与统计页再次出现可见滚动条，与「全项目无滚动条」的视觉约定冲突。
2. 今日页顶栏实测高 67px，建造 / 展台 / 统计均为 64px。原因是今日页右侧「+」按钮使用 `.icon-btn` 的 38×38，撑高了整行。
3. 统计页标题实测 y=72.4，建造 / 展台标题 y=77.1；统计标题为 600 字重，另两页为 700，字体族也因 `<h1>` 与 `<span>` 不同而不一致。

## 设计决定

- **无滚动条外观**：全局 `::-webkit-scrollbar` 设为 `display:none; width:0; height:0`，`*` 设 `scrollbar-width:none`；弹窗 `.dialog-body` 的 8px 滚动条同步隐藏。保留 `overflow-y:auto` 与滚轮/触控板滚动能力，内容不丢，只是不再绘制轨道与滑块。
- **今日页「+」按钮**：在今日页动作区内收为 34×34 的倒角方块，与 `.block-action` 的 34px 高度齐平；不再使用全局 38×38 图标按钮尺寸。
- **统计页头部**：`StatsHeader` 的 `align-items` 从 `flex-start` 改为 `center`，标题回到与另三页相同的垂直中线。
- **统一标题排印**：新增 `.page-title`（`var(--font-body)` / `var(--fs-title)` / 700 / 24.8px 行高 / `margin:0` / 不换行），四页标题全部挂载该类，去掉各自内联的字号、字重与字体族差异；英文下沿用 `-0.025em` 字距。
- 不改变顶栏 64px 最小高度、14×20 内距、分隔线与右侧动作样式。

## 取舍与被否方案

- **否掉给今日页顶栏加 `overflow:hidden` 硬裁 3px**：内容仍在，只是被切，窄窗口会真的切到按钮。
- **否掉把四页顶栏固定 `height:64px` + `nowrap`**：窄窗口会横向溢出，破坏 D-087 的响应式换行；本次先消除造成 67px 的真实撑高源。
- **否掉保留滚动条只做透明化**：`scrollbar-width: thin` 在 WebView2 下仍占 10px 布局宽度；隐藏后内容区宽度也回归一致。
- **否掉只给今日/统计两个容器加隐藏类**：设置弹窗、年鉴、长表单同样会出现轨道，用户要求的是全项目无滚动条；统一在全局层处理，避免漏网。

## 影响面

- `src/theme.css`：全局滚动条外观。
- `src/components/ui-overlay.css`：弹窗滚动条外观。
- `src/components/ui-base.css`：`.page-title` 与今日页图标按钮尺寸。
- 四个页面的标题元素：今日、建造、展台、统计。
- 需人工走查：今日/统计滚动仍可用但无轨道；四页顶栏高度、标题基线、字重与字号一致；窄窗口换行不回归。

## 验收标准

- CDP 实测四页 `.page-top-bar` 高度均为 64px；四个标题的 `font-size`、`font-weight`、`font-family`、`line-height`、`x`、`y` 一致（允许亚像素舍入）。
- `.today-page-container` 与 `.stats-page-container` 的 `offsetWidth - clientWidth` 为 0；滚轮仍能改变 `scrollTop`。
- 弹窗滚动条也不可见；内容仍可滚动。
- 今日页「+」按钮为 34×34，视觉上与右侧倒角方块同高。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户反馈修复三处回归。
- 2026-11-24 verified（Claude Code）：CDP 实测四页顶栏均为 64px，标题均为 x=20 / y=77.1 / 16px / 700 / 24.8px；今日与统计滚动容器 `offsetWidth-clientWidth` 为 0，滚轮后 `scrollTop` 0→44。
