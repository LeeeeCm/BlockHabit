---
id: D-20261128-131
date: 2026-11-28
title: 内容包 v6「城市与生活 III」：追加 12 座建筑蓝图
status: approved
owner: Claude Code
surface: [build, gallery, showcase, archive]
axioms: [A1, A2, A3, A6]
files: [src/logic/blueprints/generatorsV6.ts, src/logic/blueprints/index.ts, src/logic/blueprints/manifest.ts, src/logic/blueprints/palette.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, src/logic/blueprints/content.test.ts, src/logic/blueprints/blueprints.test.ts, src/logic/blueprints/index.test.ts, src/logic/blueprints/contentPackKit.test.ts, src/storage/contentVersion.test.ts, src/components/GalleryDialog.test.tsx, README.md, README.zh-CN.md, design/AESTHETIC.md, design/SURFACES.md, design/RECORDS.md, design/index.json]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户要求「再新增 12 个建筑蓝图」。现有主线为 23 座（v1 基础 12 + v2 6 + v3 5，2485 块）；本轮追加一个 12 座的内容包，保持既有 23 座的坐标、块数、顺序与解锁语义零改动。

## 设计决定

- **内容包 v6「城市与生活 III」12 座**，追加在既有 23 座之后：
  | id | 中文 | English | 块数 |
  |---|---|---|---:|
  | station | 火车站 | Train Station | 112 |
  | theater | 剧院 | Theater | 95 |
  | museum | 博物馆 | Museum | 102 |
  | hospital | 医院 | Hospital | 98 |
  | school | 学校 | School | 94 |
  | chapel | 教堂 | Chapel | 104 |
  | temple | 寺庙 | Temple | 100 |
  | carousel | 旋转木马 | Carousel | 92 |
  | pier | 码头 | Pier | 98 |
  | fountain | 喷泉 | Fountain | 116 |
  | market | 集市 | Market | 83 |
  | stadium | 体育馆 | Stadium | 102 |
  合计 **12 座 / 1196 块**，全量 **35 座 / 3681 块**。
- **生成器拆分**：新建 `generatorsV6.ts`，只做追加，不触碰既有 23 座；每座 80–120 块、4–8 层、坐标唯一、无完全悬空、z 非递减，装饰（window/gate）3–9 处。
- **颜色**：全部取自 ART §10 / `palette.ts` 的批准材质色板，不新增 hex；每座在 `BLUEPRINT_COLOR_PLAN` 声明角色色，满足 ≥3 色、≥2 材质家族、强调色占比 ≥8%。
- **内容版本**：`CONTENT_VERSION` 5 → 6；`CONTENT_PACK_V6_IDS` 与 `CONTENT_PACKS` 增加 `city-life-3`（version 6，releasedAt 2026-11-28）；`BASE_PACK_IDS` 排除 v2/v3/v6，基础包仍为 12 座。只升 contentVersion，绝不升 schemaVersion；旧客户端遇到 v6 存档走 needsUpgrade，不静默清洗。
- **命名/文案**：zh/en 各 12 个名称走 i18n `blueprints` 表；图鉴、建造、容量、展台、年鉴、档案全部继续从 `blueprintOrder` 动态派生，不硬编码 35。
- **不改既有 23 座**：旧 18 座与 v3 5 座的逐块指纹/块数测试保持原样；只追加 v6 的结构与块数测试。

## 取舍与被否方案

- **否掉把 12 座塞进 `generators.ts`**：既有生成器已接近 800 行上限，且建筑数据属设计性资产；新文件只追加，避免触碰旧数据。
- **否掉新增颜色**：12 座全部复用 ART §10 的既有材质色，避免 A1 扩张与四主题漂移。
- **否掉修改旧 23 座**：新增内容只能追加；旧蓝图指纹锁定，避免破坏存档 index 与图鉴顺序。
- **否掉一次只加 5–6 座**：用户明确要 12 座；`contentPackKit` 的 4–6 座默认规则是 v3 规划脚手架，不用于否决本轮实际内容包（其默认值保持历史，不强行改写）。
- **否掉硬编码 UI 总数**：所有页面继续读 `blueprintOrder`，文档/README 才写具体数字。

## 影响面

- 代码：新生成器、注册表、manifest、调色板计划、i18n 名称；图鉴/建造/容量/展台/档案无需逻辑改动（动态派生）。
- 存档：contentVersion 5→6；旧存档读取后写 6；旧客户端拒绝读取 v6（needsUpgrade）。
- 文档：README/README.zh-CN 的模型数、块数、内容上限；AESTHETIC 的当前口径；SURFACES 图鉴当前 35；RECORDS/index。
- 测试：内容包/注册表/调色板/内容版本/图鉴总数；新增 v6 结构与块数测试；既有 23 座指纹不变。

## 验收标准

1. `blueprintOrder` 35 座，v6 严格追加在 v3 之后；既有 23 座块数/指纹不变。
2. v6 每座 80–120 块、4–12 层、坐标唯一、无完全悬空、装饰 3–10；合计 1196。
3. 每座 ≥3 色、≥2 材质家族、强调色 ≥8%，全部色值在批准色板内。
4. 图鉴显示 35 张卡片；建造/容量/展台/年鉴/档案同步动态；zh/en 名称齐全。
5. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「再新增 12 个建筑蓝图」提出；status=proposed，等待人类审核。

- 2026-11-28 human review approved (LeeCM)：按用户在会话中的明确确认，status proposed → approved，reviewer pending → LeeCM。
