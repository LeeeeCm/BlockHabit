---
id: D-20261127-125
date: 2026-11-27
title: 下线桌宠蓝图与形象切换，图鉴只留建筑，桌宠积木并入在建未完成建筑
status: proposed
owner: Claude Code
surface: [gallery, settings, mini-widget, build]
axioms: [A1, A2, A6]
files: [src/logic/blueprints/index.ts, src/logic/blueprints/manifest.ts, src/logic/blueprint.ts, src/components/GalleryDialog.tsx, src/components/settings/PetSettingsGroup.tsx, src/pet/PetMenuWindow.tsx, src/pet/PetWindow.tsx, src/pet/types.ts, src/render/petGeometry.ts, src/render/petCanvas.ts, src/render/petBlueprint.ts, src/storage/adapter.ts, src/storage/petBlueprintMigration.ts, src/types.ts, src/App.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, src/i18n/locales/en/settings.ts, src/i18n/locales/en.ts, src-tauri/tauri.conf.json, README.md, README.zh-CN.md]
supersedes: [D-20261124-098, D-20261124-107, D-20261126-122, D-20261127-123, D-20261127-124]
reviewer: pending
---

## 背景与问题

用户要求：

1. 模型图鉴只保留建筑模型，删除 `pet-cat` / `pet-bot` 两条桌宠蓝图，也删除图鉴里的「桌宠蓝图」「建筑蓝图」两个二级标题；
2. 桌宠形态只保留积木桌宠，设置页（以及右键面板）里的「形象」选项删除；
3. 已经拼过桌宠蓝图的用户不能丢积木：把这些积木替换/并入当前正在建造、尚未完成的建筑；
4. 桌面快捷方式指向的 `src-tauri/target/release/blockhabit.exe` 需要重新构建，打开就是新版本。

桌宠蓝图在 v4 内容包里是独立支线，能作为 `activeBlueprintId` 建造，也会进入 `builds` / `checkIns.blueprintId` / `dayClaims.blueprintId` / `completedBlueprintIds` / `showcasePlacements`。如果只从注册表删掉蓝图，存档清洗会把宠物积木当未知外键丢弃——直接违背 A6「数据诚实」。因此删除必须带一次数据迁移。

## 设计决定

### 1. 图鉴只保留建筑，不保留二级标题

- `blueprints` 注册表、`blueprintOrder`、内容包 manifest 只保留 23 座主线建筑；`PET_BLUEPRINT_IDS`、`blueprintCatalogIds`、`isPetBlueprintId` 全部删除。
- `GalleryDialog` 删除桌宠分区，也删除「建筑蓝图 / 桌宠蓝图」标题行与数量徽章；弹窗标题「模型图鉴 · 23」保留，卡片网格直接铺满。视觉语言仍是现有的 `.gallery-card` / `BlueprintThumb`，不新增样式。
- 内容版本 `CONTENT_VERSION` 从 4 升到 5；`CONTENT_PACKS` 只登记 v1/v2/v3，v4 桌宠包不再产出。旧 v4 存档仍可读（见迁移），新存档被旧客户端读取时会因版本更高而走 needsUpgrade。
- `generatorsV4.ts` 的建筑数据**不物理删除**：受 AGENTS §2「不可逆操作」约束，先保留为不再注册的历史源文件；本记录登记这次下线。若人类确认要物理删除该文件，另走 `APPROVALS.md`。

### 2. 桌宠只保留积木桌宠

- 删除形象选择：`PET_MODELS` / `petBlueprintId` / `resolvePetModel` / `PetModel` 及 `settings.petSkin`、`settings.petModel` 字段一并移除；旧存档里的 cat/bot 值在读取时直接忽略，不再持久化。
- 设置页删除「形象」字段与解锁提示；右键面板删除同一组按钮，窗口高度从 236×360 收到 236×252（面板只剩大小与自主走动，底边保留 10px 内距，不留空白）。
- `PetWindow` 固定用 `petCanvas.paintPet` 的积木形象；删除 `petBlueprint.ts` 的蓝图拼形路径与猫/机器人两套手写几何，只保留 `BLOCK_BODY`。A2/A3 的积木语言不变：仍是圆角积木、顶面一枚凸点、三面明暗与接触阴影。
- `PetConfig` 删除 `skin` / `unlocked` / `blueprintId` / `completed`，只保留大小、材质色、走动、今日进度。

### 3. 宠物积木迁移到现在未完成的建筑

在存档进入 `normalizeState` 时执行一次 `migrateLegacyPetBlueprints`（本地加载、导入、WebDAV 远端都经过这里）：

- **目标**：若 `activeBlueprintId` 是主线且未完成，就用它；否则取主线顺序中第一座未完成建筑。若还有溢出的积木，继续按主线顺序填后续未完成建筑（每座按容量）。
- **搬运对象**：`pet-cat` / `pet-bot` 的有效积木（未墓碑、index 在旧容量 12/16 内）+ 没有对应 build 行的宠物打卡/全勤事实，按 `placedAt` 排序，每个宠物最多搬它旧容量那么多块。
- **落位**：目标建筑已有块保留原 index；迁移块放进目标蓝图的第一个空槽，因此不会覆盖既有积木，`index` 仍连续可投影。
- **事实同步**：对应 `CheckIn.blueprintId` / `DayClaim.blueprintId` 改成新蓝图；没有落位（所有建筑已完成/容量耗尽）的宠物块只清掉“掉块”关联（保留打卡记录本身），不静默删打卡。
- **完成态与展台**：移除 `completedBlueprintIds` 与 `showcasePlacements` 里的宠物 id；迁移后刚好填满的建筑补进完成列表，并按既有规则找展台空位。
- **`activeBlueprintId`**：原为宠物蓝图时改到目标建筑；全部主线已完成时回落到第一座。
- **不动**：`foundationNotes` 里的宠物键保留（可能含用户铭言，只是不再有入口）；`settings.petColor` 保留。

