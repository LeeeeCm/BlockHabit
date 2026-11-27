---
id: D-20261126-118
date: 2026-11-26
title: 心境可选可自定义：新增心境弹窗、8 个预设、卡片编辑行重排
status: proposed
owner: Claude Code
surface: [today, settings, stats]
axioms: [A1, A2, A4]
files: [src/types.ts, src/components/Icons.tsx, src/components/MoodPickerDialog.tsx, src/components/MoodPickerDialog.test.tsx, src/components/habitrow/HabitReflectionSection.tsx, src/components/HabitRow.tsx, src/components/BlockDropModal.tsx, src/pages/Stats.tsx, src/pages/stats/StatsChronicleView.tsx, src/store/appStore.ts, src/store/appStoreTypes.ts, src/storage/adapter.ts, src/sync/merge.ts, src/components/ui-drop.css, src/i18n/]
supersedes: []
reviewer: pending
---

## 背景与问题

打卡成功后的「心境」只有 4 个固定选项（充实 / 硬啃 / 灵感 / 平静），用户无法表达真实感受，也点不到更贴切的词。同时卡片上的就地编辑行有三个具体毛病（用户标图指出）：

1. 输入框很宽，右边「完成」两个字被挤成竖排（两行）。
2. 星标 ⭐ 单独占右端一格，与左侧胶囊不成体系，也不是倒角方块。
3. 编辑态一旦打开就赖着不走 —— 鼠标移出卡片、点了别处，仍停在编辑态，必须再点一下才复原。

## 设计决定

- **新增心境选择弹窗 `MoodPickerDialog`**：结构与其它弹窗完全一致（桌面 `overlay + .dialog` 宽 420、移动 `BottomSheet`；头部标题 + 关闭、`.dialog-body`、`.dialog-footer`）。内容三段：
  1. **8 个预设**两列等宽倒角方块：原 4 个 + `感恩 / 专注 / 疲惫 / 自豪`；
  2. **自定义心境**：`✦` 图标按钮 + 输入框 + 「用这个」，上限 12 字（超出禁用并提示），实时显示字数；
  3. 底栏「清除心境」+「完成」。
- **数据模型**：`MicroMood` 扩为 8 个联合值；`CheckIn` 新增 `moodNote?: string`（自定义文本），与 `mood` **互斥** —— `recordCheckInNote` 收到非空 `moodNote` 时清掉 `mood`，反之亦然。
- **卡片编辑行重排**（严格按用户标注）：
  - 第一行 `[★][充实][硬啃][灵感][平静][＋]`：★ 收进这一行并**固定在最左**，样式换成与「平静」一致的倒角方块（`.star-toggle-btn` 与 `.micro-mood-chip` 同 padding / 同圆角 / 同高 25px）；原右端的 ★ 位置换成 `＋` 自定义入口。
  - 第二行 `[输入框 ————————][完成]`：输入框 `flex:1`，按钮 `flex:0 0 auto` + `white-space` 正常 → 「完成」不再竖排。
  - 胶囊在卡片内收紧（`padding 3px 6px` / `--fs-caption` / 组间距 5px），330px 宽卡片内实测 ★29 + 胶囊组 223 + ＋29 + 间距 12 = 293 < 298 可用宽度，**正好一行不换行**。
- **复原**：`onMouseLeave` 提到卡片根节点（原先只绑在随笔行），鼠标离开整张卡片即 `cancelNoteEdit()` 回到只读摘要；点卡片外部同样复原。
- **打卡成功弹窗**同步提供 `＋` 入口（预设仍是紧凑的 4 个 + 自定义），保持一致。
- **统计页手账长廊**：有 `moodNote` 的条目也计入长廊（不再要求必须有 `note`），心境胶囊用 `IconMoodCustom` + 自定义文本展示，筛选 / 搜索 / Markdown 导出都按同一口径。
- **同步与存档**：`merge.ts` 把 `moodNote` 按「笔记」同口径合并（非空胜出）；`isValidCheckInElement` 校验其为字符串且 trim 后 ≤ 12 字（超长视为损坏，不静默截断）。
- 新图标 `IconMoodGrateful / IconMoodFocused / IconMoodTired / IconMoodProud / IconMoodCustom` 全部为 24 网格圆头线条、`currentColor`，**不新增色相**（有测试断言所有 svg 的 fill 为空/none/已批准色）。

## 取舍与被否方案

- **否掉「把 8 个预设全塞进卡片」**：卡片一行放不下 8 个胶囊，且会让已完成卡片变重；卡片保留最常用的 4 个，其余走弹窗。
- **否掉自由取色给心境胶囊**：A1 只允许黑白灰 + 唯一琥珀；自定义心境仍用琥珀 12% 底，而不是让用户选颜色。
- **否掉把自定义文本存进 `note`**：`note` 在长廊、导出、奠基铭言候选里都当「随笔」处理，混入心境会污染语义；独立字段更诚实。
- **否掉心境与自定义文本并存**：会出现「⚡充实 · 有点累」这种自相矛盾的展示；改为互斥，写入时清另一边。
- **否掉用 `onBlur` 复原编辑态**：点胶囊按钮会先触发输入框 blur，导致编辑态提前塌掉、点不到；改用卡片级 `onMouseLeave`（鼠标离开才是用户「不在这里了」的真实信号）。
- **否掉给「用这个」在 12 字上限上做静默截断**：用户会以为自己的话被完整保存；改为超限禁用 + 明确提示。

## 影响面

- 存档：新增可选字段 `moodNote`，`schemaVersion` 不变（2）；旧存档无该字段照常读取。
- 同步：合并规则新增一条，老客户端收到带 `moodNote` 的档案会忽略该字段（不破坏校验）。
- 界面走查：今日卡片只读/编辑两态、打卡成功弹窗、统计页长廊（含筛选与导出）、四主题下的胶囊与 ★/＋。
- 测试：新增 `MoodPickerDialog.test.tsx`（6 例：8 预设、点选回调、自定义 trim、超限禁用、清除、图标不引入新色相）。

## 验收标准

- 卡片编辑态第一行为 `★ 充实 硬啃 灵感 平静 ＋` 且**不换行**（330px 宽卡片）；第二行「完成」单行显示、不竖排。
- `＋` 打开的心境弹窗与其它弹窗同构；选预设写 `mood` 且清 `moodNote`，写自定义则相反。
- 鼠标移出卡片即回到只读摘要；不需要额外点击。
- 自定义心境在卡片与长廊都以「✦ + 文本」呈现；搜索/筛选/导出包含它。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按用户标图重排卡片编辑行并新增心境弹窗。
- 2026-11-26 verified（Claude Code）：CDP 实测编辑行单行不换行（★29 + 胶囊 223 + ＋29）、自定义文本落盘为 `moodNote` 且 `mood` 为空、鼠标移出卡片回到摘要；新增 6 例测试。
