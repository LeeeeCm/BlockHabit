---
id: D-20261110-036
date: 2026-11-10
title: 实施 D5 遗留清理：瞬时提示统一走 useTransient（修掉「第二次提示被第一次提前清掉」）
status: approved
owner: lead
surface: [today, stats, settings, showcase, gallery]
axioms: [A5]
files: [src/platform/useTransient.ts, src/platform/useTransient.test.tsx, src/App.tsx, src/components/SettingsDialog.tsx, src/components/GalleryDialog.tsx, src/components/MiniDeskToy.tsx, src/components/MonthlyPosterModal.tsx, src/components/PolaroidModal.tsx, src/pages/Stats.tsx, src/pages/Showcase.tsx, src/pages/Today.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D5（`D-20261110-021`）当时把 `setTimeout` 泄漏列为「独立条目」：全仓扫描出 13 个文件有 `setTimeout` 无 `clearTimeout`。本轮逐个读上下文后，发现的**不只是泄漏，还有一个真实的行为 bug**：

```ts
setToast(msg)                                   // 弹提示
setTimeout(() => setToast(null), 2400)          // 2.4s 后清空
```

这段代码在 **10 个组件里被复制了 15 次**，每次都不取消上一笔计时器，于是：
**先弹 A，0.5s 后再弹 B —— A 的计时器会在 2.4s 时把 B 提前清掉**（B 只显示了 1.9s）。用户看到的是「第二个提示一闪而过」。
另外：组件卸载后计时器仍持有 `setState` 引用。

## 设计决定

### 1. 一个 20 行的小 hook 收口全部瞬时提示
`src/platform/useTransient.ts`：
- `show(value, durationMs?)`：先清旧计时器，再设新值、按需起新计时器；
- `durationMs = 0` 表示「常驻不自动消失」（备份成功提示这类需要用户看清的）；
- `show(null)` 立即清空；
- 卸载时 `useEffect` 清理计时器。

### 2. 15 处调用点按原时长迁移（不改任何文案与时间）
| 文件 | 站点 |
| --- | --- |
| App.tsx | 专注完成提示 5200ms、提醒 toast 2400ms |
| SettingsDialog | 同步结果 3000ms、导入 2400ms、备份/诊断 2400ms、打开目录失败 2400ms、备份读取失败 2400ms |
| Stats | 导出 2500ms、补签超窗 2200ms、无积木 2600ms、补签成功/失败 2500ms |
| Today | 打卡提示 2400ms（保留原有 `showToast(text, accent)` 签名） |
| Showcase / GalleryDialog / MiniDeskToy / MonthlyPoster / Polaroid | 各自原有 2400 / 2200 / 1800 / 2500 / 2500ms |

## 取舍与被否方案

1. **否决「把全部 `setTimeout` 都包进 hook」**：剩余的几处是**一次性副作用**而非状态提示——`URL.revokeObjectURL` 回收（diagnostics / errorLog）、HabitRow 的 300ms 按压脉冲、FoundationNoteDialog 的聚焦延迟。它们没有「重叠计时器」问题，硬套 hook 反而增加抽象。已在下方「遗留」逐条说明。
2. **否决「维持各组件内联实现」**：15 处相同模式，修 bug 要改 15 遍，且下一处新提示还会踩同一个坑。
3. **未改任何时长/文案**：本轮只改「由谁管理计时器」，用户看到的内容与节奏完全一致（除重叠场景下第二次提示不再被提前清掉）。

## 影响面

- 代码：新增 hook + 5 例单测；10 个文件、15 处调用点改为 `showToast(x, ms)`。
- 用户可见：**唯一的可见变化是修好了重叠场景**；正常单条提示的时长、位置、样式不变。

## 验收标准

### 自动化（已通过）
- `src/platform/useTransient.test.tsx` **5 例**（fake timers + 真实 React 渲染）：到时自动清空、**连续两次提示时第一条不会提前清掉第二条**（修复点）、时长 0 常驻、show(null) 立即清空、**卸载后计时器数归零**；
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **64 文件 / 515 用例全绿**。

## 遗留（已审计、有意保留）
| 位置 | 原因 |
| --- | --- |
| `diagnostics.ts` / `errorLog.ts` 的 `window.setTimeout(..., 0)` | 仅回收 `URL.revokeObjectURL`，不碰状态，不存在重叠或卸载问题 |
| `HabitRow` 的 300ms 按压脉冲 ×3 | 纯视觉脉冲，卸载后 `setState` 在 React 18 是 no-op；改造成本高于收益 |
| `FoundationNoteDialog` 的聚焦延迟 | 一次性聚焦副作用，与提示状态无关 |
| `BlockDropModal` 的自动关闭 | 已有 `timerRef` + `clearTimeout`，本就正确 |

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
