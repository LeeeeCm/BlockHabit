# C3 评估：内容包 v3 发布方案（不生产内容）

- 日期：2026-11-11
- 评估者：b6-release-docs（task-5）
- 性质：**评估与脚手架方案**。本轮**不生产任何蓝图数据、不改 `CONTENT_VERSION`、不改 `generators.ts`**；只给出下一批内容包的可选主题/规模/节奏、需要改动的文件与接口、发布门禁与兼容矩阵要求、以及待人类确认的决策清单。
- 基线：`CONTENT_VERSION = 2`，18 座蓝图 / 1985 块（基础 12 座 1385 + 内容包 v2 600）。

---

## 1. 结论摘要

| 项 | 建议 |
| --- | --- |
| 下一批规模 | **4–6 座，每座 80–120 块，整包 400–600 块**（与 AboutPanel 已承诺的"每年 4–6 座、约 400–600 块"一致） |
| 节奏 | **每年一批**，随大版本（如 0.3.0）免费更新；不拆成多批小包，避免频繁升 `contentVersion` |
| 主题 | 「城市与生活」续章：街角面包房 / 旧书店 / 邮政所 / 消防站 / 水塔（5 座，备选：剧院、钟表铺） |
| 前置 | **先有 approved 设计记录**（内容包 v3 主题 + 逐座配色），再动 `generators.ts`；建筑数据是设计性资产（AGENTS §2） |
| 兼容 | `contentVersion` 只 +1（2→3），`schemaVersion` 不变；旧客户端必须走 `needsUpgrade` 而不是清洗未知蓝图 |
| 风险点 | `manifest.ts` 的 `BASE_PACK_IDS` 推导会把 v3 误算进基础包；`content.test.ts` 与 `GalleryDialog.test.tsx` 有硬编码 18/1985 断言，必须同步泛化 |

---

## 2. 现状基线（读代码确认）

| 事实 | 位置 |
| --- | --- |
| `CONTENT_VERSION = 2` | `src/logic/blueprints/manifest.ts:15` |
| 内容包 manifest：`base`(v1, 12 座) + `city-life`(v2, 6 座) | `src/logic/blueprints/manifest.ts:25-51` |
| 基础包 id 由"order 中排除 v2 追加"推导（不硬编码 12） | `src/logic/blueprints/manifest.ts:35` |
| 注册表：18 个 `makeXBlueprint()` 实例 + `blueprintOrder` + `blueprints` 映射 | `src/logic/blueprints/index.ts:23-84` |
| 生成器 API：`createBlueprintBuilder().put/fill/build(id, cx, cy)`；build 自动按 z 再按中心距离排序 | `src/logic/blueprints/generators.ts:12-49` |
| 材质调色板 + 逐座配色计划（`APPROVED_BLUEPRINT_COLORS` / `BLUEPRINT_COLOR_PLAN`） | `src/logic/blueprints/palette.ts:10-141` |
| 蓝图名 i18n 映射（zh/en 各 18 个键） | `src/i18n/locales/zh.ts:490-509`、`src/i18n/locales/en.ts` 对应段落 |
| 权威块数断言：基础 12 座 1385；v2 6 座 600；全量 1985 | `src/logic/blueprints/content.test.ts:46-70,210-218` |
| 内容版本门测试（旧档补写、未来档 needsUpgrade、导入/同步拒绝、merge max） | `src/storage/contentVersion.test.ts` |
| 图鉴解锁、容量、展台、年鉴、建筑档案均已动态派生 | `src/logic/builds.ts`（容量）、`src/components/GalleryDialog.tsx`（遍历 order）等 |
| README「内容上限」写死 18 座/1985 块 | `README.md:35` |

---

## 3. 下一批内容包建议（不生产内容，仅方案）

### 3.1 规模与节奏

- **每座 80–120 块**（v2 实际 83–119；v2 测试门槛 40–120，建议 v3 收紧到 80–120，避免"小装饰件"稀释建造体验）。
- **整包 4–6 座 / 400–600 块**：与 AboutPanel 已上线的公开承诺一致（`src/components/AboutPanel.tsx` + `t.settings.aboutPaceBody`："计划每年追加一批（4–6 座，约 400–600 块）"）。
- **节奏**：每年一批，随应用大版本免费发布；内容与安装包内置（不联网下载），与现有"扩展包随安装包内置、免费"一致。
- 推荐 **5 座**：总量约 500 块，比 v2 的 6 座更轻，给逐座配色/contact sheet/真机验收留出时间。

