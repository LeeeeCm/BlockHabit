---
id: D-20261125-110
date: 2026-11-25
title: 周频习惯今日打卡即显示完成，卡片频率改为本周完成数/目标
status: proposed
owner: Claude Code
surface: [today, stats]
axioms: [A1, A6]
files: [src/logic/checkin.ts, src/logic/yearbook.ts, src/pages/today/TodayHabitSections.tsx, src/components/HabitRow.tsx, src/components/habitrow/HabitRowHeader.tsx, src/components/habitrow/HabitRowFooter.tsx, src/components/habitrow/HabitFocusSection.tsx, src/components/habitrow/helpers.ts, src/components/habitrow/helpers.test.ts, src/components/HabitRow.focus.test.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/today.ts, src/logic/checkin.test.ts, src/logic/dayclaim.test.ts, src/logic/yearbook.test.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

周频习惯（如每周 3 次）在今日打卡后，`habitMetOnDay` 仍只按「本周累计次数 ≥ 目标」判定；今日卡片又要求「今日有打卡」与「habitMetOnDay」同时成立。结果：今天打卡成功但卡片仍显示未完成，今日简报与顶栏的已完成计数不增加（用户实测 7/8），用户无法确认今天是否打卡成功。

## 设计决定

- 规则层（A6）：周频习惯的「今日达标」改为 `今日有有效打卡 || 本周有效打卡数 ≥ 目标次数`。周配额上限仍由 `canCheckInHabit` 维持，不放开一天多次。
- 今日卡片：`done = habitDoneOnDay`（常规日期与 `habitMetOnDay` 同口径；自定义休息日只有当天主动打卡才显示完成，否则保持「今日免战」并可撤销该笔休息日打卡）。周配额已满后，即使今天没有打卡，卡片在本周剩余日期继续显示完成态。
- 卡片频率文案：周频非计数型习惯显示 `t.today.freqWeeklyProgress(weekCount, times)`，中文「每周 1/3 次」、英文「1/3x / week」；每周计数型（counter）仍用纯频次文案，因为周配额不约束 counter（`canCheckInHabit` 既有语义）。
- 周配额已满但今日无打卡的完成态：状态按钮与底部徽章不弹出撤销确认（今日没有可撤销记录），tooltip 使用新文案「本周已达标 / Weekly goal met」；随笔区仅在今日有打卡时渲染，避免对不存在的打卡写笔记。进行中的专注会话即使因周配额达标而完成，也保留「放弃」入口，不再出现无法取消的会话。
- 计数型习惯无论是否有 `targetValue` 都按「当天累计值 ≥ 有效目标（缺省 1）」判定，避免周频分支把无目标值的计数记录误判为完成。
- 年鉴的索引版达标判定同步加入「当日有打卡」，并改用 `habitActiveOnDay` 参与历史完成率筛选，保持与 `dayCompletionRatio` 的归档口径一致；热图、今日简报、全勤判定随规则函数自动一致。
- 不新增颜色；完成态继续使用既有 `--progress-green` 例外。

## 取舍与被否方案

- 否掉「只改 UI，不动 habitMetOnDay」：会造成卡片显示完成、简报/全勤/热图仍判未完成，违反 A6 单一事实口径。
- 否掉「周频每天可多次打卡」：用户只要求今日成功可见，周配额上限保留。
- 否掉「周配额满后仍要求今日打卡才显示完成」：与用户明确要求的「本周 3 次都成功打卡后一直显示成功」冲突。
- 考虑过给周频新增独立的 `weekDone` 状态字段，否掉：完成状态必须由规则函数从事实推导，不能落库。

## 影响面

- 代码：`src/logic/checkin.ts`、`src/logic/yearbook.ts`、`src/pages/today/TodayHabitSections.tsx`、`src/components/HabitRow.tsx`、`src/components/habitrow/HabitRowHeader.tsx`、`src/components/habitrow/HabitRowFooter.tsx`、i18n 三处。
- 行为：周频习惯今日打卡后，今日简报/顶栏完成数 +1；本周配额满后剩余日期持续完成态；当周全勤判定提前到今日打卡日。
- 测试：checkin / dayclaim / yearbook 增补周频用例；需人工走查今日页周频卡片打卡、撤销、跨天与本周配额满三种状态。

## 验收标准

- 周频 3 次习惯：周一打卡后卡片为完成态，文案「每周 1/3 次」，简报完成数 +1；周二（未打卡、配额未满）恢复未完成；周三、周五打完达到 3/3 后，周六/周日不再打卡也保持完成态。
- 周配额满但今日无打卡时，点击完成态不弹撤销确认；tooltip 为「本周已达标」。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-25 created（Claude Code），按用户反馈修复周频今日打卡不可见。
- 2026-11-25 revised（Claude Code）：复查补正休息日主动打卡可撤销、专注会话取消入口、无目标值 counter 按 1 判定、年鉴归档习惯历史口径，并补对应单测。