## 取舍与被否方案

- **否掉「只删注册表、靠 sanitize 丢弃宠物积木」**：会让用户已投入的打卡积木凭空消失，违反 A6；迁移必须把事实层一起搬走，否则下次撤销/同步重建又会出现或丢失。
- **否掉「把宠物积木平均分给所有建筑」**：用户只剩一个明确的在建目标，优先填它最符合直觉；容量不够时按主线后续顺序继续，而不是跳到已完成的建筑。
- **否掉「保留桌宠蓝图但只在图鉴隐藏」**：`activeBlueprintId`、容量、完成态、内容版本都会继续背着两条不可达的蓝图，还是会在存档里制造分叉；本次直接下线整个内容包。
- **否掉「保留 cat/bot 代码但隐藏选项」**：PetConfig 仍会接受 skin，未来一次误传就能把已删除的形态画回来；只保留一条渲染路径更符合“只保留积木桌宠”。
- **否掉「物理删除 `generatorsV4.ts`」**：建筑数据属设计性资产，本次只解除注册；删除需人工审批，避免不可逆。

## 影响面

- 注册表 / 内容版本：`blueprints`、`blueprintOrder`、manifest、图鉴总数、存档门禁、内容包脚手架测试。
- 存档兼容：`KNOWN_BLUEPRINT_IDS` 临时接受两个旧宠物 id 以便迁移；`normalizeState` 末尾迁移后写回的主线数据不再含宠物外键。
- 桌宠：设置页、右键面板、`PetConfig`、`PetWindow` 渲染、`petGeometry` / `petCanvas` / 删除 `petBlueprint`、`tauri.conf.json` 的 pet-menu 高度。
- 文案：中英 i18n 删除 `gallery.buildingsTitle`、`pet.blueprints`、`settings.petSkin*` 与 `blueprints['pet-cat'/'pet-bot']`。
- 文档：README 中英的内容表、图鉴、桌宠、FAQ、内容上限；CHANGELOG 追加本轮条目；ART/SURFACES 的桌宠归属与面板规格同步。
- 交付：重新构建 `src-tauri/target/release/blockhabit.exe`，桌面快捷方式目标不变。

## 验收标准

- 图鉴只有 23 张建筑卡，没有任何二级标题，也不存在 `pet-cat` / `pet-bot` 卡片。
- 设置页与右键面板没有「形象」一组；桌宠只画积木形象；右键面板高度 236×252，底部无多余空白。
- 构造一份含 `pet-cat` 3 块、当前 `plant` 2 块的 v4 存档：加载后 `plant` 有 5 块（index 0..4 连续，无覆盖），宠物 block 的 `CheckIn.blueprintId` 指向 `plant`，`completedBlueprintIds`/`showcasePlacements` 无宠物 id。
- 宠物蓝图是 active 时，迁移后 active 指向第一座未完成主线；容量溢出时继续填入后续未完成建筑。
- v4 存档无需 `needsUpgrade` 即可读取；`contentVersion=6` 的未来存档仍被拒绝。
- `npx tsc --noEmit` 零错误；`npm test` 全绿；`npm run design:check` 与 prettier 通过。
- `npm run tauri build -- --no-bundle` 后，桌面快捷方式指向的 `src-tauri/target/release/blockhabit.exe` 启动为新版本。

## 变更履历

- 2026-11-27 created（Claude Code）。用户要求删除桌宠蓝图与图鉴二级标题、只保留积木桌宠、删除设置里的形象选项、把宠物积木并入在建建筑，并更新桌面快捷方式版本。
- 2026-11-27 登记 `APPROVALS.md` AP-20261127-001（pending）：`generatorsV4.ts` 已解除注册但尚未物理删除，等待人类确认后再执行不可逆删除。
- 2026-11-27 状态说明：D-20261124-098 / D-20261124-107 已是 `approved`，按 `design/README.md §4` 只能由人类改为 `superseded`；两份记录的正文保留，本记录先登记取代关系，待人类审核时一并处理状态。
- 2026-11-27 调整：实机截图确认 236×300 时卡片底部约有 50px 空白，用户要求删除多余空白；面板高度收到 236×252，底边保留 10px 内距，同时同步 README / SURFACES / CHANGELOG。
- 2026-11-27 verified（Claude Code）：
  - 真实本地存档（v4）干跑：`camera` 9 → 12 块，`pet-cat` 的 3 块与 15 条打卡（12 条墓碑）迁移后无宠物外键，`contentVersion` 5，设置中无 `petSkin`；
  - `npx tsc --noEmit` 零错误；`npm test` 130 文件 / 1255 用例全绿；`npm run design:check` 与 `npm run format:check` 通过；
  - `npm run tauri build -- --no-bundle` 成功，`src-tauri/target/release/blockhabit.exe` 已更新（桌面快捷方式目标不变）。