### 3.2 可选主题（候选，需人类拍板）

主题选择原则：① 不重复既有 18 座主题；② 能用现有七族材质色（石/浅/木土/暖光/冷光/生命/信号）表达识别色；③ 体量能落在 80–120 块；④ 与"城市与生活"叙事连贯。

| # | id 建议 | 中文名 | English | 材质母题（角色→家族，**不指定新 hex**） | 建议块数 |
| --- | --- | --- | --- | --- | --- |
| 1 | `bakery` | 街角面包房 | Corner Bakery | 砖墙/木门（earth）+ 暖窗/招牌（warm）+ 浅色台面（light） | 90–110 |
| 2 | `bookshop` | 旧书店 | Old Bookshop | 木构/砖（earth）+ 浅色墙（light）+ 暖窗（warm） | 85–105 |
| 3 | `postoffice` | 邮政所 | Post Office | 石基/柱（stone）+ 浅色墙（light）+ 暖灯（warm） | 90–110 |
| 4 | `firestation` | 消防站 | Fire Station | 石/灰墙（stone）+ 木门（earth）+ **极小面积**信号红（signal，仅门/警灯） | 100–120 |
| 5 | `watertower` | 水塔 | Water Tower | 石/金属（stone）+ 浅色罐体（light）+ 冷光（cool，小面积） | 80–100 |
| 备选 | `theatre` / `clockmaker` | 剧院 / 钟表铺 | Theatre / Clockmaker | 木土+暖光 / 木土+黄铜 | 90–120 |

约束（沿用 D-067）：每座 ≥3 个颜色角色、跨 ≥2 材质家族、非中性 accent ≥8%、不新增色相、不加渐变/发光；信号红只做极小面积（参考火箭红翼 17.8% 的上限口径，消防站建议 <10%）。

### 3.3 不建议的方向

- **不加蓝图、改做"装饰包"**：容量/建造页/图鉴都不参与，价值与可发现性弱，且需要另一套设计记录与数据结构，不建议本轮做。
- **超过 6 座/600 块**：单批内容过多会让 contact sheet、逐座配色、真机验收、兼容矩阵成本线性上升，且用户消化不完。
- **运行时下载内容包**：违背"扩展包随安装包内置"的既有承诺，且引入签名/端点问题（见 C4 文档）。

---

## 4. 脚手架需要改哪里（文件 + 接口）

> **2026-11-11 续作**：本轮已交付「校验/规划」脚手架 `src/logic/blueprints/contentPackKit.ts` —— `validateContentPackDraft`（id 唯一、version=nextContentVersion、蓝图必须追加、座数 4–6、每座 80–120 块、整包 400–600 块，规则可覆盖）、`planAppendedOrder` / `packBlockCount` / `existingPackBlueprintIds` / `nextContentVersion`；`contentPackKit.test.ts` 12 例（用合成注册表，不新增任何建筑数据）。**仍未生产内容、未改 CONTENT_VERSION、未改 generators.ts**；确认主题/规模后按本节清单实施。

> 顺序：设计记录 approved → `generators.ts` → `palette.ts` → `index.ts` → `manifest.ts` → i18n（Lead）→ 测试/文档。以下为实施清单，本轮**未改**。

### 4.1 `src/logic/blueprints/manifest.ts`

- `CONTENT_VERSION` 2 → **3**（只 +1，不升 `schemaVersion`）。
- 新增 `CONTENT_PACK_V3_IDS`（5 个 id，顺序即解锁顺序，追加在 v2 之后）。
- `CONTENT_PACKS` 追加 `{ id: 'district', version: 3, releasedAt: 'YYYY-MM-DD', blueprintIds: [...CONTENT_PACK_V3_IDS] }`（id 名称需人类确认）。
- **必须修 `BASE_PACK_IDS` 推导**：当前是 `blueprintOrder.filter((id) => !CONTENT_PACK_V2_IDS.includes(id))`——v3 加入后会把新座算进基础包，导致 manifest 语义错误。改为显式基础 id 列表，或 `filter(id => ![...CONTENT_PACK_V2_IDS, ...CONTENT_PACK_V3_IDS].includes(id))`。
- `normalizeContentVersion` / `isFutureContentVersion` 无需改（自动跟随 `CONTENT_VERSION`）。

