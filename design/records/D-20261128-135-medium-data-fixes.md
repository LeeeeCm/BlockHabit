---
id: D-20261128-135
date: 2026-11-28
title: 中优先级数据与交互修复：counter 墓碑、嵌套弹窗、快捷键/输入法、统计口径与导入校验
status: proposed
owner: Claude Code
surface: [today, stats, settings]
axioms: [A5, A6, A7]
files: [src/store/appStore.ts, src/store/habitSelectors.ts, src/store/habitSelectors.test.ts, src/store/counter-award.test.ts, src/components/BlockDropModal.tsx, src/components/HabitDialog.tsx, src/components/HabitRow.tsx, src/components/MoodPickerDialog.tsx, src/components/FoundationNoteDialog.tsx, src/components/BuildingArchiveModal.tsx, src/platform/ime.ts, src/platform/ime.test.ts, src/pages/Today.tsx, src/pages/stats/StatsMetricsView.tsx, src/pages/Stats.tsx, src/logic/userScenarios.test.ts, src/storage/adapter.ts, src/storage/adapter.import.test.ts, src/sync/useSync.ts, src-tauri/capabilities/default.json, design/SURFACES.md]
supersedes: []
reviewer: pending
---

## 背景与问题

继续处理审查确认的中优先级问题：

1. **counter 达标把墓碑算进累计**：`checkIn` 的 `todayCheckIns` 未过滤 `deletedAt`，撤销后再打卡会提前掉块，卡片进度与积木不一致。
2. **掉落弹窗内开心境弹窗时父级焦点圈闭未禁用**：Tab 在两个 `useDialogA11y` 之间互抢，Esc 会同时关闭心境弹窗和掉落弹窗。
3. **Ctrl+N 没有弹窗/输入框守卫**：编辑习惯时按 Ctrl+N 会把编辑弹窗切成新建态但仍复用旧表单；在设置/提醒弹窗上也会叠开。
4. **输入法确认候选被当成提交**：`HabitDialog`、`HabitRow`、`MoodPickerDialog`、`BlockDropModal` 的 Enter 处理没有 `isComposing` 守卫。
5. **今日页完成数分母**：分子只数今天该做的习惯，分母却用全部在册习惯，休息日会显示 `1/2` 但全勤卡已出现。
6. **补签入口把墓碑当已打卡**：热图撤销后格子为空且可点，但 `StatsMetricsView` 的 `already` 没过滤 `deletedAt`，点击静默返回；store 实际允许补签。
7. **`moodNote` 未进选择器缓存比较**：只改自定义心境时返回旧 slice，重挂载卡片可能显示旧心境。
8. **导入校验漏字段**：`isValidCheckInElement` 未校验 `note/mood/starred/deletedAt/placedBlockId/blueprintId`，`foundationNotes` 只判断 object；坏 JSON 可在 `.trim()`/`.toLowerCase()` 处崩溃。
9. **仅自定义心境的手账导出 `undefined`**：Markdown 导出无条件写 `item.note`。
10. **401 错误路径误删 keyring 凭据**：`applyError` 调用 `saveWebDavConfig`，密码为空时会 `removeCredential`，把仍有效的旧密码删掉。
11. **备份列表体积恒为 0**：capabilities 缺少 `fs:allow-stat`，`stat` 被权限层拒绝后静默置 0。
12. **测试 wall-clock 断言易误报**：`userScenarios` 用 `<100ms` 证明性能，CI 负载下会红；改为结果/规模断言。

## 设计决定

### 数据与输入

- `counter` 的 `todayCheckIns` 过滤 `!deletedAt`，与 `dayCounterValue`/UI 同口径；新增撤销后重新累计的回归用例。
- 新增 `src/platform/ime.ts` 的 `isImeComposing`，上述四个文本输入在 Enter 提交前先判 `isComposing`/`keyCode 229`；`FoundationNoteDialog`/`BuildingArchiveModal` 的 Ctrl+Enter 同样加守卫。
- `Ctrl+N` 只在没有 `dialogOpen`/`dropModal` 且事件目标不在输入框、文本域、`contenteditable` 时触发。

