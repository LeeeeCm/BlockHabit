---
id: D-20261124-108
date: 2026-11-24
title: 习惯弹窗「更多设置」与首个选填字段的间距对齐
status: approved
owner: Claude Code
surface: [today]
axioms: [A4]
files: [src/components/HabitDialog.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

习惯新建 / 编辑弹窗把时段、提醒、分类、备注折叠在「更多设置」开关之后。开关按钮没有下外边距，展开后与「时段」字段贴得过近；其它字段之间统一为 `.field` 的 16px 下外边距，视觉节奏不一致。

## 设计决定

- 给「更多设置 / 收起更多设置」开关补 `margin-bottom: 16px`，与 `.field` 的字段间距一致。
- 只改间距，不改按钮高度、圆角、展开/收起逻辑、文案与字段顺序。
- 折叠状态同样保留 16px 底部间距，使底栏上方留白与展开态一致。

## 取舍与被否方案

- **否掉把开关包成 `.field`**：会多出一个空 label 语义与额外结构，且 `.field` 的 7px 内部 gap 不适用于按钮。
- **否掉给弹窗主体加统一 gap**：会影响所有字段与顶栏/底栏的既有间距，范围过大。

## 影响面

- `src/components/HabitDialog.tsx`：仅「更多设置」开关的内联样式。
- 需人工走查：桌面弹窗与移动端 BottomSheet 中的展开 / 折叠两种状态。

## 验收标准

- 展开后「更多设置」与「时段」的垂直间距为 16px，与「时段」到「到点提醒」等字段间距一致。
- 折叠状态底部留白正常；展开/收起行为、字段内容与保存逻辑不变。
- `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户截图对齐选填区间距。
- 2026-11-24 approved（LeeCM），设计记录通过人工审核。
