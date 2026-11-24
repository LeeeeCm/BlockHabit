---
id: D-20261124-082
date: 2026-11-24
title: 统计页按视图拆分与导出画布共享原语（零行为变化）
status: proposed
owner: Claude
surface: [stats, yearbook, building-archive, polaroid, monthly-poster]
axioms: [A1, A4]
files: [src/pages/Stats.tsx, src/pages/stats/, src/render/print/canvasKit.ts, src/render/yearbookCanvas.ts, src/render/buildingArchiveCanvas.ts, src/components/PolaroidModal.tsx, src/components/MonthlyPosterModal.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

`src/pages/Stats.tsx` 782 行，一个组件同时承担页头、指标视图、手账长廊、修复砖确认与两处导出弹窗；文件未超 800 行，但四类职责互相纠缠，任何一处调整都要通读全文件。

导出侧有四套并行画布实现（年鉴 788、建筑档案 407、拍立得 436、月度画报 500），重复了同一批原语：字体串与 `setFont`、`canvas.width/height + scale(dpr)`、按宽度截断/折行、等待字体、主题色读取。建筑档案画布甚至反向 import 年鉴画布，形成「导出模块依赖另一个导出模块」的链。

## 设计决定

1. **统计页**拆为容器 + 视图组件：`StatsHeader`、`StatsEchoCapsule`、`StatsMetricsView`、`StatsChronicleView`、`StatsRepairDialog`，共享类型放 `pages/stats/types.ts`。状态与数据派生仍留在 `Stats.tsx`，切换视图不重置筛选（与现状一致）。
2. **导出原语**抽到 `src/render/print/canvasKit.ts`：
   - `FONT_SANS` / `FONT_NUM` / `setFont`
   - `prepareCanvas(canvas, width, height, dpr)`（物理尺寸 = 逻辑 × DPR，统一 scale）
   - `truncateToWidth`（新增 `minLength` / `ensureEllipsis` 选项，覆盖相纸与画报的既有截断语义）
   - `wrapTextToWidth`、`waitForFonts`、`readPrintPalette` / `readCssVar`
3. `yearbookCanvas` 保留原有公开导出名（`readYearbookPalette` / `waitForYearbookFonts` / `truncateToWidth` / `wrapTextToWidth`）作为 re-export，调用点与测试零改动；`buildingArchiveCanvas` 改为直接依赖 `canvasKit` + `modelStage`，切断「档案 → 年鉴」依赖。
4. 拍立得与月度画报把各自手写的 `while (measureText)` 截断循环换成共享函数，参数保持原最小长度（4 / 3）与「溢出必补省略号」语义。

## 取舍与被否方案

- 否掉「统一四套导出的模板引擎」：四张印刷品的版式差异是产品资产，强行抽象会改变布局与绘制顺序，无法用现有契约测试证明零回归。
- 否掉「把分享/下载/剪贴板流程也收口」：各处 toast、失败回退与浏览器差异不同，收益小、回归面大。
- 否掉「把统计页筛选状态下沉到视图组件」：会导致切换视图时筛选重置，属于行为变化。

## 影响面

- 代码：统计页文件数增加、单文件行数下降；导出模块只改原语导入与等价替换。
- 视觉：零变化。所有绘制顺序、数值、字体、颜色、截断结果保持不变。
- 测试：新增 `canvasKit` 单测；年鉴/档案既有画布契约测试不改断言。

## 验收标准

1. `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check`、`npm run build` 全绿。
2. `src/pages/Stats.tsx` ≤ 350 行，新增视图组件均 ≤ 300 行；`src/` 下无 > 800 行文件。
3. 年鉴/档案画布测试的「物理尺寸 = 逻辑 × DPR」「fonts.ready 被 await」「文案确实画了」断言零改动通过。
4. 生产构建主 chunk 增量 ≤ 2 kB（纯模块边界开销）。

## 变更履历

- 2026-11-24 created (Claude)
