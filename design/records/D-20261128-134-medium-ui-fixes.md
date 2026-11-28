---
id: D-20261128-134
date: 2026-11-28
title: 中优先级 UI 修复：下拉展开动画、习惯卡归档入口、归档统计保留与全勤块描边
status: proposed
owner: Claude Code
surface: [today, stats, gallery, habit-dialog]
axioms: [A2, A4, A5, A6]
files: [src/components/SelectMenu.tsx, src/components/SelectMenu.test.tsx, src/components/HabitRow.tsx, src/components/HabitRow.archive.test.tsx, src/components/habitrow/HabitRowHeader.tsx, src/components/Icons.tsx, src/components/HabitDialog.tsx, src/pages/Stats.tsx, src/pages/Stats.test.tsx, src/pages/stats/StatsHeader.tsx, src/pages/stats/StatsChronicleView.tsx, src/pages/today/TodayArchiveSection.tsx, src/render/isoCube.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/today.ts, src/i18n/locales/en/stats.ts, src/i18n/locales/en/habitDialog.ts, src/components/ui-drop.css, design/SURFACES.md]
supersedes: []
reviewer: pending
---

## 背景与问题

用户连续反馈 5 个中优先级细节：

1. **纪念品中心的建筑档案下拉没有展开动画**：`SelectMenu` 只在挂载时播放 180ms 的 `select-menu-drop`（透明度 + 4px 位移），列表高度瞬变，和 D-20261127-126 已落地的 `Collapse` 展开语言不一致。
2. **归档入口位置不合理**：归档按钮藏在编辑习惯弹窗底部，用户要在卡片右上角动作组里直接归档，位于编辑与删除之间，图标风格与现有动作一致。
3. **归档后统计页仍要保留该习惯**：指标行、手账长廊与回声继续按全部习惯取数；归档只改变今日页展示，只有删除习惯（连带删除打卡）才让统计卡片消失。用户补充：归档后统计卡片“还是不见了”，因此本次明确保留。
4. **统计页副标出现两个分隔点**：`t.stats.focusHours` 自带前导 ` · `，`StatsHeader` 又拼了一个 ` · `，渲染成 `记录 · · 累计`。
5. **全勤积木上方多出黄色方框**：`isoCube` 对 `bonusTier='attendance'` 画了双环（2.4px + 内缩 1.1px），用户要求全勤块不要上方的黄色方框。
6. **已归档区“恢复”文字多余**：归档行右侧按钮已有图案，保留文字让按钮变宽、与删除按钮不对称；只留图案并补齐 `aria-label`。

## 设计决定

### 1. SelectMenu 展开动画

- 菜单内容包在 `.select-menu-panel`（`display:grid; grid-template-rows:0fr`）中，挂载后下一帧切到 `1fr`，同时透明度 0→1、`translateY(-4px)→0`。
- 参数全部走既有令牌：`--dur-lg`（300ms）+ `--ease-standard`；不加新颜色/阴影/圆角档位。
- 关闭仍立即卸载（与既有测试和交互语义一致），只补展开过程；选项高度 ≤240px，超出滚动。
- `prefers-reduced-motion` 由既有令牌归零兜底，无需新逻辑。

### 2. 归档入口移到习惯卡

- `HabitRowHeader` 动作组顺序改为：置顶 / 编辑 / **归档** / 删除；归档按钮用新增的 `IconArchive`（24 网格、圆头 1.9 描边，与编辑/删除同族）。
- `HabitRow` 直接调用 `archiveHabit(habit.id)` 并 `stopPropagation`；卡片由 Today 的 `!archivedAt` 过滤自然消失。
- 删除 `HabitDialog` 底部的归档按钮、`archiveHabit` selector 与 `habitDialog.archiveBtn` 文案；新增 `today.archiveHabit`。

### 3. 归档后统计保留

- 指标行、手账长廊与回声继续使用 `habits`（全部习惯），不按 `archivedAt` 过滤；归档只影响今日页。
- 手账筛选下拉也列出已归档习惯，保证归档后仍可按名字查找历史。
- 页头「累计深度专注」保持全量历史口径。

### 4. 统计副标分隔点

- 从 zh/en 的 `stats.focusHours` 移除前导 ` · `，分隔符统一由 `StatsHeader` 的 JSX 负责；其他使用点仅此一处。

### 5. 全勤积木描边

- `isoCube` 的奖励描边分支只对 `streak` 画 1.5px 单环；`attendance`（全勤块）不再画上方黄色方框，也不再画内缩第二道环。
- 连击里程碑奖励块保留原有单环；不新增替代标记，不改积木颜色/材质。

### 6. 归档区恢复按钮

- `TodayArchiveSection` 的恢复按钮只保留 `IconRestore`，删除“恢复”文字；按钮保持 16px 图标与既有 `.archive-act` 尺寸，补齐 `aria-label`（删除按钮同样补齐）。

## 取舍与被否方案

- **否掉给 SelectMenu 加关闭动画**：会改变“选择后立即卸载”的既有测试与焦点语义，收益低；本次只解决用户指出的展开生硬。
- **否掉用 `max-height` 补间**：选项少时会出现空白区，选项多时高度不可知；`grid-template-rows` 由浏览器按内容高度补间。
- **否掉在 HabitDialog 保留归档并同时加卡片按钮**：两个入口会让同一动作有两个位置，用户明确要求移动。
- **否掉归档后用 toast 撤销**：归档本身可在「已归档」区恢复，且用户没有要求新增撤销入口；避免扩大范围。
- **否掉把全勤块改为其他颜色/图标**：A1 只允许既有点缀色，用户只要求去掉上方方框。

## 影响面

- 代码：`SelectMenu`、`HabitRow(Header)`、`HabitDialog`、`Stats`/`StatsHeader`、`isoCube`、i18n、CSS。
- 交互：下拉展开 300ms；卡片右上角新增归档动作；归档后手账/回声消失；统计副标单点；全勤块无黄色顶框。
- 数据/同步/schema：零改动。

## 验收标准

1. 点击建筑档案下拉，菜单在约 300ms 内由 0 高度向下展开并淡入；选择/外部点击/Esc 后立即关闭。
2. 习惯卡右上角出现置顶/编辑/归档/删除四个同风格图标，归档后卡片从今日列表移除，编辑弹窗不再有归档按钮。
3. 归档带随笔的习惯后，统计页指标卡、手账条目与回声仍然保留；删除习惯后一并消失。
4. 统计页副标只出现一个 `·`，无 `· ·`。
5. 全勤块顶部不再出现黄色方框；连击奖励块仍保留单环。
6. 已归档区恢复按钮只显示图案，删除按钮与恢复按钮视觉等宽；均有可访问名称。
7. `npx tsc --noEmit`、`npm test`、`npm run design:check`、Prettier 通过。

## 变更履历

- 2026-11-28 created (Claude Code)：按用户连续反馈提出；status=proposed，等待人工审核。
- 2026-11-28 implemented (Claude Code)：SelectMenu 展开补间、卡片归档入口、归档统计保留、副标分隔点、全勤块描边与恢复图标均落地；`tsc`、1362 项测试、`design:check`、Prettier 通过，桌面版已重建。等待人工走查/审核。
