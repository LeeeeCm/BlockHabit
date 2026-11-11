---
id: D-20261110-009
date: 2026-11-10
title: 实施 A5b/A7（撤销不丢历史块）、A8（投影容量钳制）、A9（删除习惯清理）、A12（补签不得早于创建日）+ F5 部分（CI 门禁）
status: proposed
owner: lead
surface: [build, stats]
axioms: [A6]
files: [src/logic/builds.ts, src/store/appStore.ts, src/pages/Build.tsx, src/pages/Stats.tsx, src/sync/merge.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, .github/workflows/ci.yml]
supersedes: []
reviewer: pending
---

## 背景与问题

批次 A 剩余条目。核心是一条隐藏的数据风险：

- **A5b / A7**：`uncheckIn` 与 `deleteHabit` 都调用 `rebuildBuilds()` **全量重建**积木层。该函数只认「能由打卡/全勤事实推导的块」。但存档里可能存在无法推导的块（v1 旧档迁移、外部导入的存档、历史上被手工修复过的数据）。此时全量重建会把它们**静默抹掉**——用户撤销一次打卡，结果丢掉若干与这次撤销无关的积木。
- **A8**：多端离线各自把同一蓝图建满后合并，事实数会超过蓝图容量，`rebuildBuilds` 不钳制 → `index` 越界，渲染取不到块定义；`Build` 页进度条也会算出 >100%。
- **A9**：`deleteHabit` 只清 `habits/checkIns/builds`，`reminderLog` 与选择器缓存里仍留着该习惯的键。
- **A12**：`useRepairBrick` 允许补签「习惯创建之前」的日期，会造出不存在的连击。
- **F5（部分）**：无 CI，类型检查 / 单元测试 / 设计台账三道门禁全靠人肉跑。

## 设计决定

### A5b/A7 撤销改为「能重建才重建，不能则保守移除」
`logic/builds.ts` 新增两个纯函数：
- `buildsMatchFacts(builds, liveCheckIns, claims, capacities)`：判断当前积木层是否已是事实的等价投影（只比 id + 蓝图归属，不比 index 顺序）。
- `removeBlocksAndCompact(builds, removedIds)`：只删指定块，并在**各自蓝图内**把 index 压实，其余块原样保留。

`uncheckIn` 改为：
```ts
const canRebuild = buildsMatchFacts(builds, liveAfterUncheck, nextClaims)
const removalIds = new Set([...removedBlockIds, ...reclaimedBlockIds])
const nextBuilds = canRebuild
  ? rebuildBuilds(liveAfterUncheck, nextClaims)   // 正常路径：投影重建，index 连续、多端一致
  : removeBlocksAndCompact(builds, removalIds)     // 异常路径：只删本次该删的块，绝不误伤
```
（`reclaimedBlockIds` 是本轮新增：撤销导致当日不再全勤时，被回收的全勤块也纳入移除集。）

### A8 投影容量钳制
- `logic/builds.ts` 新增 `BLUEPRINT_CAPACITY`（12 座蓝图 × 块数，来自 `blueprints`），`rebuildBuilds` 增加第三参 `capacities`（默认即容量表）。
- 组内按时间排序后 `slice(0, capacity)`：超出容量的多余事实**不删打卡**，只是不投影成块。
- `Build.tsx` 进度条改用 `progressRatio = Math.min(1, placedCount / total)`；`placedCount` 原值仍用于「已放置 / 总数」文案。
- `merge.ts` 与 `deleteHabit` 显式传入容量表，语义显式化。

### A9 删除习惯清理
- `deleteHabit` 同时删除 `reminderLog[habitId]` 并调用 `clearHabitSliceCache()`（选择器按 `habitId` 缓存，习惯本体被删后必须失效）。

### A12 补签下限
- `useRepairBrick` 增加「不得早于 `habit.createdAt` 的日期」判定，返回 `reason: 'before-creation'`；`Stats.tsx` 的 reason→文案映射补一条，i18n zh/en/types 三处同步。

### F5（部分）CI 门禁
- 新增 `.github/workflows/ci.yml`：`windows-latest` + Node 22 + `npm ci` → `tsc --noEmit` → `npm test` → `npm run design:check`；`fetch-depth: 0` 保证设计台账的「未审批删除检测」能对照 git 历史。
- 本轮**未做** ESLint/Prettier（会一次性产生大量无关 diff，需单独批次）与发布 workflow（依赖 F6 签名决策）。

## 取舍与被否方案

1. **否决「旧档载入时立即全量重建」**：无法区分「迁移遗漏」与「用户的历史资产」，一旦判断错就是不可逆丢块。改为「只在可证明等价时重建」，把风险窗口压到零。
2. **否决「给 rebuildBuilds 加兜底块」**：会把脏数据永久固化进投影。
3. **否决「容量越界时删掉多余打卡」**：事实层必须保留（否则连击/统计全变），钳制只发生在投影层。
4. **否决「把 `before-creation` 当作 `future` 复用文案」**：两种拒绝原因对用户的操作指引不同，文案必须分开。

## 影响面

- 代码：`logic/builds.ts`（+3 导出）、`store/appStore.ts`（uncheckIn / deleteHabit / useRepairBrick）、`pages/Build.tsx`（进度比例）、`pages/Stats.tsx`（reason 映射）、`sync/merge.ts`（容量入参）、i18n 三处、新增 CI。
- 用户可见：① 撤销打卡不再可能误删历史积木；② 进度条永不超 100%；③ 补签不再允许早于创建日（多一条既有样式的 toast）；④ 删除习惯后不再留下提醒残留。**视觉语言零变化**。
- 数据：不新增字段、不改 `schemaVersion`。

## 验收标准

- `src/logic/builds.capacity.test.ts`（8 例）：容量钳制、12 座容量表覆盖、`buildsMatchFacts` 三类场景、`removeBlocksAndCompact` 单蓝图/多蓝图压实。
- `src/store/uncheck-preserve.test.ts`（3 例）：含无法推导块的存档撤销后**保留遗留块**并压实 index；投影一致时走重建路径；`deleteHabit` 清 `reminderLog`。
- `src/store/appStore.test.ts` 补「补签不得早于创建日」用例（`reason === 'before-creation'` 且不消耗库存）。
- 全量：`npx tsc --noEmit` 0 错误；`npm test` 全绿；`npm run design:check` 通过。

## 变更履历

- 2026-11-10 created (lead)