---
id: D-20261124-099
date: 2026-11-24
title: 图鉴缩略图修复：去除双形态叠加与白色底板并居中当前形态
status: approved
owner: Claude Code
surface: [gallery]
axioms: [A2, A4]
files: [src/components/BlueprintThumb.tsx, src/components/BlueprintThumb.test.tsx, src/components/GalleryDialog.tsx, src/components/GalleryDialog.test.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户反馈图鉴卡片里白色底板超出模型模块、未建成轮廓与建造中形态叠在一起，模型偏左不居中。原因是建造中同时绘制“完整幽灵蓝图”和“当前已落块”，且取景使用完整蓝图包围盒；缩略图外层还画了 surface 底板。

## 设计决定

- 建造中只绘制当前已落块（0 块时绘制一次完整浅色计划轮廓），不再叠画完整幽灵形态。
- 取景、地基与包围盒都按当前绘制块计算，使当前形态在缩略图内居中。
- 缩略图外层背景改为透明，白色底板只由卡片自身提供；锁定剪影仍透明。
- 移除旧的 ghost 叠加逻辑与其调用，保留缩略图共享的 `paintModelStage` 与主题色。

## 取舍与被否方案

- 否掉保留计划轮廓叠加：两套形态必然重叠，用户明确不美观。
- 否掉固定完整蓝图取景：建造早期会偏左/缩水。
- 否掉给底板加圆角/边框修饰：问题在多余底板，不应再叠一层。

## 影响面

图鉴缩略图的建造中与锁定表现；不影响建筑渲染、展台与统计导出。

## 验收标准

- 建造中卡片只显示当前形态并居中；0 块时只显示一层计划轮廓。
- 缩略图区域没有额外白色底板溢出卡片；四主题一致。
- 图鉴总数/锁定/桌宠分区测试通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户截图修复。
