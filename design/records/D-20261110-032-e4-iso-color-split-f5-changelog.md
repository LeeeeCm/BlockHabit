---
id: D-20261110-032
date: 2026-11-10
title: 实施 E4 第一步（颜色域拆分）+ F5 收尾（CHANGELOG）
status: approved
owner: lead
surface: []
axioms: [A3]
files: [src/render/isoColor.ts, src/render/iso.ts, CHANGELOG.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

### E4：超大文件债务
审计 E4（P2）：`src/render/iso.ts` **1110 行**，一个文件里同时住着：等距投影数学、颜色派生与 WCAG 对比度、调色板与环境光、几何工具、立方体精灵缓存、立方体绘制、地形/植被绘制。任何一处改动都要在 1110 行里找位置，且无法只测其中一块。

### F5：缺 CHANGELOG
项目有 31 条设计记录、有 CI、有设计中枢，但**没有一个面向使用者的版本说明**——新用户看不到「这版改了什么」，维护者也很难一眼回顾。

## 设计决定

### 1. 拆出「颜色域」：`src/render/isoColor.ts`（268 行）
选它作为第一步，理由是**不依赖任何几何/画布上下文**：
- `IsoPalette` 类型；
- 颜色工具：`parseColor` / `withAlpha` / `adjustLightness`；
- WCAG 对比度：`relativeLuminance` / `contrastRatio` / `floorContrast`；
- 明暗派生：`BlockShading` / `deriveShading` / `deriveShadingForColor`；
- 时段环境光：`TimePeriod` / `getTimePeriod` / `applyAmbientLighting` / `paletteFromDocument`。

`iso.ts` 通过 `export * from './isoColor'` **保持所有既有导入路径不变**（`from './iso'` 仍然有效），二十多个消费方零改动。

### 2. CHANGELOG：每条变更都带设计记录编号
`CHANGELOG.md` 按批次（A 数据安全 / B 奖励回路 / C 无障碍 / D 视觉纪律 / E 体积性能 / F 产品化）组织，每条变更末尾标注 `D-YYYYMMDD-NNN`，读者可顺着编号进 `design/records/` 看背景、取舍与验收证据。

## 取舍与被否方案

1. **没有一次性拆完**：几何工具与绘制原语紧耦合（`drawCube` 用到十余个几何辅助），一次搬 800 行又缺逐像素回归基线，风险远大于收益。改为「先拆不依赖画布的纯函数域」，每步可独立验证。
2. **否决「拆成 iso/ 目录」**：那要把 `iso.ts` 整体移成 `iso/index.ts`，diff 会变成整文件搬迁，review 成本高。
3. **LICENSE 未创建**：`package.json` 没有 `license` 字段，加许可证属**法律声明**而非工程决策，留给人拍板（与 D1/D2 同理）。

## 影响面

- 代码：`iso.ts` **1110 → 861 行**；新增 `isoColor.ts` 268 行；消费方零改动。
- 用户可见：**无**（纯代码搬迁，绘制路径逐字节相同）。
- 文档：新增 `CHANGELOG.md`（66 行）。

## 验收标准

### 自动化（已通过）
- `npx tsc --noEmit` 0 错误；`npm test` **62 文件 / 505 用例全绿**（`spriteCache.test.ts` / `ambientContrast.test.ts` / `themeContrast.test.ts` 等直接依赖颜色域的测试全部通过，证明再导出无遗漏）；
- `npm run design:check` 通过（32 条记录）。

### 运行时验收
- 浏览器打开建造页：canvas 1264×632 正常绘制，采样非白像素 8236 个（模型存在，非白屏）；
- 截图 `.tmp-verify/e4-after-split.png`。

## 后续（E4 剩余）
1. 几何工具 + 立方体绘制 → `isoCube.ts`；
2. 地形/阴影/植被绘制 → `isoGround.ts`；
3. `ui.css`（1218 行）按「基础 / 表单 / 卡片 / 弹窗 / 画布控件」拆分。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
