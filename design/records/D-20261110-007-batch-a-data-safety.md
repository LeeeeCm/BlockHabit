---
id: D-20261110-007
date: 2026-11-10
title: 实施批次 A（数据安全三项 P0）与 B2（counter 刷块）：读档失败态、写盘串行化、蓝图外键校验
status: approved
owner: lead
surface: [settings, today]
axioms: [A6, A7]
files: [src/storage/adapter.ts, src/storage/tauriStorage.ts, src/store/appStore.ts, src/logic/blueprints/index.ts, src/App.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, src/sync/useSync.test.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

`D-20261110-006` 的批次 A 有两条 P0 与一条 P1 属于「一次误判即全量数据丢失 / 永久白屏」，必须先于任何视觉与体验改动落地：

1. **A1** `tauriStorage.load()` 的 catch 把 IO/权限/占用异常统一当成「没有存档」→ `initPersistence` 照常订阅持久化 → 用户第一次交互就把默认空态写回磁盘，**永久覆盖真实存档**。
2. **A2** `save()` 使用固定临时名 `blockhabit.json.tmp`，且 `rename` 失败时**回退直接覆盖主档**（非原子）；`appStore` 的 `lastSavePromise` 是覆盖赋值而非队列，并发两笔写可同时写同一个 tmp → 主档拿到半截 JSON。
3. **A3** `validateState/sanitizeState` 不校验 `activeBlueprintId` / `builds[].blueprintId` / `completedBlueprintIds` 是否是 12 座已知蓝图；非法外键会让 `getBlueprint` 在渲染期抛错 → 整树卸载白屏，且坏档已被 `requestFlushNow` 落盘 → **重启继续白屏（crash loop）**。
4. **B2**（`D-20261110-006` 批次 B）counter 习惯按「跨阈值事件」发块：`达标 → 减一档 → 加回来` 每次重新跨阈值 → 秒级无限刷块，摧毁建造进度与全勤语义。

## 设计决定

### A1 读档失败态（不改视觉，只增加一条提示）
- `LoadResult` 新增 `loadFailed?: boolean` 与 `detail?: string`，与既有 `needsUpgrade` 同构；**「读取失败」与「没有存档」严格分离**。
- `tauriStorage.load()` 拆成「取路径 → exists → readTextFile → JSON.parse → migrate」五段，各自只把**真正的异常**标为 `loadFailed`；JSON 损坏仍走原有「备份 `.corrupt-backup` 后重置」路径（那是确定的损坏，不是读取故障）。
- `localStorage` 适配器同样拆分：`getItem` 抛错 → `loadFailed`；解析/迁移崩溃 → 备份原文 + `loadFailed`。
- `initPersistence` 命中 `loadFailed` 时：置 `hydrated: true, loadFailed: true`，**return 之前不订阅持久化、不注入 flush**；`App.tsx` 用既有 `.toast` 显示 `t.settings.loadFailedToast`（文案 zh/en 同步新增）。**未新增任何颜色/阴影/圆角**。

### A2 写盘串行化 + 唯一临时名
- `tauriStorage.save()`：tmp 名改为 `blockhabit.json.<seq>.tmp`（模块级自增）；`rename` 失败**不再回退直写主档**——该回退是非原子写，可能留下半截 JSON；改为保留 tmp（其中是最新完整状态，便于人工恢复）并抛出，由持久化层置 `saveError` 提示。
- `appStore.persistState()`：引入模块级 `saveChain` 串行队列 + `pendingWrites` 计数。**队列空闲时仍同步发起第一笔写**（保持「关键动作立即落盘」的既有语义与现有测试断言），非空闲时排到队尾。`forceFlush()` 返回整条链 → 托盘退出握手自然等待全部在途写。

### A3 蓝图外键校验 + 渲染层兜底
- `adapter.ts` 引入 `KNOWN_BLUEPRINT_IDS`（来自 `blueprintOrder`）与 `isKnownBlueprintId()`。
- `validateState`（导入/同步，严格）：`activeBlueprintId`、`builds[].blueprintId`、`completedBlueprintIds[*]` 必须是已知蓝图，否则整体拒绝。
- `sanitizeState`（本地载入，宽松）：未知 `activeBlueprintId` **回落到 `blueprintOrder[0]`（plant）**；`completedBlueprintIds` 与 `builds` 过滤掉未知外键——**保留用户的合法数据，不整体丢弃**。
- `getBlueprint()` 不再向渲染层抛错：未知 id 回落 plant 并 `console.warn`（双保险，任何调用路径都不会白屏）。

### B2 counter 掉块判定
```ts
const awardedToday = todayCheckIns.some((c) => Boolean(c.placedBlockId))
const reachedTarget = stepDelta > 0 && prevValue < targetValue && nextValue >= targetValue
const shouldAwardBlock = !isCounter || (!awardedToday && reachedTarget)
```
负增量只改数值、不参与跨阈值判定；「当日已掉过块」是硬上限。

## 取舍与被否方案

1. **否决「读档失败直接用磁盘备份自动恢复」**：备份是「导入前快照」，语义不同；自动覆盖会把错误状态合法化。当前只挂起 + 提示，由用户决定。
2. **否决「rename 失败回退直写」**：这正是 A2 的根因。保留 tmp 而不删，代价是偶发失败时磁盘多一个文件，换取「主档永不被半截写入」。
3. **否决「未知外键整档拒绝（本地载入也严格）」**：会让一次脏数据导致用户所有习惯打不开；宽松清洗 + 回落更符合 A6「数据诚实但可用」。**导入/同步保持严格**（宁可拒绝也不污染本地）。
4. **否决「为了保留旧测试断言而放弃串行化」**：通过 `pendingWrites === 0` 同步发起第一笔写，同时保住既有语义与新增的串行保证。
5. **测试夹具修正**：`src/sync/useSync.test.ts` 原本用假 id `completedBlueprintIds: ['remote-bp']`，在新校验下被正确拒绝。修正夹具为真实 id `castle`（夹具本身从来不是合法数据），**不是**为了让测试变绿而放宽产品代码。

## 影响面

- 代码：`src/storage/adapter.ts`、`src/storage/tauriStorage.ts`、`src/store/appStore.ts`、`src/logic/blueprints/index.ts`、`src/App.tsx`（仅新增一条 toast 分支）、i18n 三处（新增 `loadFailedToast`）、`src/sync/useSync.test.ts`（夹具修正）。
- 用户可见：**仅在一处异常路径新增一条既有样式的 toast**；正常路径的视觉、动效、布局、颜色零变化。
- 数据：不改变 `schemaVersion`、不改变任何持久化字段。
- 行为变化：① 读档异常不再清空数据；② 写盘不再可能并发写同一 tmp；③ 未知蓝图 id 的存档/导入被拒绝或回落；④ counter 不能重复掉块。

## 验收标准

新增回归用例（全部通过）：
- `src/storage/adapter.blueprint.test.ts`（6 例）：validate 拒绝三类未知外键；sanitize 回落 plant 并丢弃脏积木。
- `src/storage/tauriStorage.test.ts`（8 例）：读失败 → `loadFailed`；exists 抛错 → `loadFailed`；JSON 损坏 → 备份且不算读取失败；正常档 → 返回状态；save 用唯一 tmp；并发 save 两个不同 tmp；rename 失败抛出且**绝不直写主档**。
- `src/store/persistence.loadfail.test.ts`（1 例）：读档失败后打卡 → `save` 调用 0 次。
- `src/store/persistence.queue.test.ts`（1 例）：第一笔未落地时第二笔排队（`save` 只被调 1 次），落地后才发起第 2 次。
- `src/store/counter-award.test.ts`（2 例）：达标前不掉块、达标掉 1 块、递减再递增不再掉块。

命令验收：`npx tsc --noEmit` 0 错误；`npx vitest run <上述五个文件>` 18/18 通过；全量 `npm test` 全绿（含 A4 的 ErrorBoundary 用例，见 `D-20261110-008`）。

## 变更履历

- 2026-11-10 created (lead) —— 批次 A 的 A1/A2/A3 与批次 B 的 B2 已实现并通过新增回归用例

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
