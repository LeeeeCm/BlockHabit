---
id: D-20261125-113
date: 2026-11-25
title: 桌宠眼睛改为竖向胶囊，取代椭圆方案
status: proposed
owner: Claude Code
surface: [mini-widget]
axioms: [A3]
files: [src/render/petCanvas.ts]
supersedes: [D-20261125-112]
reviewer: pending
---

## 背景与问题

用户澄清：桌宠眼睛要「竖着的胶囊样式」，不是普通椭圆。D-20261125-112 的纵向长椭圆方案只能让眼睛变高，端部仍是椭圆尖弧，达不到胶囊的直边 + 半圆端头。

## 设计决定

- `paintEyes` 的常态眼睛改用 `ctx.roundRect` 绘制竖向胶囊：宽 `2rx`、高 `2ry`、圆角半径 `rx`，使上下两端为半圆、左右为直边。
- 纵向半径 `ry = radius * 2.0`，横向半径 `rx` 不变（`ready` 心情继续 `1.18×` 加宽），形成约 2:1 的竖向胶囊。
- 眼睛中心仍在正面高度 40%；block 正面 29px 高时胶囊纵向占 8.1px，距嘴部（68%）约 3.9px，不重叠。
- 眨眼、专注、开心仍使用线条眼；不新增颜色、不改眼睛位置与间距。
- 取代 D-20261125-112 的椭圆方案，旧记录保留为 superseded。

## 取舍与被否方案

- 否掉椭圆：用户明确要胶囊的直边与半圆端头，椭圆端部曲率连续，视觉上仍是「长点」。
- 否掉圆角矩形：若圆角小于 `rx`，上下端是圆角而不是半圆，不是胶囊。
- 否掉加宽眼睛：用户只要求竖向拉长，加宽会削弱胶囊比例。

## 影响面

- 代码：`src/render/petCanvas.ts` 的眼睛绘制分支。
- 视觉：`?pet-preview` 覆盖默认 block/medium；cat 通过 dev 模块渲染核对；三档尺寸仅整体缩放，眼睛形状不变。
- 测试：无既有眼睛几何断言；用 `?pet-preview` 与 cat 渲染截图走查。

## 验收标准

- `?pet-preview` 标准尺寸下眼睛为竖向胶囊：上下半圆、左右直边，高宽比约 2:1。
- 眼睛不与嘴部/正面边界重叠；small/medium/large 三档均不越界。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-25 created（Claude Code），按用户澄清将椭圆改为竖向胶囊。
- 2026-11-25 verified（Claude Code）：`?pet-preview` 默认 block/medium 与动态渲染 cat 均确认为竖向胶囊；未发现与嘴部重叠。
