---
id: D-20261124-089
date: 2026-11-24
title: 自建一体化下拉选择，替换原生 select
status: proposed
owner: Claude
surface: [stats, gallery, settings]
axioms: [A2, A4]
files: [src/components/SelectMenu.tsx, src/components/SelectMenu.test.tsx, src/components/MemorabiliaDialog.tsx, src/pages/stats/StatsChronicleView.tsx, src/components/ui-base.css]
supersedes: []
reviewer: pending
---

## 背景与问题

纪念品中心的「选择建筑」与统计页手账的「按习惯筛选」使用原生 `<select>`。在 Tauri WebView / Windows 下，展开的选项列表是系统绘制的一块独立灰底浮层，与圆角胶囊触发器完全脱节（用户截图：上方圆角控件 + 下方灰色列表，中间有明显断层），不符合「一切皆是积木」的视觉语法。

## 设计决定

- 新增 `SelectMenu`：按钮触发器 + 紧贴其下的菜单，二者共用一条 1px `--line` 边框；菜单 `top:100%`、`margin-top:-1px`、上圆角 0、下圆角 `--r-sm`，视觉上是一块「向下延伸的积木」，不是分离浮层。
- 触发器沿用现有表单控件尺寸（`padding:5px 8px`、`--r-sm`、`--surface`、`--ink`）；打开时上圆角保留、下圆角归零。
- 菜单 `role="listbox"`，选项 `role="option"` + `aria-selected`；支持 Enter/Space 打开、↑↓ 移动、Home/End、Enter 选择、Esc 关闭、点击外部关闭；触发器 `aria-haspopup="listbox"` / `aria-expanded`。
- 替换两处原生 select：纪念品中心建筑选择、统计页手账习惯筛选。其他表单不使用 select 的保持原样。

## 取舍与被否方案

- 否掉「给原生 select 加 CSS」：展开层由系统绘制，无法控制形状与连接关系。
- 否掉「用弹窗/底部抽屉选建筑」：只是两三个选项，弹窗过重；需要的是就地展开。
- 否掉「引入第三方 combobox 库」：仓库约定不引入 UI 组件库，且需求只是单选。

## 影响面

- 两处调用点替换；新增一个通用组件与键盘/点击测试。
- 无数据、颜色、字号、圆角档位变化；菜单最大高度 240px，超出滚动。

## 验收标准

1. 点击触发器，菜单紧贴控件下沿展开，无断层；再次点击/选择/Esc/点击外部关闭。
2. 键盘 ↑↓/Home/End/Enter 可完成选择，焦点不丢失。
3. 纪念品中心与统计页筛选行为不变；无选中项时显示占位文案。
4. `npx tsc --noEmit`、`npm test`、`npm run format:check` 通过。

## 变更履历

- 2026-11-24 created (Claude)
- 2026-11-24 实现并桌面验收：纪念品中心触发器展开后菜单与控件共用边框、紧贴下沿；选项带选中勾；点击/键盘/外部关闭测试通过。
