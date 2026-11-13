---
id: D-20261110-027
date: 2026-11-10
title: 实施 F8：修复积木宽口径（每月 2 块 + 连击 30 天奖励 + 补签窗口 30 天）
status: approved
owner: lead
surface: [stats]
axioms: [A6]
files: [src/logic/repairBricks.ts, src/logic/repairBricks.test.ts, src/store/appStore.ts, src/store/appStore.test.ts, src/sync/merge.ts, src/sync/merge.test.ts, src/storage/adapter.ts, src/pages/Stats.tsx, src/types.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

审计 F8（P2）：修复积木的经济是**三重稀缺**叠出来的，结果「断签兜底」几乎不可用：

| 维度 | 改前 |
| --- | --- |
| 发放 | **只有落成一座建筑**才给 1 块（12 座蓝图 = 整个产品生命周期最多 12 块） |
| 上限 | 持有 **2** 块 |
| 窗口 | 只能补签**过去 7 天** |

一个 30 天的习惯断签 8 天，几乎只能放弃重来 —— 而这正是「长线习惯类产品」最该兜住的场景。

## 设计决定

### 1. 三条规则同时放宽（新经济）
| 规则 | 改后 |
| --- | --- |
| 月度额度 | **每月 2 块**：月初把库存补足到 2（`max(库存, 2)`，不会清掉已有的里程碑奖励） |
| 里程碑奖励 | 习惯连击**每满 30 天**再奖 1 块（与月度额度独立叠加） |
| 落成奖励 | 保留（每落成一座 +1） |
| 持有上限 | **4 块**（2 月度 + 2 里程碑） |
| 补签窗口 | **30 天** |

### 2. 纯函数层 `src/logic/repairBricks.ts`
- `monthKeyOf(date)`：本地月份键 `YYYY-MM`；
- `refreshMonthlyAllowance(count, storedMonth, now)`：幂等结算，返回 `{count, month, granted}`；
- `repairBricksForStreak(count, prev, next)`：跨过几个 30 天整数倍就加几块，封顶 4，**连击回退不扣块**；
- `isWithinRepairWindow(dateKey, todayKey)`：30 天窗口（含边界，未来日期不算）。

### 3. 状态与同步
- `AppState` 新增 `repairBrickMonth?: string`（最近结算月份），随存档/导出/导入一起走；
- `sanitize` 钳制 `repairBricks ∈ [0, 4]`，`repairBrickMonth` 必须匹配 `YYYY-MM`；
- 合并：库存取 `max`（沿用既有语义），**月份键取较晚的一个**（谁的额度结算更近以谁为准）。

### 4. 结算时机（幂等，共 3 处）
应用启动（`initPersistence` 非挂起路径）、进入统计页、以及**每次补签前**。三处都调同一个幂等函数，重复调用不重复发放。

## 取舍与被否方案

1. **否决「用纯派生值计算（不落库）」**：那要按「今月已用几次」重建状态，等于把 `repairBricks` 变成投影；现有存档/同步/合并全都要改，收益只是少一个字段。落一个月份键更简单、可合并、可回滚。
2. **否决「月初直接重置为 2」**：会把连击奖励攒下来的库存清掉，属于「奖励用户又收回」。用 `max(库存, 额度)` 才是加法。
3. **否决「窗口直接放到 90 天」**：30 天与「月份额度」的节奏一致，90 天会让改历史数据的诱惑过大（A6 数据诚实）。
4. **修掉了一条既有测试**：`useRepairBrick consumes a brick` 原来直接塞 `repairBricks: 1` 断言消耗后为 0；新规则下补签前会先补足当月额度（0 → 2 → 消耗 1 = 1）。**这是规则变更导致的必然结果**，处理方式是给夹具补上 `repairBrickMonth: monthKeyOf()`（把「本月额度已结算」这个前置条件写显式），而不是放宽断言。

## 影响面

- 代码：新增纯函数模块 + 15 例单测；`appStore`（结算/奖励/导出）、`merge`、`sanitize`、`Stats` 页、i18n 两种语言。
- 用户可见：统计页徽章文案 `修复积木: n / 4`、tooltip 说明新规则、超窗提示从 7 天改为 30 天；**没有任何布局/配色改动**。
- 数据：旧存档首次启动会被补足到当月额度（一次性 +2），属于设计内行为。

## 验收标准

### 自动化（已通过）
- `src/logic/repairBricks.test.ts` **15 例**：月度补足/幂等/不清里程碑/不超上限/首次运行；里程碑跨 30 天/未跨/多倍/封顶/回退不扣；窗口 30 天边界/超窗/未来/跨月；
- `src/store/appStore.test.ts` 新增 3 例：跨月补签先发额度（0→2→1 且月份键更新）、30 天连击奖励 +1、上限常量为 4；
- `src/sync/merge.test.ts` 新增 2 例：库存取大且月份取近、单侧有月份键时保留；
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **60 文件 / 495 用例全绿**。

### 手动验收（可选）
统计页 → 点热图上 8–30 天前的空格 → 应可直接补签（改前会提示「只能补签 7 天内」）。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
