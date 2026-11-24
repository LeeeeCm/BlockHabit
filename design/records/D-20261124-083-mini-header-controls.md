---
id: D-20261124-083
date: 2026-11-24
title: 设置收敛：摆件尺寸与置顶移入摆件标题栏
status: superseded
owner: Claude
surface: [mini-widget, settings]
axioms: [A1, A5]
files: [src/components/minidesk/MiniHeader.tsx, src/components/MiniDeskToy.tsx, src/App.tsx, src/components/settings/LabGroup.tsx, src/i18n/locales/zh.ts, src/i18n/locales/en/settings.ts, src/i18n/types.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

D-20261110-059 的三档摆件在设置页占了 3 行（开关 / 尺寸 / 置顶），而尺寸与置顶是「用的时候才调」的窗口级控制。设置面板已有 8 组、30+ 项，摆件相关控制挤在实验室分组里，用户要在「设置 → 实验室 → 展开」三层之后才能改一个窗口属性。

## 设计决定

- 摆件标题栏新增「尺寸」按钮（`IconMiniWidget`）：点击按 口袋 → 标准 → 展台 → 口袋 循环，`aria-label` 带当前档位；沿用现有 `MINI_SIZE_ORDER` 与 App 里 `miniWidgetSize` 的即时窗口副作用。
- 置顶按钮继续留在标题栏（原本就在），设置页删除尺寸与置顶两行，只保留「常驻悬浮挂件」开关 + 一行说明「尺寸与置顶可在摆件标题栏直接调整」。
- 口袋档（220px 宽）隐藏「展开」按钮，保留 尺寸 / 置顶 / 关闭 三个 32px 按钮；展开仍可双击拖拽区完成（既有 `mini.doubleClickHint`）。标准/展台保留 4 个按钮。
- 不新增颜色、圆角、阴影或动画；按钮复用 `.icon-btn` 与既有图标。

## 取舍与被否方案

- 否掉「在 34px 标题栏里放下拉菜单」：窗口 `overflow:hidden` 会裁切弹层，且口袋档没有空间。
- 否掉「缩到 24px 放 4 个按钮」：违反 D-059 的 32px 命中区约定。
- 否掉「尺寸/置顶完全移出设置但不进标题栏」：会让功能失去可发现性。

## 影响面

- 摆件标题栏多一个按钮；设置页少两行；`t.settings.miniControlsHint` 新增中英各一条。
- 现有 `MiniDeskToy.test.tsx` 全部实例补 `onCycleSize`，新增一条「尺寸键触发回调」用例。
- 无数据模型变化；尺寸仍存 `settings.miniWidgetSize`，置顶仍存 `settings.miniWidgetAlwaysOnTop`。

## 验收标准

1. 三档下标题栏按钮不重叠、不裁切；口袋档为 3 个按钮，标准/展台为 4 个。
2. 点击尺寸键按 口袋 → 标准 → 展台 → 口袋 循环，当前档位写入设置并即时改变窗口尺寸。
3. 设置页不再出现尺寸/置顶两行，仍保留开关与说明。
4. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-24 created (Claude)

- 2026-11-24 superseded by D-20261124-088（摆件三档与标题栏尺寸键一并移除）。
