---
id: D-20261110-033
date: 2026-11-10
title: 实施 E4 第二、三步：iso.ts 拆分为 geometry/color/cube/ground 四模块（barrel 保接口）
status: proposed
owner: lead
surface: []
axioms: [A3]
files: [src/render/iso.ts, src/render/isoGeometry.ts, src/render/isoCube.ts, src/render/isoGround.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

`D-20261110-032` 拆出了颜色域（269 行），但 `iso.ts` 仍有 861 行同时装着：投影数学、几何原语、立方体绘制、精灵缓存、命中检测、地基/阴影/植被绘制。

## 设计决定

### 拆分结果（五个文件，职责单一）
| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `iso.ts` | **14** | barrel：四个模块统一再导出，保持 `from './iso'` 不变 |
| `isoGeometry.ts` | 184 | 坐标变换、旋转、视口跟随、圆角路径、等距地基路径 |
| `isoColor.ts` | 269 | 调色板、颜色派生、WCAG 对比度、时段环境光（上轮已拆） |
| `isoCube.ts` | 490 | 单块绘制（三面+圆角+凸点+装饰）、精灵缓存（LRU+字节预算）、命中检测 |
| `isoGround.ts` | 195 | 地基虚线框、接触阴影、微生态植被 |

### 依赖方向（无环）
```
iso.ts → geometry / color / cube / ground
isoCube → geometry + color
isoGround → geometry + color + cube（植被是缩小版积木，需要 drawCube）
```

## 取舍与被否方案

1. **为什么不让 isoGround 与 isoCube 互相引用**：会造成 ESM 循环导入（运行时容易得到 undefined 导出）。按「几何 → 颜色 → 积木 → 地面」的**单向依赖**分层，`decorate()`（积木装饰）留在 isoCube 而非地面模块。
2. **为什么保留 barrel 而不是改所有 import**：二十多个消费方（场景、弹窗、画报、测试）都写 `from './iso'`，改路径会让本次 diff 混入 20+ 个文件的噪声；barrel 让「拆分」与「调用方」解耦。
3. **为什么现在拆**：颜色域拆出后，`iso.ts` 剩余部分确实按职责分成三块且互相依赖单一，属于「拆完风险最低」的时机；再拖下去等新功能进来又会耦合。

## 影响面

- 代码：`iso.ts` **861 → 14 行**；新增三个模块；**消费方零改动**。
- 用户可见：**无**（逐字节相同的绘制逻辑，只是文件位置变了）。

## 验收标准

### 自动化（已通过）
- `npx tsc --noEmit` 0 错误；`npm test` **62 文件 / 505 用例全绿**（精灵缓存、环境光对比度、颜色令牌、场景测试全部覆盖新模块边界）；
- `npm run design:check` 通过（33 条记录）。

### 运行时验收（浏览器实测）
| 页面 | canvas | 采样非白像素 |
| --- | --- | --- |
| 建造（24 块 + 地基） | 1264×632 | **8236** |
| 展台（5 座模型 + 阴影 + 植被） | 1264×632 | **8227** |

两个场景都正常绘制（非白屏），说明 isoCube / isoGround 的绘制路径在拆分后完好；截图 `.tmp-verify/e4b-build.png` / `e4b-showcase.png`。

## 遗留（E4 剩余）
- `ui.css`（约 1218 行）按「基础 / 表单 / 卡片 / 弹窗 / 画布控件」拆分 —— 纯 CSS 搬移，验证方式是「拆分前后逐像素 0 差异」。

## 变更履历

- 2026-11-10 created (lead)
