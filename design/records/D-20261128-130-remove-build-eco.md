---
id: D-20261128-130
date: 2026-11-28
title: 移除建造页绿色装饰：下线逐建筑微生态，建造与展台都不再生成植被
status: approved
owner: Claude Code
surface: [build, showcase]
axioms: [A1, A2, A4, A6]
files: [src/render/BuildScene.tsx, src/render/buildscene/sceneDraw.ts, src/render/buildscene/sceneTypes.ts, src/render/buildscene/ecoStage.ts, src/render/isoGround.ts, src/render/iso.ts, src/render/seedRandom.ts, src/logic/eco.ts, src/logic/eco.test.ts, src/render/buildSceneEco.test.tsx, src/render/ShowcaseScene.tsx, src/components/settings/LabGroup.tsx, src/logic/innovations.test.ts, README.md, README.zh-CN.md, design/ART.md, design/TOKENS.md, design/SURFACES.md, design/VOICE.md, design/AESTHETIC.md, design/records/D-20261128-129-sandbox-color-only.md, design/records/D-20261127-127-showcase-sandboxes-yard.md, design/RECORDS.md, design/index.json]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户明确要求「建造页面的绿色装饰去掉」。此前 D-20261127-127 删除了实验室全局开关，但建造页仍按连胜阶段绘制逐建筑微生态（绿色灌木、石点、暖光花）；D-20261128-129 只移除了展台植被，建造页仍保留。现在两处的植被都要下线。

## 设计决定

- **移除建造页微生态**：`sceneDraw` 不再绘制 back/front 植被；`BuildScene` 不再计算 `ecoStage`；`SceneState` 去掉 `ecoStage`；`isoGround` 删除 `drawEcoProps`/`buildEcoPalettes`/`EcoVariant`/`EcoPalettes`；删除 `logic/eco.ts`、`render/buildscene/ecoStage.ts` 与 `seedRandom.ts`（不再有消费者）。
- **保留的内容**：建筑的材质色块（窗户、门、砖墙、灯等）、接触阴影、虚线地基、落块动画、透视考古、图鉴/档案/拍立得/画报全部不变；建造页不会因为移除植被而失去任何建筑细节。
- **无全局开关**：`settings.enableEcoProps` 已在 D-20261127-127 删除，本轮不再引入任何替代开关；建造页视觉恒定，不再依赖连胜阶段。
- **展台**：D-20261128-129 已无植被，本轮保持一致；沙盘只保留底座颜色方案（苔绿/石白/暖沙/素盘）。本记录只取代 D-127/D-129 中「建造页保留微生态」的条款，展台颜色方案继续有效。
- **测试**：删除 `buildSceneEco.test.tsx` 与 `logic/eco.test.ts`；`render`/`logic` 其余测试保持。

## 历史参数（已下线）

- 阶段：1 天萌芽 / 7 天小径 / 21 天树 / 100 天花园。
- 调色板：绿 `#8fce8f/#57a457/#2f7d3a`（ink rgba(24,58,32,.55)）、石 `#d6d3d1/#a8a29e/#78716c`、暖光花 `#e9c46a/#f59e0b/#d97706`。
- 绘制：建造页逐建筑 margin 环带，back/front 两层；迷你积木 16×8×7。
- 代码已删除；完整参数见 ART §7 的历史引用块与 git 历史。

## 取舍与被否方案

- **否掉只把阶段设为 0**：会把「看不见但仍在跑」的生态代码留在热路径里，且未来误改阶段又会复现；直接删除整条绘制链更干净。
- **否掉只删绿色、保留石点/花**：微生态是一整层装饰；用户要的是去掉这块视觉，留下半套色块反而更碎。
- **否掉保留 `drawEcoProps` 供未来复用**：没有调用方就是死代码，且其调色板与展台颜色方案容易混淆；需要时从 git 历史取回。
- **否掉同时删除建筑材质色**：用户只要求绿色装饰，窗户/门/砖墙的颜色是建筑识别度的一部分，必须保留。

## 影响面

- 代码：BuildScene / buildscene 绘制链 / isoGround / iso.ts；删除 eco/seedRandom 模块与两个测试。
- 存档：无字段变化；`enableEcoProps` 早已不写入。连胜/连击数据仍用于奖励块与统计，不受影响。
- 文档：ART §7 微生态段落标注退役；TOKENS §7 生境花砖行标注下线；SURFACES 实验室描述更新；README 如仍提微生态一并更新。
- 验收：建造页无任何迷你植被；所有 23（将扩到 35）座建筑的积木/阴影/动画/图鉴不变；`tsc`、`npm test`、`design:check` 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「建造页面的绿色装饰去掉」提出；status=proposed，等待人类审核。

- 2026-11-28 human review approved (LeeCM)：按用户在会话中的明确确认，status proposed → approved，reviewer pending → LeeCM。
