---
id: D-20261110-043
date: 2026-11-10
title: 渲染数学底座补测（isoGeometry 18 例 / isoColor 18 例），并修掉 floorContrast 的契约漏洞
status: proposed
owner: lead
surface: []
axioms: [A3]
files: [src/render/isoGeometry.test.ts, src/render/isoColor.test.ts, src/render/isoColor.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

继 `D-20261110-042` 的覆盖体检后，本轮补 `src/render/isoGeometry.ts`（184 行）与 `src/render/isoColor.ts`（269 行）——E4 拆分后这两块只有**间接**覆盖（通过 `ambientContrast` / `themeContrast` 等场景测试），投影数学与颜色派生本身没有直接断言。

## 设计决定

### 1. `isoGeometry.test.ts`（18 例，断言投影不变量）
| 组 | 断言 |
| --- | --- |
| `worldToScreen` | 原点是 (0,0)；x+1 右下各半格且 **sx/sy = 2:1**；y+1 与 x 镜像；z+1 纯上移；**x/y 交换 = 水平镜像**；对角线移动只下移；块高/凸点高为正 |
| `rotateCoord` | 0 恒等；中心不动；**旋转四次回到原点**；180° = 两次 90°；负数/超范围归一化；**旋转保距** |
| `depth` | 画家算法键随 x/y/z 单调 |
| `followResize` | 尺寸不变则视图不变；**放大再还原是精确逆变换**（最大化→还原不漂移）；缩放钳制 [0.3,3]；模型中心相对位置保持 |

这些断言不写死像素值，所以将来微调 `tileW` / `blockH` 时测试仍然有效。

### 2. `isoColor.test.ts`（18 例，断言数学性质）
覆盖 `parseColor`（6/3 位 hex、rgb/rgba、非法输入不抛错）、`withAlpha`（CSS 变量原样透传）、`adjustLightness`（单调、钳制、透传）、WCAG（白=1/黑=0、黑白=21:1、同色=1:1）、`floorContrast`（浅底不动、暗底提亮、已够不动）、明暗派生（三面亮度顶>左>右、缓存命中、确定性）。

### 3. 测试抓到的真实缺陷：`floorContrast` 契约漏洞
写「暗底提亮到至少 minRatio」用例时失败：

```ts
floorContrast('#0b0b0b', '#0a0a0a', 1.6)  // 32 步全跑完仍只有 ~1.31:1，静默返回不达标颜色
```

原因：循环上限 32 步（乘数至 3.56），在「极暗块面 + 极暗背景」下**达不到 1.6:1** 就退出，函数文档写的「直到达到 minRatio」并不成立。
修复：上限提到 64 步（乘数至 6.12）。常规输入在前几步就命中并提前返回，**行为不变**；只有原本就失败的极端输入会得到更亮的正确结果——方向与 C4（暗色主题可辨性）一致。

## 取舍与被否方案

1. **没有改成解析式求解**：当前逐级调整简单、可预测，且命中即返回；把上限提高已消除漏洞，改写成解析式会增加理解成本（还要处理 HSL 往返）。
2. **没有放宽测试去适配实现**：那等于把 bug 写进契约（AGENTS §4 禁止改测试让测试变绿）。
3. **`roundedPoly` / `traceIsoGroundPath` 未直接单测**：它们依赖真实 canvas 上下文，断言路径命令需 mock 记录调用，收益低于场景级像素采样。

## 影响面

- 代码：`floorContrast` 循环上限 32 → 64（3 行 + 注释）；其余为新增测试。
- 用户可见：**正常情况下无变化**；只有原本对比度不达标的极端暗部会被提亮（可辨性提升）。

## 验收标准

- `isoGeometry.test.ts` 18 例、`isoColor.test.ts` 18 例全绿；
- `ambientContrast.test.ts` / `themeContrast.test.ts` 同步通过（35 例合计），证明修改未破坏既有对比度契约；
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **69 文件 / 574 用例全绿**；`npm run design:check` 通过。

## 变更履历

- 2026-11-10 created (lead)
