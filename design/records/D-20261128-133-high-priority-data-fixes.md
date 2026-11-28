---
id: D-20261128-133
date: 2026-11-28
title: 高优先级数据修复：同步墓碑、删除习惯、统计过滤、WebDAV HTTPS 与修复砖上限
status: proposed
owner: Claude Code
surface: [today, stats, settings]
axioms: [A2, A4, A6, A7]
files: [src/types.ts, src/sync/merge.ts, src/sync/webdav.ts, src/sync/useSync.ts, src/sync/types.ts, src/store/appStore.ts, src/store/serializeState.ts, src/store/serializeState.test.ts, src/store/appStoreHelpers.ts, src/storage/adapter.ts, src/pages/Stats.tsx, src/components/WebdavPanel.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/webdav.ts, src/sync/merge.test.ts, src/store/uncheck-preserve.test.ts, src/store/appStore.test.ts, src/pages/Stats.test.tsx, src/sync/useSync.test.ts, design/SURFACES.md]
supersedes: []
reviewer: pending
---

## 背景与问题

本轮全仓审查确认了 6 个高优先级问题：

1. **撤销后同日重新打卡被同步墓碑吞掉**：`mergeCheckIns` 对非 counter 习惯按 `habitId + date` 折叠，`deletedAt` 任一侧非空即胜出。本地 `[旧墓碑, 新打卡]` 合并后新打卡也带墓碑，`rebuildBuilds` 丢掉新积木，完成态/展台落位回退。
2. **统计页/手账/导出未过滤墓碑**：撤销的打卡仍进入统计总次数、累计专注、回声、手账长廊与 Markdown。
3. **删除习惯无墓碑**：`deleteHabit` 物理删本地，远端旧存档在下次同步把习惯、打卡和积木全部复活（D-20261110-003 C17 已知未修）。
4. **删除习惯无条件全量重建积木层**：旧档/外部导入的、无法由事实推导的遗留块会被静默抹掉；且只对账被删习惯自己的蓝图，其他因重建掉块的蓝图不会回退完成态。
5. **WebDAV 同步接受 `http://`**：Basic 认证的密码以 base64 明文过网；诊断路径已拒绝 `insecure-http`，同步路径却没有。
6. **`checkInDay` 落成奖励写死上限 2**：库存 3/4 时完成蓝图会被压回 2，库存 2 时也不 +1，与 `checkIn` 的 `REPAIR_MAX` 漂移。

## 设计决定

### 1. 打卡墓碑按“最后一次事件”比较

- 撤销后重新打卡是合法事实（`appStore.test.ts` 已允许）；墓碑不能无条件胜出。
- 合并同一 `habitId + date` 的记录时：
  - 一方 live、一方墓碑：比较 `live.at` 与 `tombstone.deletedAt`，更晚发生的一方胜出；
  - 双方 live：保留既有本地优先 + 元数据并集；
  - 双方墓碑：保留更晚的 `deletedAt`。
- 选择更晚一方时不再跨撤销边界合并旧元数据，避免把已撤销的随笔/心境带入新打卡。

### 2. 习惯删除墓碑 `deletedHabits?: DeletedHabit[]`

- 新增 `DeletedHabit { id, deletedAt }`；`deleteHabit` 物理删本地习惯/打卡，同时写入/更新墓碑。
- `mergeAppState` 先合并墓碑（同 id 最新删除时间），再过滤双方的习惯与打卡；积木层由过滤后的事实重建。
- 墓碑随 `serializeState` 持久化，随导入/同步校验与清洗；字段可选，schemaVersion 保持 2。
- 已知限制：旧客户端保存时会丢弃该可选字段；新客户端本地仍保留墓碑，但跨版本混用超过一轮后删除语义可能退化。后续如需强门禁再评估 schema 升级。

### 3. 删除习惯走保守积木路径

- 与 `uncheckIn` 同口径：`buildsMatchFacts` 为真才全量重建，否则只移除该习惯的块并压实 index。
- 受影响蓝图改为“删除前后块数发生变化的全部蓝图”，避免重建清掉其他蓝图遗留块后完成态不一致。
- 完成态回退的蓝图继续从所有沙盘撤下。

### 4. 统计只认未墓碑打卡

- `Stats.tsx` 的总次数、累计专注、回声、手账长廊统一加 `!c.deletedAt`，与 `habitMetOnDay` / Today 口径一致。

### 5. WebDAV 显式 http 拒绝

- `isInsecureHttpEndpoint` 识别显式 `http://`；`syncNow` 在发起任何请求前返回 `insecure-http`。
- 裸主机名仍自动补 `https://`；诊断路径行为不变。
- 新增 `syncErrors.insecureHttp` zh/en，明确提示密码明文风险。
- 取舍：局域网 http NAS 将无法同步；这是有意的安全换取舍，用户可改用 https 反向代理/证书。

### 6. `checkInDay` 使用 `REPAIR_MAX`

- 与 `checkIn` 对齐，修复库存被压回 2 的资源丢失；完整落成逻辑去重留待后续重构（记录为冗余项）。

## 影响面

- 代码：同步合并、习惯删除、统计、WebDAV 同步与文案、存档校验/序列化、修复砖。
- 数据：新增可选 `deletedHabits` 字段；旧档无该字段时照常读取。
- 交互：显式 http 同步从“可尝试”变为“立即拒绝并提示 https”；统计不再显示已撤销记录。
- 视觉语言：无颜色、字体、圆角、布局变化。

## 验收标准

1. `merge.test.ts`：撤销后同日重打卡的 live 记录胜出；更晚墓碑仍胜出；删除习惯墓碑过滤远端习惯/打卡/积木。
2. `uncheck-preserve.test.ts`：删除习惯写入墓碑，且保留无关遗留块。
3. `Stats.test.tsx`：手账视图不显示已撤销打卡。
4. `useSync.test.ts`：http 端点在网络请求前返回 `insecure-http`。
5. `appStore.test.ts`：`checkInDay` 落成奖励在库存 3 时到 4，不被压回 2。
6. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「先修高优先级」实施；status=proposed，等待人工审核。