### 弹窗与统计

- `BlockDropModal` 的 `useDialogA11y` 传 `enabled: !moodPickerOpen`，心境弹窗打开期间父层不再抢 Tab/Esc。
- 今日页头部 `activeCount` 改为 `dueActiveAll.length`，与分子同口径。
- `StatsMetricsView` 的补签 `already` 加 `!c.deletedAt`。
- `habitSelectors` 的 `checkInItemsEqual` 加 `moodNote` 比较；新增只改自定义心境的缓存用例。
- Markdown 导出只在 `item.note?.trim()` 时写心得行，仅心境条目不产生 `undefined`。

### 导入与持久化

- `isValidCheckInElement` 补齐字段类型/日期/外键校验（`mood` 限定 8 个预设，`blueprintId` 走已知蓝图白名单）。
- `foundationNotes` 校验为「已知蓝图 id → string」的 record；`normalizeState` 同步清洗，避免坏值进入 `.trim()`。
- `saveWebDavConfig` 增加 `persistSecret` 参数；`applyError` 只写配置、不碰 keyring，避免 401 路径删除有效密码。
- capabilities 增加 `fs:allow-stat`，恢复备份体积显示；失败仍静默为 0 不阻塞。
- `userScenarios` 的 1200 条记录用例只断言规模与结果，不把 wall-clock 当断言。

## 取舍与被否方案

- **否掉给 counter 单独维护 live 数组**：统一过滤 `deletedAt` 更简单，且与现有 `dayCounterValue` 同源。
- **否掉用 `keydown` 的 `key === 'Process'` 判断输入法**：不同平台/输入法不一致，`isComposing` + 229 是 Chromium/WebView2 的稳定组合。
- **否掉 Ctrl+N 只在 input 上守卫**：设置/提醒弹窗打开时也会叠加，必须同时看弹窗状态。
- **否掉在 `applyError` 里完全不保存配置**：错误状态需要落盘；只跳过 secret 同步即可。
- **否掉把 `foundationNotes` 直接丢弃**：合法旧档仍有铭言；只清洗非法键值。

## 影响面

- 代码：store、组件、i18n 无新增文案、storage、sync、Tauri capabilities。
- 数据：无 schema 变更；导入校验更严格，坏档会被拒绝而不是运行期崩溃。
- 视觉：无颜色/字体/圆角/布局变化；补签与备份体积恢复为可用状态。

## 验收标准

1. counter 撤销后重新累计到目标才掉块；旧实现会提前掉块的用例转为通过。
2. 心境弹窗打开时 Tab 在弹窗内循环，Esc 只关心境；掉落弹窗保持打开。
3. 编辑弹窗/设置弹窗/输入框内按 Ctrl+N 不切新建；空白今日页仍可新建。
4. 中文输入法确认候选不会提交习惯/随笔/心境。
5. 休息日场景今日页头部显示 `1/1`，与全勤卡一致。
6. 撤销后的热图日期可补签；已撤销打卡不导出 `undefined`。
7. 导入 `note:123`、`mood:'bad'`、`foundationNotes:{plant:123}` 被拒绝/清洗。
8. 401 错误路径不删除 keyring 凭据；备份列表显示体积。
9. `npx tsc --noEmit`、`npm test`、`npm run design:check`、Prettier 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「继续修剩余」实施；status=proposed，等待人工审核。
- 2026-11-28 implemented (Claude Code)：counter 墓碑、嵌套弹窗、Ctrl+N、输入法 Enter、今日页分母、补签墓碑、moodNote 缓存、导入校验、Markdown、keyring 错误路径、备份 stat 与 wall-clock 测试均落地；`tsc`、1369 项测试、`design:check`、Prettier 通过，桌面版已重建。