### 4.2 `src/logic/blueprints/generators.ts`

- 新增 `export function makeBakeryBlueprint(): Blueprint` 等 5 个函数，使用 `createBlueprintBuilder()` 的 `put/fill/build`。
- 颜色只能用 `APPROVED_BLUEPRINT_COLORS`（`palette.ts`）里的值；**不得新增 hex**（新增色相需单独设计记录 + 人类批准）。
- 每座约束：块数 80–120、坐标唯一、`z` 非递减（`build` 自动排序，但生成时按层写更清晰）、装饰（window/gate）≤8、无完全悬空块、几何能支撑（不出现浮空方块）。

### 4.3 `src/logic/blueprints/index.ts`

- import 5 个新 `makeXBlueprint`，实例化（`export const bakeryBlueprint = ...`）。
- `blueprintOrder` 末尾追加 5 个 id（v3 顺序）。
- `blueprints` 映射追加 5 项。
- 不改变既有 18 项的顺序与对象。

### 4.4 `src/logic/blueprints/palette.ts`

- `BLUEPRINT_COLOR_PLAN` 追加 5 条：`roles`（角色→色值，测试会验证每个色值实际出现）、可选 `minRatio` / `minAccentRatio`（参考同类模型，如城堡 0.2/0.08、工厂 0.25/0.45）。
- 不新增 `MATERIAL_FAMILIES` 色值（若确实需要，另立记录并人类批准）。

### 4.5 i18n（**Lead 独占写入**，需提前给 key）

需要新增 5 个 `blueprints` 键（zh/en 各一），建议：

| key | zh | en |
| --- | --- | --- |
| `blueprints.bakery` | 街角面包房 | Corner Bakery |
| `blueprints.bookshop` | 旧书店 | Old Bookshop |
| `blueprints.postoffice` | 邮政所 | Post Office |
| `blueprints.firestation` | 消防站 | Fire Station |
| `blueprints.watertower` | 水塔 | Water Tower |

> 按本任务规则，i18n 三个文件由 Lead 独占；实施时先 send_message 给 Lead，等 key 加好再用。

### 4.6 测试与文档

| 文件 | 需要的改动 |
| --- | --- |
| `src/logic/blueprints/content.test.ts` | `CONTENT_VERSION` 断言 2→3；新增 `V3_BLOCK_COUNTS`；pack 并集/顺序断言包含 v3；`blueprintOrder.slice(12)` 改为 `slice(12, 18)` 并新增 v3 追加断言；每座结构测试复用 v2 模式（块数/唯一/无悬空/排序/装饰/颜色/名称）；总块数/全量总数断言更新（1985 → 新总数）；"全部 18 座"文案改为动态或新总数 |
| `src/components/GalleryDialog.test.tsx` | 硬编码 18 的断言（第 111–133 行：13 座落成后锁 4 张、endgame 18 座）必须改为按 `blueprintOrder.length` 派生，否则 v3 一加就红 |
| `src/components/AboutPanel.test.tsx` | 已断言"数量动态、无硬编码 18/1985"——预计无需改，但需跑一遍确认 |
| `src/storage/contentVersion.test.ts` | 全部用 `CONTENT_VERSION` 动态值，预计无需改；需补一条 v3 场景（旧 v2 档读入后补写 3） |
| `README.md:35` | 更新"内容上限"数字与座数（18→23、1985→新总数） |
| `CHANGELOG.md` | 新增 v3 内容包小节与验证结果 |
| `src/components/AboutPanel.tsx` | 已动态计算座数/块数/contentVersion，无需改 |

### 4.7 设计记录（前置）

- 新增一条 approved 设计记录：内容包 v3「主题 + 座数 + 逐座材质角色」，参照 `D-20261110-063`（内容包）与 `D-20261111-067`（逐座配色）的写法。
- 记录必须先 approved 再写 `generators.ts`（"记录先于代码"）；本评估文档**不代替**设计记录。

