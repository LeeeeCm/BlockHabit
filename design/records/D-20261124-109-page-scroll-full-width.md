---
id: D-20261124-109
date: 2026-11-24
title: 今日/统计页滚动容器铺满整行，修复两侧滚轮失效
status: approved
owner: Claude Code
surface: [today, stats]
axioms: [A4]
files: [src/pages/Today.tsx, src/pages/Stats.tsx, src/pages/Stats.test.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

今日页与统计页的滚动容器同时承担「居中内容」与「滚动」两个职责：容器本身 `maxWidth: 720 / 680`、`margin: 0 auto`。当鼠标停在内容左右两侧的页面留白时，滚轮事件落在容器外的页面背景上，页面不滚动；只有停在中间内容区才滚动。用户实测两侧滚轮无效。

## 设计决定

- 滚动容器改为铺满整行（`width:100%`，移除 `maxWidth` 与 `margin:auto`），用左右 padding 保持原有内容宽度与居中位置：
  - 今日：`padding: 24px max(24px, calc(24px + (100% - 720px) / 2)) 80px`
  - 统计：`padding: 24px max(24px, calc(24px + (100% - 680px) / 2)) 80px`
- 容器 border-box 的全宽区域都是滚轮命中区，因此鼠标在左侧、中间、右侧都能滚动；内容内容宽度（672 / 632px）与横向起点不变。
- 移动端 `mobile.css` 的 `padding ... !important` 覆盖保持不变；窄窗口下 `max(24px, …)` 自动回到 24px 边距，不产生负 padding。
- 不引入文档级 wheel 转发，也不新增外层 DOM 包装；避免双重滚动与移动端手势冲突。

## 取舍与被否方案

- **否掉外层再包一个全宽 `.page-scroll`**：可行，但会改动两页的 DOM 层级与既有测试选择器；padding 方案保持结构不变。
- **否掉在页面根节点监听 wheel 并手动转给容器**：需要判断弹窗/画布/横向滚动等边界，容易出现双重滚动与惯性丢失。
- **否掉把内容直接拉满全宽**：会改变既有 720/680px 排版与卡片列宽。

## 影响面

- `src/pages/Today.tsx`、`src/pages/Stats.tsx`：仅滚动容器内联样式。
- `src/pages/Stats.test.tsx`：新增全宽滚动容器契约测试。
- 需人工走查：两侧滚轮、中间滚轮、窄窗口、移动端 BottomSheet 与弹窗打开时的滚动锁。

## 验收标准

- 在 1116px 视口下，鼠标位于 x=50（左侧留白）与页面中心分别滚动，今日/统计 `scrollTop` 都会变化。
- 内容宽度、居中位置、顶栏与卡片网格不变。
- `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户反馈修复两侧滚轮无效。
- 2026-11-24 verified（Claude Code）：1116px 视口下今日与统计容器均为 1116px 全宽，内容首项 x 仍为 222 / 242；鼠标在 x=50 左侧与 x=558 中间滚动，两页 `scrollTop` 都从 0 → 44，行为一致。
- 2026-11-24 approved（LeeCM），设计记录通过人工审核。
