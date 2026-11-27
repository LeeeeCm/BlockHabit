---
id: D-20261128-129
date: 2026-11-28
title: 沙盘设计收敛为颜色选择：移除展台植被，仅保留沙盘底色
status: approved
owner: Claude Code
surface: [showcase]
axioms: [A1, A2, A4]
files: [src/types.ts, src/logic/showcase.ts, src/logic/showcase.test.ts, src/storage/adapter.ts, src/sync/merge.ts, src/store/appStore.ts, src/store/appStoreTypes.ts, src/store/showcaseSandbox.test.ts, src/render/ShowcaseScene.tsx, src/render/showcase/canvas.ts, src/render/showcase/canvas.test.ts, src/render/showcase/derived.ts, src/render/showcaseLayout.ts, src/render/seedRandom.ts, src/components/showcase/SandboxList.tsx, src/pages/Showcase.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, src/components/ui-showcase.css, design/records/D-20261128-128-sandbox-vegetation.md, design/SURFACES.md, design/ART.md, design/TOKENS.md, design/VOICE.md, design/RECORDS.md, design/index.json]
supersedes: [D-20261128-128]
reviewer: LeeCM
---

## 背景与问题

用户在看到整盘植被方案后明确反馈：

1. 「不要这个沙盘植被设计了，就保留多个颜色选择吧」——不再需要展台的成片植被；
2. 之前的整盘植被虽然解决了「只围着单座建筑」和占地重叠，但整体仍不像被设计过的沙盘；
3. 建造页的绿植装饰必须保留（用户单独强调「建造页面的装饰不要又删除掉」）。

因此本轮把展台的「设计」收敛为**纯颜色选择**：沙盘底座有多个颜色方案，但不生成任何植被；建造页的逐建筑微生态保持原样。

## 设计决定

- **移除展台植被**：删除 `buildShowcaseEcoLayout`、整盘植被绘制、`vegetationSeed` 字段与「换一组植被」入口；`ShowcaseScene` 不再订阅 habits/checkIns 计算生态阶段，展台只画底座与建筑。
- **沙盘设计 = 底色**：`ShowcaseSandbox.design` 保留四种方案，只改变底座颜色，不改变建筑、UI、抽屉或图鉴：
  - 苔绿 moss：鼠尾草绿 `#4f776a`
  - 石白 stone：浅暖石 `#a89f91`
  - 暖沙 bloom：暖光金 `#e9c46a`
  - 素盘 bare：不染色
- **染色方式**：设计色与白色按 20% 柔化，再与主题 `--block-top/left/right` 按不同强度混合；浅色主题强度 0.52 / 0.40 / 0.50，暗色主题整体乘 0.7，保持「顶面最亮、右面最暗」并避免墨黑主题上出现发亮的彩色板。建筑积木不染色。
- **文案**：设计分组标题改为「沙盘颜色」，四个选项改为颜色导向的「苔绿 / 石白 / 暖沙 / 素盘」（en: Sage / Stone / Sand / Bare）；删除「换一组植被」及所有植被说明。
- **存档兼容**：移除 `vegetationSeed` 字段与 `reshuffleShowcaseVegetation` action；旧存档里的该字段在清洗时直接丢弃，不影响 placements/design。
- **D-128 作废**：整盘植被方案（D-20261128-128）被本记录取代，状态置 `superseded`，正文保留作为「用户否决的植被设计」历史。

## 取舍与被否方案

- **否掉继续调植被布局/密度**：用户已明确不要展台植被；继续投入是逆需求。
- **否掉保留逐建筑环带**：用户第一轮已指出「应该在整张沙盘」且会与建筑重叠；既然不要植被，就整体移除，避免半套方案。
- **否掉给沙盘新增专用色板**：四色全部来自 ART §10 既有材质色，减少 A1 审批与主题漂移。
- **否掉只做文字色名不做底色**：用户要的是「颜色选择」，必须能在沙盘上看见；底色是唯一可见的载体。
- **否掉把颜色染到建筑或 UI**：会破坏建筑材质与黑白灰骨架；只染底座。

## 影响面

- 数据：`ShowcaseSandbox` 去掉 `vegetationSeed`；store 去掉重排 action；adapter/sync 同步清理；旧档自然丢字段。
- 渲染：删除 `render/showcase/eco.ts` 与整盘植被；`ShowcaseScene` 恢复建筑绘制 + 底座设计色；`canvas` 保留 `SANDBOX_TINTS/buildSandboxBasePalette`；建造页 `drawEcoProps` 不动。
- 界面：`SandboxList` 删除「换一组植被」；设计标题与选项改为颜色名；CSS 色点使用三种材质色。
- 文档：SURFACES 展台章节、ART §5/§7、TOKENS §7、VOICE 术语表；D-128 置 superseded，D-127 补履历。
- 测试：删除整盘植被测试；保留底座配色测试；store 沙盘测试去掉种子/重排；其余展台测试保持。

## 验收标准

1. 展台不再出现任何植被/迷你积木；建造页绿植装饰仍正常显示。
2. 四个颜色方案在纸白/墨黑主题下都有明显可见且不同的底座色；顶面亮度 > 左面 > 右面。
3. 左抽屉只有颜色 chip，没有「换一组植被」；标题显示「沙盘颜色」。
4. 旧存档加载不因缺少 `vegetationSeed` 报错；新存档不再写入该字段。
5. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「不要这个沙盘植被设计了，就保留多个颜色选择」提出；取代 D-20261128-128，status=proposed，等待人类审核。
- 2026-11-28 refined（D-20261128-130）：用户进一步要求「建造页面的绿色装饰去掉」，建造页逐建筑微生态也下线；本记录中「建造页保留微生态」的部分不再成立，展台颜色方案不变。

- 2026-11-28 human review approved (LeeCM)：按用户在会话中的明确确认，status proposed → approved，reviewer pending → LeeCM。
