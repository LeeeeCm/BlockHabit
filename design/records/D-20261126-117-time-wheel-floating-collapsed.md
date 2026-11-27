---
id: D-20261126-117
date: 2026-11-26
title: 时间滚轮常态收成一行、点击后以浮层上下展开，且不推动设置页
status: proposed
owner: Claude Code
surface: [settings]
axioms: [A2, A4, A5]
files: [src/components/TimeWheelPicker.tsx, src/components/TimeWheelPicker.test.tsx, src/components/ui-misc.css]
supersedes: [D-20261126-115]
reviewer: pending
---

## 背景与问题

D-20261126-115（随后一步迭代为「常驻三行 + 点击展开」）把晚间收尾的时间做成了常驻三行的循环滚轮。实机走查后用户提出三点：

1. 常态就占三行高，比旁边「开启 / 免打扰」高出一截，把设置页那一行撑得很空。
2. 期望的节奏是：**平常只有一行**，鼠标点一下才上下各延展一行；滚动滚轮改时间。
3. 往上滚的时候设置页跟着一起滚 —— 时间没调完，页面先跑了；同时缺少「现在焦点在这个控件上」的视觉提示。
4. 补充：上下延展不该占用设置页面的空间，应当是**悬浮**的。

## 设计决定

- **常态一行**：`.tw` 用一份不可见的 `.tw-sizer`（同字号、同内距的 `88:88`）撑出布局尺寸，视觉上只显示当前时间，高度 `--tw-row + 10 = 36px`，与 `.seg`（42px）基本齐平，不再把行撑高。
- **点击展开成浮层**：真正的滚轮放在 `.tw-panel` 里，`position: absolute` 覆盖在占位之上；展开时只改面板的 `top` 与 `height`（36 → 86px，向上向下各长一行），**不参与布局**。实测：`.tw` 高 36、所在行高 42、下一个元素 top 572、`.dialog-body.scrollHeight` 1750 —— 展开前后四个值完全不变。
- **聚焦点**：展开态给 `.tw-panel` 加墨色边框 + 2px 墨色外环 + 一层极软分层阴影（`0 8px 22px ink@12%`）。这是全应用唯一允许的「浮起」表达，仍属 A4 的少量软阴影许可范围，不叠多层。
- **滚动只改时间**：滚轮监听挂在组容器 `.tw` 上并使用 `passive: false` 拦下默认滚动；同时按指针落在哪一列分派给小时 / 分钟。另外展开期间把最近的可滚动祖先临时 `overflow-y: hidden`，收起时原样还原 —— 实测展开后滚 3 格，小时 21→4、`.dialog-body.scrollTop` 保持 0；收起后滚轮恢复（scrollTop 0→85）。
- **收起时机**：点控件外部（document 捕获阶段 pointerdown，父级 `stopPropagation` 也拦不住）/ 再点一次 / `Esc` / 焦点离开整组（120ms 宽限，滚完最后一格不打断）。
- 两列同一时刻展开或收起（`expanded` 由 `TimeWheelPicker` 统一持有），不会出现「左列开了、右列还叠着」的错位。
- 键盘与语义不变：两列仍是 `spinbutton`，↑↓ 一行、PageUp/Down 五行、Home/End 跳一圈。

## 取舍与被否方案

- **否掉「展开时用 `height` 撑开容器」**（D-20261126-115 迭代版的做法）：那会把下方内容整体推下去，滚到边界时还会带动页面滚动 —— 正是用户这次反馈的问题。
- **否掉给弹窗整体加 `overflow: hidden` 来做滚动锁**：会连带锁住用户后续正常浏览设置的滚动，恢复时机也很难把握；只锁展开期间、只锁最近的可滚动祖先，作用面最小。
- **否掉只通过 `preventDefault` 阻止页面滚动**：实测无头 Chromium 的合成滚轮不受其约束；必须再加上祖先 `overflow` 锁定才可靠。
- **否掉把浮层做成「弹出到行下方」**：时间控件在设置页中下部，向下弹会盖住说明文字；以中心行为锚点上下对称展开，视觉重心不动，也不会遮挡。
- **否掉用 portal 把浮层挂到 body**：浮层只需压过同级的说明文字，`z-index: 3` 足够；portal 会带来焦点与 `pointerdown` 外部判断的额外复杂度。

## 影响面

- 代码：`TimeWheelPicker.tsx`（展开态持有、组级滚轮分派、祖先滚动锁、Esc）、`ui-misc.css`（`.tw` 占位、`.tw-panel` 浮层、`.tw-sizer`）。
- 视觉走查：收起 / 展开两种高度、四主题下的边框与阴影、520px 窄窗口不横向溢出。
- 存档：仍只写 `settings.eveningNudgeTime`，格式不变，无迁移。
- 无障碍：浮层展开不影响 tab 顺序（`tw-sizer` 为 `aria-hidden` 且不可聚焦）。

## 验收标准

- 常态 `.tw` 高 36px，与同行的分段按钮视觉齐平；展开后 `.tw` 与所在行的高度、下方元素位置、`.dialog-body.scrollHeight` 均不变化。
- 点击控件展开（面板 36 → 86px，上沿 -25px、下沿 +25px），出现墨色聚焦环；点外部 / Esc / 再次点击均收起。
- 展开期间滚动滚轮只改时间：小时 21 → 4（3 格），`.dialog-body.scrollTop` 恒为 0；收起后页面滚动恢复。
- 键盘 ↑↓ / PageUp / PageDown / Home / End 可用；`prefers-reduced-motion` 下无动画。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按用户三点反馈 + 「展开应悬浮、不占空间」重做交互形态；取代 D-20261126-115 的常驻三行形态。
- 2026-11-26 verified（Claude Code）：CDP 实测展开前后 `.tw` 36px / 行高 42px / 下个元素 top 572px / scrollHeight 1750 全部不变；展开滚动 3 格小时 21→4 且页面 scrollTop 恒 0；收起后页面滚动恢复；新增 4 例测试（收起点击展开、Esc、组级滚轮分派、浮层占位）。
