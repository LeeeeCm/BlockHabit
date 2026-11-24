---
id: D-20261124-092
date: 2026-11-24
title: 图鉴缩略图修复：建造中显示当前形态 + 计划轮廓，图片不再顶到卡片边缘
status: proposed
owner: Claude
surface: [gallery]
axioms: [A2, A6]
files: [src/components/BlueprintThumb.tsx, src/components/BlueprintThumb.test.tsx, src/components/GalleryDialog.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

用户反馈：图鉴缩略图又超出模块；之前「正在建造中的模型显示当前样子」的效果不见了。

现状：`BlueprintThumb` 始终画完整蓝图；建造中卡片也显示完成形态，和 4/21 的进度不符。缩略图画布没有独立裁剪容器，模型贴到卡片上沿，看起来像被切断/溢出。

## 设计决定

- `BlueprintThumb` 新增 `placedCount`：传入时只画前 N 块（当前形态）；地基与 fit 包围盒仍按完整蓝图，舞台不缩水。
- 建造中先画一层**极淡的完整轮廓**（`--ink` 6–14% 派生，`ghostPalette`）提示「将要长成什么」，再把已落块画成实色；0 块时不会只剩一张空白卡。
- 缩略图外面包一层 `.gallery-thumb`（132×92、`overflow:hidden`、r-sm），模型只可能落在缩略图内。
- 缩略图 fit 改为 `pad=12 / maxScale=0.72`，给高模型留出上沿呼吸，不再顶到卡片边。
- 图鉴只对 `building`（当前建造中）传 `placedCount`；已落成与未开始仍画完整形态，锁定仍走剪影。

## 取舍与被否方案

- 否掉「建造中也画完整彩色模型」：与 4/21 的进度矛盾，违反 A6 数据诚实。
- 否掉「0 块时留空白」：用户会以为缩略图坏了；用极淡计划轮廓表达「尚未开始但有目标」。
- 否掉「缩小整个图鉴卡片」：问题在缩略图适配，不在卡片尺寸。

## 影响面

- 图鉴缩略图绘制与卡片结构；新增 `thumbBlocks` 纯函数与测试。
- 无数据字段、无颜色档位、无布局断点变化。

## 验收标准

1. 建造中卡片只显示已落块，并带极淡完整轮廓；0 块时仍有计划轮廓。
2. 高模型（照相机 / 火箭 / 风车）上沿不贴卡片边、不被裁切。
3. 已落成 / 未开始 / 锁定三种状态视觉不变。
4. `tsc`、`vitest` 通过；桌面端图鉴截图确认。

## 变更履历

- 2026-11-24 created (Claude)
- 2026-11-24 浏览器验收：coffee 4/21 显示 4 块实色 + 计划轮廓；锁定剪影不再顶边。