---

## 5. 发布门禁与兼容矩阵要求

### 5.1 发布门禁（全部通过才可发）

1. 设计记录 approved（v3 主题/座数/配色）。
2. `npx tsc --noEmit` 0 错误。
3. `npm test` 全绿（含新增/更新的内容测试）。
4. `npm run format:check` 通过；`npm run design:check` 通过（新记录已登记）。
5. `npm run tauri build -- --no-bundle`（或完整出包）成功。
6. 逐座 contact sheet 四主题 × zh/en 检查（沿用 D-067 流程）。
7. 独立验证（verifier）PASS，P0/P1/P2=0。

### 5.2 数据兼容矩阵（必须逐条测试）

| 场景 | 期望 | 依据/现有测试 |
| --- | --- | --- |
| 旧档无 `contentVersion` | 按 1 加载，保存补写 3 | `contentVersion.test.ts`（动态） |
| v2 档（显式 2） | 正常加载，保存补写 3 | `contentVersion.test.ts` |
| **v2 客户端 × v3 存档** | `needsUpgrade`：不 sanitize、原始字节不变、不落盘、同步 PUT=0、导入拒绝 | `contentVersion.test.ts`（future = CONTENT_VERSION+1） |
| v3 客户端 × v2 存档 | 正常加载并补写 3 | 需补用例 |
| 双端 merge | `contentVersion` 取较高值，不被旧端写低 | `contentVersion.test.ts` |
| 导出/导入/同步白名单 | 三处均含 `contentVersion`（复用唯一 `serializeState`） | `src/store/serializeState.ts` 相关测试 |
| 档案包 manifest | `appContentVersion` / `archiveFormatVersion` 语义正确（B3 任务） | `src/storage/archive.ts` / B3 改动 |
| 旧 18 座零改动 | 几何/块数/顺序/颜色逐座与 HEAD 一致 | `content.test.ts`（BASE/V2 权威块数） |
| 解锁顺序 | v2 全部落成后才解锁 v3 第一座；未完成 v2 的用户看不到/选不了 v3 | `content.test.ts` 解锁测试（需新增 v3 场景） |
| 动态派生 | 图鉴总数/容量/展台/年鉴/建筑档案随注册表自动变化 | 现有测试 + AboutPanel 测试 |

### 5.3 回归矩阵（用户可见）

- 四主题（light/dark/oat/fog）× zh/en：建造页、图鉴（含锁定剪影）、展台、统计、年鉴、建筑档案。
- 建造页：新座解锁提示、进度/容量、落成仪式、下一座跳转。
- 数据诚实：未落成不显示落成日；旧档缺日期显示"不可考"；完成态只由 `habitMetOnDay`/容量判定。

---

## 6. 待人类确认的决策清单

- [ ] 下一批座数（建议 5）与主题/命名（§3.2 候选是否采用）。
- [ ] 内容包 id（建议 `district`）与 `releasedAt`。
- [ ] 每座块数预算（建议 80–120）与整包总量（建议 400–600）。
- [ ] 是否沿用 D-067 材质调色板（不新增色相）——建议是。
- [ ] 发布节奏：是否随 0.3.0 一次性发布、是否每年一批。
- [ ] i18n 名称定稿（zh/en），由 Lead 写入。
- [ ] 是否需要先补 updater（C4）再发内容包——建议"应用更新通道就绪后再升 contentVersion"，否则旧设备只能靠 `needsUpgrade` 保护、同步会暂停。
- [ ] 设计记录由谁写、谁审（记录先于代码）。

---

## 7. 依据文件

`src/logic/blueprints/manifest.ts`、`src/logic/blueprints/index.ts`、`src/logic/blueprints/generators.ts`、`src/logic/blueprints/palette.ts`、`src/logic/blueprints/content.test.ts`、`src/storage/contentVersion.test.ts`、`src/components/GalleryDialog.tsx` / `.test.tsx`、`src/components/AboutPanel.tsx` / `.test.tsx`、`src/i18n/locales/zh.ts` / `en.ts`、`README.md:35`、`design/records/D-20261110-063-content-pack.md`、`design/records/D-20261111-067-blueprint-color-system.md`。