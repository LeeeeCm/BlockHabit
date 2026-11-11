---
id: D-20261111-070
date: 2026-11-11
title: 内容包 v3：城市与生活续章 5 座（约 500 块）与 CONTENT_VERSION=3
status: approved
owner: lead
surface: [build, gallery, stats, settings]
axioms: [A1, A6, A7]
files: [src/logic/blueprints/generators.ts, src/logic/blueprints/palette.ts, src/logic/blueprints/index.ts, src/logic/blueprints/manifest.ts, src/logic/blueprints/content.test.ts, src/storage/contentVersion.test.ts, src/components/GalleryDialog.test.tsx, src/components/AboutPanel.test.tsx, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, README.md, CHANGELOG.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261110-063（approved）已交付免费扩展包 v2：基础 12 座 + 「城市与生活」6 座 = 18 座 / 1985 块，并建立 contentVersion 门禁与动态总数。按「每年一批 4–6 座、约 400–600 块」的公开节奏（设置页「内容路线」已如实承诺），且用户已批准本轮按 C3 评估建议推进，现交付 v3。

## 设计决定

- **规模与节奏**：追加 **5 座 / 500 块**（每年一批、随安装包内置、免费、不联网下载）；`CONTENT_VERSION` 2 → **3**，`schemaVersion` 不变。
- **主题**：「城市与生活」续章 —— 街角面包房 / 旧书店 / 邮政所 / 消防站 / 水塔；id 依次 `bakery` / `bookshop` / `postoffice` / `firestation` / `watertower`，块数依次 98 / 104 / 92 / 112 / 94（合计 500；每座 80–120），全部追加在既有 18 座之后，既有建筑零改动。
- **美术**：沿用等距积木语言与 D-20261111-067 的「材质调色板」体系——每座声明角色→色值，全部复用已批准的 24 色板；每座 ≥3 色、跨 ≥2 材质家族、非中性 accent 比例不低于 8%，不做新色相/渐变/阴影。逐座配色由 `palette.ts` 声明并由 palette.test 契约校验。
- **内容版本与兼容**：manifest 增加 v3 pack；`CONTENT_VERSION=3`；旧 v2 存档正常读入并升到 3；未来 v4 仍走 needsUpgrade（不 sanitize、不落盘、不 PUT）；三处白名单/merge max/archive `appContentVersion` 全部自动跟随。
- **动态化**：图鉴 23 卡、容量表、建造/展台/年鉴/建筑档案/关于页数字全部从注册表动态派生，不新增硬编码 18/1985；图鉴锁定剪影与解锁顺序沿用。
- **i18n**：5 座 zh/en 名称进入 `blueprints` 映射；不再新增其他文案。

## 取舍与被否方案

- 否掉一次做 6 座：5 座约 500 块更贴近「每年一批」的轻量节奏，也为逐座配色/contact sheet/真机验收留时间。
- 否掉改既有 18 座几何或色板：AGENTS 铁律与用户资产不可动；只允许追加。
- 否掉新颜色/新材质语言：所有色值必须来自既有批准色板；新座只重组角色。
- 否掉跳号（2→4）或改 schemaVersion：contentVersion 逐包 +1；schemaVersion 只随数据结构变化。

## 影响面

generators/palette/index/manifest、内容与兼容矩阵测试、图鉴/容量动态断言、i18n 名称、README/CHANGELOG、关于页数字（自动）。不改变存档结构、不改变同步/合并语义、不新增依赖。

## 验收标准

1. 新增 5 座蓝图：块数 98/104/92/112/94（合计 500）、坐标唯一、无完全悬空、仅既有积木类型、色值全部属批准色板、每座 ≥3 色且跨 ≥2 家族。
2. 既有 18 座逐块与 HEAD 一致（几何/顺序/块数零改动，仅允许多包追加）。
3. 全量 23 座 / 2485 块；图鉴 23 卡、容量 23、建造/展台/年鉴/档案/关于页数字动态正确。
4. `CONTENT_VERSION=3`：旧 v2 档读入升 3；未来 v4 needsUpgrade 且 raw 不变、同步 0 请求、导入拒绝；merge 取高不写低。
5. tsc 0、npm test 全绿、design:check 通过、Tauri build 成功；四主题 zh/en 图鉴/建造截图。
6. 既有内容测试与兼容矩阵同步更新，不通过改测试放水。

## 变更履历

- 2026-11-11 created (lead)：按 C3 评估建议（5 座 / 约 500 块 / 每年一批）与用户「批准你的所有内容」确认，status=approved，reviewer=LeeCM；本轮实现。
- 2026-11-11 实现（c3-content-v3）：5 座落地 bakery 98 / bookshop 104 / postoffice 92 / firestation 112 / watertower 94（合计 500；全量 23 座 / 2485 块）；生成器拆至 `generatorsV3.ts`（复用 createBlueprintBuilder；generators.ts 671 行零改动）；`BLUEPRINT_COLOR_PLAN` 5 座全部复用既有 24 色板（每座 5–8 色 / 4–5 材质家族 / accent 8.51%–47.96% / 装饰 4–7 处 / 5–10 层）；manifest `CONTENT_VERSION=3` + `city-life-2`(v3, 2026-11-11) + `BASE_PACK_IDS` 同时排除 v2/v3；content/palette/index/blueprints/contentPackKit/contentVersion/GalleryDialog/builds.capacity 测试同步；`.tmp-c3/data-check.mjs` 141 断言 PASS（含旧 18 座逐块与 HEAD 编译产物一致）；定向 8 文件 / 187 例、受影响子集 14 文件 / 278 例全绿；`npx tsc --noEmit` 0 错；浏览器 1452 四主题 × zh/en：图鉴 23 卡、建造新座（bakery 40/98）、展台 11 座、年鉴弹窗均正常且 0 console error。
