---
id: D-20261126-122
date: 2026-11-26
title: 桌宠建好蓝图后直接用蓝图积木拼成外形，并修掉移动时的 1px 细线
status: superseded
owner: Claude Code
surface: [mini-widget, build, gallery]
axioms: [A2, A3]
files: [src/render/petBlueprint.ts, src/render/petBlueprint.test.ts, src/pet/PetWindow.tsx, src/pet/types.ts, src/App.tsx, src/render/petCanvas.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

用户把桌宠蓝图（`pet-cat`）拼完之后发现，桌宠仍然画着一套手写卡通几何 —— **三角耳朵、方块脸**，与建造页里那座积木猫完全不是一个东西。另外桌宠向左走动时，边缘会出现一条细线。

## 设计决定

- **建成即用蓝图外形**：新增 `src/render/petBlueprint.ts`，直接用建造页/图鉴同一套 `drawCube`（等距立方体 + 凸点 + 三分面明暗）按蓝图块逐块绘制，画家排序与图鉴一致。于是桌宠的外形**逐块等于蓝图**，不再有额外的三角耳朵或别的差异。
- **切换时机**：主窗在 `pet-config` 里带上 `blueprintId`（仅当对应桌宠蓝图 `blueprintProgress(...).complete` 时非空）；`PetWindow` 收到后把渲染源从手写几何切到蓝图积木。未建成之前仍用原来的积木角色。
- **姿态复用**：跳跃的 lift / 落地压扁直接套在蓝图渲染上（同一 `PetPose`），所以「会跳、会眨眼」的体感不变，变的只是外形来源。
- **细线**：每帧先 `setTransform(dpr…)` 复位（走动时窗口与角色同时在动，残留缩放会在边缘留 1px），并把角色绘制按 0.985 轻微内收，避免压扁瞬间描边贴到画布边缘被裁成断线。实测画布最左/最右列的非透明像素数始终为 0 —— 没有被裁切。

## 取舍与被否方案

- **否掉「给手写几何补上猫耳/猫尾更好看」**：用户要的是「和蓝图一模一样」，继续在第二套几何上打补丁只会越走越偏。
- **否掉把桌宠改成静态图片**：失去跳跃与压扁的物理感（A5），也无法跟随主题配色。
- **否掉只在设置页预览里切换**：桌宠窗口才是用户看的地方，必须在 `PetWindow` 里切。
- **否掉给画布加 `padding` 避免裁切**：窗口只有 96×128，加内边距等于把角色整体缩小；内收 1.5% 更省像素。

## 影响面

- 渲染：新增一个渲染入口；`petCanvas` 的手写几何保留（未建成蓝图的 block 形象仍在用）。
- 事件：`PetConfig` 新增可选 `blueprintId`，老版本主窗不发该字段时行为不变。
- 桌面窗口：走动/跳跃逻辑未改，只改绘制。
- 调试：`?pet-preview=1&skin=cat&blueprint=pet-cat` 可直接查看蓝图形状，便于走查截图。

## 验收标准

- 拼完 `pet-cat` 后桌宠外形与建造页那座积木猫逐块一致，没有三角耳朵。
- 左右走动、跳跃、落地压扁时画布最左/最右列无悬空像素（无细线）。
- 未建成蓝图时仍是原来的积木角色。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按「桌宠应是蓝图样子」+「移动时出现细线」两条反馈实现。
- 2026-11-26 verified（Claude Code）：`?pet-preview&blueprint=pet-cat` 截图确认为积木猫轮廓；连拍 10 帧边缘像素 L0/R0；新增 2 例渲染测试。
- 2026-11-27 superseded by D-20261127-125（Claude Code）：桌宠蓝图与蓝图拼形路径整体下线，只保留积木桌宠；正文保留。
