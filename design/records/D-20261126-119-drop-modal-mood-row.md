---
id: D-20261126-119
date: 2026-11-26
title: 打卡弹窗心境行铺满（★ 左 / ＋ 右 / 6 个预设），自定义面板叠在弹窗之上
status: proposed
owner: Claude Code
surface: [today]
axioms: [A1, A2, A4]
files: [src/components/BlockDropModal.tsx, src/components/MoodPickerDialog.tsx, src/components/useDialogA11y.ts, src/components/ui-drop.css]
supersedes: []
reviewer: pending
---

## 背景与问题

D-20261126-118 把心境弹窗做出来之后，打卡成功的掉落弹窗（`.drop-modal`）里那一行仍有两个问题（用户截图指出）：

1. **排版没修**：只放了 4 个预设挤在左侧，★ 被甩到最右，中间空出一大片；`+` 又被挤到第二行。整个抽屉看起来像没做完。
2. **自定义面板出现在下面**：点 `+` 打开心境弹窗时，它渲染在掉落弹窗**背后**（`.overlay` 的 `z-index: 50` < `.drop-overlay` 的 `100`），用户只能看到掉落弹窗，以为按钮没反应。

## 设计决定

- **心境行改成「★ + 6 个预设 + ＋」单行**：`grid-template-columns: repeat(6, minmax(0,1fr))`，★ 与 ＋ 各占一列固定在两端，中间六个胶囊等宽铺满 440px 弹窗的可用宽度（402px）。实测六个胶囊 top 坐标只有 1 个不同值 → 确实单行；抽屉高度由 208px 回落到 176px（实测内容 98px）。
- 内联预设取 `QUICK_MOODS`（充实 / 硬啃 / 灵感 / 平静 / 感恩 / 专注）；「疲惫 / 自豪」与自定义文本走 `＋` 弹窗。若已选自定义文本，它作为一个跨列胶囊出现在这一行里，避免「选了看不见」。
- **叠层**：`useDialogA11y` 新增 `layer?: number`，返回一个 `style`；`MoodPickerDialog` 接受同名 prop 并把它铺在 `.overlay` 上。掉落弹窗里以 `layer={110}` 打开，于是它画在 100 之上。不传 `layer` 的既有弹窗完全不受影响（`style` 为 `undefined`）。
- 抽屉 `maxHeight` 从 150 → 176，容纳「单行胶囊 + 输入行」两段内容，不再被裁切。

## 取舍与被否方案

- **否掉「8 个预设 + 两行网格」**（本条记录的第一版）：两行会把抽屉撑到 208px，弹窗整体过高，且下方「进度条」被压到视野边缘；用户也明确要 6 个。六个 + 两端按钮正好一行，信息密度与卡片一致。
- **否掉把自定义入口做成行尾的小文字**：与 ★ 同尺寸的倒角方块更整齐，也和卡片里的 ＋ 完全一致。
- **否掉全局调高 `.overlay` 的 z-index**：那会让普通弹窗盖住掉落弹窗（掉落弹窗是打卡时的主舞台）；只给「弹窗内再弹窗」这一层显式指定叠层，作用面最小。
- **否掉用 `<dialog>` / `showModal` 的顶层机制**：会改变既有弹窗的焦点与遮罩行为，收益不值。

## 影响面

- 代码：`BlockDropModal` 心境行结构、`MoodPickerDialog` 新增 `layer`、`useDialogA11y` 新增 `layer`、`.drop-mood-*` 样式。
- 视觉走查：掉落弹窗在 440px 与窄窗下的单行不折行；嵌套弹窗的遮罩与层级；四主题。
- 无障碍：嵌套弹窗的 Esc 会同时被两层监听（内层先关闭内层、外层随后关闭）——待人工走查确认体感。

## 验收标准

- 掉落弹窗心境行：★ 在最左、＋ 在最右，中间 6 个胶囊等宽且**同一行**（六个元素的 `top` 只有 1 个不同值）。
- 点 ＋ 打开的心境弹窗可见且位于掉落弹窗之上（`.overlay` 计算 `z-index` = 110 > `.drop-overlay` 的 100）。
- 选自定义文本后关闭，该文本作为选中胶囊出现在同一行。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按用户「新增几个心境填满这个宽」+「自定义面板出现在下面不符合逻辑」两条反馈修复。
- 2026-11-26 verified（Claude Code）：CDP 实测六个胶囊单行（distinctRows=1）、抽屉高 98px、嵌套弹窗 z-index 110/100 正确；用户随后要求「显示 6 个，左右各一个星星和 +」，据此收为 6 个并回调抽屉高度。
