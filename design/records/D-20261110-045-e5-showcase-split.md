---
id: D-20261110-045
date: 2026-11-10
title: 实施 E5 第二步：ShowcaseScene 890 → 796 行（纯几何派生拆出 + 12 例单测），逐像素零差异
status: approved
owner: lead
surface: [showcase]
axioms: [A3]
files: [src/render/showcaseLayout.ts, src/render/showcaseLayout.test.ts, src/render/ShowcaseScene.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

`D-20261110-044` 让 `BuildScene.tsx` 回到 800 行以内，但 `ShowcaseScene.tsx` **890 行**仍超标。展台比建造页更「重」：18×18 沙盘底座曲线、多模型全局遮挡排序、AABB 碰撞拖拽、触摸手势、悬停命中检测全在一个文件。

## 设计决定

### 拆出「纯几何派生」到 `src/render/showcaseLayout.ts`（196 行）
选它的理由：**全部是 placements / blueprints 的纯函数**，不碰 canvas、不碰 ref、不碰事件——拆走后可以单测。

| 搬走的内容 | 职责 |
| --- | --- |
| `compareCubes` / `RenderCube` | 画家算法排序（先 (x+y) 深度，再 z 高度） |
| `buildBaseGeometry` | 沙盘底座四条圆角边各 21 点采样 + 裙边闭合环 |
| `buildFootprintMap` | 蓝图足迹表 |
| `collectSortedCubes` | 按落位偏移展开所有模型的块并全局排序 |
| `buildOffsetBlocksMap` | 带落位偏移的块坐标（阴影/植被/命中检测共用） |

结果：**890 → 796 行**（-94），两个场景组件现在都回到 800 行以内。

## 取舍与被否方案

1. **没有拆 draw（约 170 行）**：与 BuildScene 同理，绘制循环绑定 canvas 上下文与局部状态，拆出去只会变成参数搬运。
2. **没有拆触摸手势（约 130 行）**：它和拖拽状态机（`DragState`）强耦合，抽 hook 需要把 6 个 ref 一起搬，收益不确定；留待以后需要复用时再做。
3. **没有动任何绘制参数**：本轮纯搬移，任何数值变化都会让「逐像素零差异」失去意义。

## 影响面

- 代码：`ShowcaseScene.tsx` -94 行；新增 1 个模块（196 行）+ 1 个测试（12 例）。
- 用户可见：**展台页逐像素零差异**。

## 验收标准

### 视觉回归（决定性证据）
同一份存档（6 座模型、18×18 沙盘）、同尺寸，拆分前后各截展台页：**变化像素 0 / 790,000**（±2/通道）。

### 新增单测（12 例）
- 排序：先比深度再比 z；
- `collectSortedCubes`：块总数正确、全局有序、**块坐标 = 落位 + (块 - 足迹最小角)**、未知蓝图被跳过；
- `buildOffsetBlocksMap`：每个模型一份、长度等于蓝图块数；
- `buildBaseGeometry`：四条边各 21 点、底面上方板厚 12px、裙边闭合对称、采样点不越出沙盘、纯函数；
- `buildFootprintMap`：覆盖全部传入蓝图。

### 自动化
- `npx tsc --noEmit` 0 错误；`npm test` **72 文件 / 604 用例全绿**；`npm run design:check` 通过。

## 后续（E5 完成情况）
| 文件 | 拆分前 | 拆分后 | 状态 |
| --- | --- | --- | --- |
| `BuildScene.tsx` | 906 | 786 | ✅ |
| `ShowcaseScene.tsx` | 890 | 796 | ✅ |
| `iso.ts` | 1110 | 14（barrel） | ✅（E4） |
| `ui.css` | 1218 | 10（barrel） | ✅（E4） |

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
