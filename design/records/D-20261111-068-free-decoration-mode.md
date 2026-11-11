---
id: D-20261111-068
date: 2026-11-11
title: 自由装饰模式：全落成后的展台补充玩法（最小方案，暂不实现）
status: approved
owner: lead
surface: [showcase]
axioms: [A1, A5, A7]
files: [src/pages/Showcase.tsx, src/render/ShowcaseScene.tsx, src/render/showcaseLayout.ts, src/logic/showcase.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261110-063（approved）正文已写明「全落成后提供自由装饰模式作为补充，不做主线」。按「1 习惯 ≈ 2 块/天」，18 座 1985 块大约是一千天量级的长期终点；长期用户在全落成后需要一种不破坏「时间形状」的补充玩法，而不是无限任务或沙盒经济。

本记录按用户本轮目标中的「推荐最小方案」提出：复用 ShowcasePlacements 与现有模型自由摆位/旋转/微生态，不新增持久化字段、不做新沙盒经济。**状态为 proposed：按 AGENTS.md §1，新机制须经人类确认后才实现，本轮不写代码。**

## 设计决定

- **解锁条件**：completedBlueprintIds 覆盖 blueprintOrder 全部（当前 18 座）时，展台页顶栏出现「装饰模式」开关；未解锁时零入口、零提示。
- **模式内能力（全部复用既有实现，不新增存档字段）**：
  1. 自由摆位：沿用现有 ShowcasePlacement 拖拽 + AABB 磁吸碰撞（已有能力，不改存档语义）。
  2. 90° 象限旋转：复用 isoGeometry.rotateCoord 既有数学，对已摆放模型做 0/90/180/270 旋转；旋转后宽深互换，若与邻居重叠则回退并提示。旋转是**本次会话的视图态**（React state），不写存档；重开复原——诚实说明，不假装持久化。
  3. 微生态：复用现有 eco props（streak 阶段）与既有调色板；装饰模式仅允许「换一组植被分布」的会话内重排（确定性伪随机种子），不落盘、不新增资源。
- **默认与边界**：解锁后装饰模式默认关闭；开关本身不写 settings/（不新增字段）；移动端旋转按钮 44px 触控目标，四主题沿用既有令牌；不做拆改已落成建筑、第二张桌子、装饰件商店或任何资源经济。
- **诚实文案**：模式内明示「旋转与植被重排仅在本次会话有效，重开复原」；zh/en 齐全。

## 取舍与被否方案

- 否掉新增 AppState 字段持久化旋转/装饰：会引入同步合并、旧客户端兼容矩阵与 schema 迁移成本，与「补充玩法不做主线」不匹配。
- 否掉拆改已落成建筑/第二张桌子/装饰件经济：会把产品变成 sandbox，稀释「时间形状」这个核心叙事（D-20261110-063 已否）。
- 否掉新美术/新颜色：旋转复用既有几何与材质色，零视觉语言扩张。
- 否掉「全落成才解锁才显示入口」之外的营销提示：不制造 FOMO。

## 影响面

代码：src/pages/Showcase.tsx、src/render/ShowcaseScene.tsx、src/render/showcaseLayout.ts、src/logic/showcase.ts、i18n 三文件、相关测试；不改存档格式、不改同步、不改 schemaVersion/contentVersion。
文档：SURFACES.md 展台章节需补一段装饰模式说明；CHANGELOG 随实现轮更新。

## 验收标准

1. 未全落成（合成状态）时展台无装饰模式入口；全落成后出现开关，默认关闭。
2. 开关与旋转/植被重排不写存档：操作前后 exportData 深度相等。
3. 旋转 90/180/270：模型中心不变、占地宽深互换；与邻居碰撞时回退并给出提示；重开后复原。
4. 四主题（light/dark/oat/fog）× zh/en 截图；移动端旋转按钮 ≥44px；reduced-motion 下无循环动画。
5. npx tsc --noEmit、npm test、npm run design:check 全绿；旧 12 座与 18 座蓝图数据零改动。

## 变更履历

- 2026-11-11 created (lead)：按用户本轮目标提出最小方案，status=proposed，等待人类确认；确认后按上述范围实现并补测试/四主题/移动端降级。
- 2026-11-11 人类确认（LeeCM）：按用户「批准你的所有内容，继续完成」指示，status proposed → approved；本轮开始实现。
- 2026-11-11 implemented (c1-decoration)：按 approved 范围落地——src/logic/showcase.ts 新增 isDecorationUnlocked / normalizeRotation / rotateBlockCoords / getRotatedFootprint / canRotatePlacement（canPlaceModel 增可选 rotations）；src/render/showcaseLayout.ts 新增 rotateBlocksForRender / buildRotatedFootprintMap，collectSortedCubes 与 buildOffsetBlocksMap 增可选 rotations，ShowcaseScene 的阴影/植被/命中检测/拖拽校验全部改用会话旋转派生；src/render/isoGround.ts 的 drawEcoProps 增可选 seed（默认 0 逐像素与旧实现一致，mulberry32 确定性重排）；src/pages/Showcase.tsx 增解锁开关（长度动态取自 blueprintOrder，不硬编码 18/23）、点击选中语义、旋转控件与「换一组植被」浮层（44px 触控、btn ghost/--ink/--line/--r-md、无新增颜色/依赖）。旋转/植被种子/选中均为本次会话 React state，不写存档、不改 settings/schema（浏览器 localStorage 与 exportData 操作前后相等已验证；退出装饰即复原，重开复原文案见 decorationHint）。测试：logic/showcase.test.ts 21 条 + render/showcaseLayout.test.ts 20 条 + 新增 src/pages/Showcase.test.tsx 6 条，全绿；npx tsc --noEmit 0 错；四主题 zh/en 与移动端 390 截图证据在 .tmp-c1/。
