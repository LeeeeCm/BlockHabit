---
id: D-20261110-044
date: 2026-11-10
title: 实施 E5：BuildScene 906 → 786 行（拆出动画时间线 / 取景数学 / 读砖气泡），逐像素零差异
status: proposed
owner: lead
surface: [build]
axioms: [A5]
files: [src/render/sceneMotion.ts, src/render/sceneCamera.ts, src/components/BrickInspectPopover.tsx, src/render/BuildScene.tsx, src/render/sceneMotion.test.ts, src/render/sceneCamera.test.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

`AGENTS.md` §4 要求「单文件超过 800 行时，新增逻辑应拆到新文件」。但 `BuildScene.tsx` **906 行**、`ShowcaseScene.tsx` **890 行**至今超标 —— E4 只处理了 `iso.ts` 与 `ui.css`，场景组件仍是「渲染 + 动画 + 相机 + 交互 + 气泡 UI」都住在一起的大文件。

## 设计决定（本轮做 BuildScene 三块，全部是纯搬移）

| 新文件 | 行数 | 从 BuildScene 搬走的内容 |
| --- | --- | --- |
| `src/render/sceneMotion.ts` | 79 | 动画时间线：新块慢落 `animState`、果冻 `jelly`、级联 `cascadeState`、`planCascade` 与四个时长常量 |
| `src/render/sceneCamera.ts` | 61 | 取景数学 `computeFitView`：D10 的两条上限（单轴 2×、开荒期 1.5×）、留白、垂直偏下 0.56 |
| `src/components/BrickInspectPopover.tsx` | 74 | 3D 积木悬浮读砖气泡（纯展示组件，无状态） |

结果：**906 → 786 行**（-120），三块都能独立单测。

## 取舍与被否方案

1. **没有拆「绘制主循环」**：它同时读写 canvas 上下文、ref 与局部动画状态，拆出去只会把参数通过 props 层层传入，可读性更差。绘制路径的验证靠像素采样，不靠模块边界。
2. **没有把 `sceneBounds`（按已放置积木取景）也搬走**：它依赖 `stateRef` 与 `blueprintCenter` 的闭包，搬出去要额外传 4 个参数且只省 10 行；留在场景内更易读。
3. **没有顺手改动画参数**（时长/回弹幅度）：本轮是搬移，任何数值变更都会让「逐像素零差异」这个验收条件失去意义。

## 影响面

- 代码：`BuildScene.tsx` -120 行；新增 3 个模块（共 214 行，含注释）；**渲染路径逐字节相同**。
- 用户可见：**建造页逐像素零差异**（见验收）。

## 验收标准

### 视觉回归（决定性证据）
同一份存档（17/24 块）、同一窗口尺寸，拆分前后各截建造页：**变化像素 0 / 790,000**（阈值 ±2/通道）。

### 新增单测（18 例）
- `sceneMotion.test.ts`（12 例）：落地在高处、终点落位无形变、下落高度单调递减、果冻守体积（压 Y 胀 X 的既定比例 0.85）、级联逐层延后且同层同步、总时长 = 末块起点 + 单块时长；
- `sceneCamera.test.ts`（6 例）：留白内可见、单轴 2× 上限、开荒期不超过整蓝图铺满的 1.5 倍、水平居中 + 垂直 0.56、自定义留白生效。

> 修正记录：初版测试把「t=0 应为无形变」写错了 —— 实现语义是 **t=0 落地瞬间最扁**（`sx=1.289, sy=0.66`），到 t=1 才收敛。**实现是对的，测试期望错了**，已按实现语义修正（不是放宽断言）。

### 自动化
- `npx tsc --noEmit` 0 错误；`npm test` **71 文件 / 592 用例全绿**；`npm run design:check` 通过。

## 后续（E5 剩余）
- `ShowcaseScene.tsx` **890 行**仍未达标，下一轮按同样方式拆（相机交互 hook + 气泡 UI）。

## 变更履历

- 2026-11-10 created (lead)
