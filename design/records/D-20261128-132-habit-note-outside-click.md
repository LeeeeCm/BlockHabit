---
id: D-20261128-132
date: 2026-11-28
title: 打卡随笔编辑只在点击模块外时取消，键盘输入与鼠标移出不再打断
status: proposed
owner: Claude Code
surface: [today]
axioms: [A2, A4, A5]
files: [src/components/HabitRow.tsx, src/components/HabitRow.note.test.tsx, design/SURFACES.md]
supersedes: []
reviewer: pending
---

## 背景与问题

用户反馈：打卡成功后想补一条随笔，点开输入框开始敲键盘时，编辑态会被取消并回到「添加打卡随笔」的默认样子。

代码事实：`HabitRow` 卡片根节点挂了一个 `onMouseLeave`，编辑态下鼠标一旦离开整张卡片就调用 `cancelNoteEdit()`（注释为 D-20261126-118「鼠标离开卡片即复原编辑态」）。这会与「点击输入框后用键盘输入」冲突：指针位置、卡片高度变化或用户把鼠标移开都会在输入过程中取消编辑并清空草稿。

## 设计决定

- 删除卡片根节点的 `onMouseLeave` 取消逻辑。
- 随笔模块外层新增 `reflectionRef`；编辑态下监听 document 的 `pointerdown`（capture）：只有事件目标在该模块之外才 `cancelNoteEdit()`。点击模块内部（输入框、完成、心境 chip、收藏、+）不取消。
- 心境选择弹窗打开期间不把弹窗内点击算作模块外（弹窗是 portal，不在 `reflectionRef` 内）；关闭弹窗后随笔草稿仍保留。
- 键盘输入、鼠标移出卡片、焦点变化均不再取消；`Enter` 仍提交、`Esc` 仍取消（保留显式键盘操作）。
- 交接行为：点击模块外一次先取消编辑，随后该点击仍按原逻辑落到卡片/其它控件（已完成卡片本身没有额外动作）。

## 取舍与被否方案

- **否掉 `onBlur` 取消**：点击心境 chip 或完成按钮时焦点会短暂离开输入框，`onBlur` 会误取消；用户要的是「模块外点击」，不是「焦点离开」。
- **否掉保留 `onMouseLeave`**：它正是本次 bug 的来源；鼠标位置不应决定输入态。
- **否掉只在卡片外点击才取消**：用户明确说「模块外」；卡片内但随笔模块外的点击也应取消。
- **否掉用点击遮罩层**：会改变卡片层级与视觉，只需 document 捕获监听即可。

## 影响面

- 代码：`HabitRow.tsx` 的随笔编辑状态、卡片 `onMouseLeave`、随笔模块 ref 与 document 监听；新增 `HabitRow.note.test.tsx`。
- 交互：今日页已完成卡片的随笔编辑；不影响未完成卡片的打卡、计时与计数逻辑。
- 存档/同步：零改动。

## 验收标准

1. 打开随笔编辑后连续键盘输入，输入值与编辑态保持；鼠标移出卡片也不取消。
2. 点击随笔模块外一次，编辑态取消并恢复摘要/占位文案；点击模块内不取消。
3. 心境弹窗打开、选择、关闭期间随笔草稿不丢失。
4. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户「键盘按下就会取消输入，改为模块外点击一次才取消」提出；status=proposed，等待人类审核。
