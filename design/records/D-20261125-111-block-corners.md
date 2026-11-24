---
id: D-20261125-111
date: 2026-11-25
title: 退役全圆胶囊，按钮与徽章统一为倒角方块
status: proposed
owner: Claude Code
surface: [global, today, build, stats, settings, gallery, mini-widget]
axioms: [A2, A4]
files: [src/theme.css, design/TOKENS.md, src/components/ui-cards.css, src/components/ui-drop.css, src/components/ui-misc.css, src/components/ui-overlay.css, src/components/ArchiveDataPanel.tsx, src/components/BlockDropModal.tsx, src/components/BottomTabBar.tsx, src/components/BrickInspectPopover.tsx, src/components/BuildingArchiveModal.tsx, src/components/EveningNudgeConsent.tsx, src/components/ErrorBoundary.tsx, src/components/GuideTip.tsx, src/components/HabitDialog.tsx, src/components/habitrow/HabitReflectionSection.tsx, src/components/habitrow/HabitRowFooter.tsx, src/components/MemorabiliaDialog.tsx, src/components/TodayBrief.tsx, src/pages/Build.tsx, src/pages/stats/StatsChronicleView.tsx, src/pages/today/TodayEmptyState.tsx, src/pages/today/TodayFullDayCard.tsx, src/components/ErrorBoundary.test.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

用户指出：全站按钮、徽章、标签大量使用 `999px` 全圆角，视觉上呈「圆柱/胶囊」，与 A2「一切都是积木、圆润几何」的方块语言不一致；参考图是今日简报的「开始第一个」主按钮。要求把所有如图的圆柱改为倒角圆滑方块。

## 设计决定

- 新增最小倒角档 `--r-xs: 6px`，用于高度 ≤ 28px 的小徽章、标签、状态胶囊与线状指示器；`--r-sm: 10px` 用于标准按钮与分段项；`--r-md: 14px` 用于 toast、分段控制器外框、建造页旋转工具条等较大浮层。
- 全站清除 UI 控件上的 `borderRadius: 999` 内联值，以及 CSS 中的 `var(--r-pill)` 引用，按上述三档替换。
- `--r-pill: 999px` 令牌保留在 `src/theme.css`（design 资产不删除），但不再被任何界面控件使用；`TOKENS.md` §2 标注退役。
- 圆形 `50%` 图标按钮（弹窗关闭、底部 tab 活动点等）不属于「如图的圆柱」控件，保持圆形。
- 高度仅 2.5–6px 的线状进度条/指示条改引用 `--r-xs`，因半径大于半高，渲染结果与原来一致。

## 取舍与被否方案

- 否掉「只改主按钮」：用户明确说「所有的如图的圆柱」，只改 CTA 会留下大量同形胶囊。
- 否掉「把 `--r-pill` 的值直接改成 10px」：令牌名与语义会变成谎言，后续无法判断该用哪个档。
- 否掉「全站统一 10px」：小徽章高度约 20–24px，10px 半径仍接近胶囊，达不到「倒角方块」的观感。
- 否掉新增第二个胶囊令牌：本轮目的就是退役胶囊，不再扩张该形态。

## 影响面

- 令牌：`src/theme.css` 新增 `--r-xs`；`design/TOKENS.md` 圆角表与退役说明。
- 组件：26 个 TSX/CSS 文件的圆角值；仅改形状，不改颜色、字号、间距与布局。
- 测试：`ErrorBoundary.test.tsx` 的圆角断言从 `--r-pill` 改为 `--r-sm`。
- 需人工走查：今日简报主按钮、习惯卡状态徽章、分类 chip、设置/弹窗按钮、toast、分段控制器、建造页旋转工具条、导览提示按钮。

## 验收标准

- 全仓 `grep -rn "999px\|borderRadius: 999\|var(--r-pill)" src` 不再命中任何 UI 控件（`theme.css` 的令牌定义与 `TOKENS.md` 的退役说明除外）。
- 主要按钮/徽章在 100% 与 125% 缩放下均呈圆角方块，不再有半圆端头。
- `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check` 通过。

## 变更履历

- 2026-11-25 created（Claude Code），按用户要求将全站胶囊控件改为倒角方块。
