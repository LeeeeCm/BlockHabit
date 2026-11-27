---
id: D-20261126-115
date: 2026-11-26
title: 晚间收尾提醒改为整行布局，时间选择改为 Apple 闹钟式双列循环滚轮
status: superseded
owner: Claude Code
surface: [settings]
axioms: [A2, A4, A5]
files: [src/components/TimeWheelPicker.tsx, src/components/TimeWheelPicker.test.tsx, src/components/settings/PreferencesGroup.tsx, src/components/ui-misc.css, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/reminders.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

用户反馈两点：

1. 「晚间收尾提醒」的控制区宽度没有被用满 —— 开关只有 192px 定宽，右侧的原生 `<input type="time">` 又窄又小，整行右侧空出一大片。
2. 原生时间输入在桌面端要分上下两段点、还要处理 AM/PM 或键盘，交互远不如系统闹钟顺手；希望是「左边 0–24、右边 00–59，都能首尾循环」，并且足够顺滑。

## 设计决定

- **整行布局**：「开启 / 免打扰」分段用 `.seg` + `flex: 1 1 auto` 吃掉剩余宽度，右侧接时间滚轮；两者同属 `.settings-actions` 一行，因此左边界与上方的语言 / 主题分段完全对齐（实测 402 → 741 与 402 → 797 同一左起点）。
- **新增 `TimeWheelPicker`**（`src/components/TimeWheelPicker.tsx`）：
  - 双列，左 0–23 小时、右 00–59 分钟，中间一根 `--ink-2` 冒号；两列都首尾循环。
  - 循环实现：每列内容复制三份（24×3 / 60×3 项），停稳后把位移悄悄搬回中间副本 —— 内容相同所以视觉零跳变，语义上永远能继续往下滚。
  - 3 行可视窗口 + 中心选中带（`.tw-band`：上下各 1px `--line` + `--ink` 3% 底），行高 `--tw-row: 26px` 从 CSS 令牌读取，JS 不再硬编码。
  - **自己驱动位移，不用原生滚动**：实测 WebView2 里原生 `scroll` + `scroll-snap` 会把一格滚轮放大成两行，`preventDefault` 又拦不住 snap 的二次吸附（会回跳）。改成 `translate3d` + rAF：滚轮一格 = 一行（160ms 缓出），拖拽跟手 + 甩动惯性 + 吸附最近一行。
  - 圆柱投影：每帧只给中心 ±3 行写 `rotateX(≤62°)` 与缩放/透明度，远端淡出；位移只作用于 track，行本身不再参与布局重算。
  - 键盘：↑↓ 一行、PageUp/Down 五行、Home/End 跳一整圈；`role="spinbutton"` + `aria-valuenow/valuetext`，禁用时 `tabIndex=-1` + `aria-disabled`。
  - 反馈：每次落行触发 `triggerHaptic('selection')` + `playSnapSound()`，与既有步进器同一套「咔哒」语言。
  - 尊重 `prefers-reduced-motion`：动画时长归零、惯性关闭，行为退化为瞬时落位。
- 开关关闭时滚轮整体 `is-disabled`（0.45 透明度、不可聚焦、不响应滚轮/拖拽），与原来 `<input disabled>` 的可用性一致。
- 只新增两个 i18n 键（`eveningNudge.pickerHour/pickerMinute`），中英齐备。

## 取舍与被否方案

- **否掉原生 `<input type="time">` 美化**：系统控件的外观由 OS 决定，做不出上下循环的滚动感，也无法跨平台一致。
- **否掉原生滚动 + `scroll-snap`（第一版方案）**：CDP 实测一格 notch 走两行、且会出现「滚过去又弹回」的轨迹（`1092 → 1066 → 1092`）。合成器的惯性不受 `preventDefault` 控制，这条路在 WebView2 上不可靠。
- **否掉 5 行窗口**：5 行 × 36px = 182px 高，把设置页这一行撑得比旁边所有行都高，且默认态下滚轮比开关高出一截；3 行 × 26px = 78px 与开关 42px 的视觉体量最接近，滚动感仍然成立。
- **否掉给滚轮加阴影/渐变遮罩**：A4 只允许留白、1px 线と黑白反转表达层级；上下淡出用 `mask-image` 实现，不引入新的阴影档位。
- **否掉把它做成通用组件库里的「时间选择器」**：目前只有这一处需要，先把行为写清楚；将来第二处出现时再抽象 props。
- **保留**分钟以 1 为步长（不是 5）：Apple 闹钟也是逐分钟；用户要「足够顺滑」，逐分钟的滚动距离才是连续的。

## 影响面

- 代码：新增 `TimeWheelPicker.tsx` 与其测试；`PreferencesGroup` 的晚间收尾行；`ui-misc.css` 新增 `.tw*` 样式组。
- 视觉走查：四主题下的滚轮边框 / 选中带 / 冒号；开关开启与关闭（禁用态）两种状态；520px 窄窗口下不横向溢出（实测行宽 394 = 282 + 10 + 102）。
- 存档：只写 `settings.eveningNudgeTime`（"HH:mm"），格式与原先一致，无需迁移。
- 无障碍：两个 spinbutton 各有独立名称；键盘可完成全部操作。

## 验收标准

- 「开启 / 免打扰」+ 滚轮共同占满整行，左右边界与上方语言 / 主题分段一致。
- 滚轮一格 = 一行（CDP 实测 21 → 20 → 19，向上 19 → 20），分钟从 59 继续向下回到 00、从 00 继续向上回到 59。
- 拖拽跟手，松手后吸附到最近一行并且 `aria-valuenow` 与「视觉中心那一行」一致。
- 键盘 ↑↓/PageUp/PageDown/Home/End 可用；`prefers-reduced-motion` 下无动画。
- 开关关闭时滚轮 0.45 透明度且不可交互。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按用户要求把晚间收尾时间改为 Apple 闹钟式循环滚轮。
- 2026-11-26 superseded by D-20261126-117：常驻三行会把设置页撑高，改为常态一行 + 点击浮层展开。
- 2026-11-26 verified（Claude Code）：桌面端实机滚轮逐格（21→20→19、19→20）、拖拽吸附、分钟首尾循环（59→00→59）均通过；四主题与窄窗截图走查；测试含新增 5 例。
