---
id: D-20261110-059
date: 2026-11-10
title: 桌面摆件三档形态（口袋/标准/展台）+ 置顶开关
status: approved
owner: lead
surface: [mini-widget, settings]
axioms: [A2, A4, A5]
files: [src/App.tsx, src/components/MiniDeskToy.tsx, src/components/SettingsDialog.tsx, src/types.ts, src/store/appStore.ts, src/storage/adapter.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, design/SURFACES.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

迷你摆件现在是主窗口被 setSize 到 260×380 的固定形态，置顶固定开启，用户只有开关。尺寸决定它能放在哪：小屏用户嫌大、双屏用户嫌小；固定形态让「桌面展示架」这个差异化只能以一半成立。D-20261110-058 的竞品研究也指出：桌面常驻是真空位，但必须可被用户安放在自己的桌面。

## 设计决定

提供三档逻辑尺寸（含边框）：口袋 220×150（3D 小窗 + 今日进度 + 快捷打卡）、标准 280×400（沿用现有内容密度，默认）、展台 420×560（大 3D + 今日清单 + 下一里程碑）。置顶做成设置；窗口位置存 localStorage（设备本地，不进同步），进入/显示时按当前显示器工作区钳制。三档都保留拖拽、双击展开主窗、关闭收托盘；入口同时来自标题栏摆件按钮与设置页，首次启用展示三档选择。所有尺寸/字号/圆角只用既有令牌，不新增颜色与阴影。详见 docs/superpowers/specs/2026-11-10-blockhabit-innovation-deep-dive.md §3.1。

## 取舍与被否方案

- 否掉固定单一尺寸：见背景。
- 否掉透明/异形/桌面层嵌入：需要额外系统能力与美术资产，且会偏离「积木在桌面上的实体感」。
- 否掉可自由拖拽缩放：会产生四不像布局，三档预设更符合设计系统。
- 否掉把窗口位置写进同步存档：换屏后会跑到看不见的地方；位置属于设备本地状态。

## 影响面

窗口逻辑（setSize/恢复/多显示器钳制）、摆件组件三档布局、设置字段与默认值、adapter.normalizeState、i18n、SURFACES.md 迷你件规格。无渲染层改动。

## 验收标准

三档在 100/125/150% 缩放与双屏下无裁切；口袋可完成快捷打卡；标准显示 3D 与蓝图进度；展台显示今日清单；尺寸/置顶/位置持久化；关闭恢复主窗尺寸；空闲零重绘；四主题与 zh/en 截图；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §1）：置顶默认改为**关**（首次开启时一次性说明会浮在其他窗口前）；新增两条 capability（set-min-size / set-position），进入前显式 setMinSize 再 setSize、退出恢复 900×600，不依赖隐式最小尺寸；手动进入摆件需写回 enableMiniWidget:true（现有代码只在自动进入时判定）；迷你件 24×24 按钮与胶囊命中区提升到 ≥32px；三档布局预算（pocket 30+64+44≤150 等）与位置 localStorage 结构见技术笔记。
- 2026-11-10 实现（lead）：`src/platform/miniWindow.ts`（presets / clamp / layout，4 tests）、App.tsx（显式 setMinSize→setSize、位置钳制、退出恢复主窗尺寸与位置、置顶/尺寸即时生效、浏览器按预设居中预览）、MiniDeskToy 三档布局与 32px 命中、设置页尺寸/置顶 seg、capabilities 2 条；`miniWindow.test.ts` / `MiniDeskToy.test.tsx` 通过，Tauri release 构建通过。真窗口 100/125/150% 缩放与双屏为人工验收项（headless 无法验证）。
- 2026-11-10 独立验证修复（verifier P2）：快捷打卡胶囊与展台清单行提升到 32px 命中区，preset footer 预算按真实内容修正（pocket 72 / standard 124 / display 170）；新增 `tauri://move` 400ms 节流监听，拖动后的摆件位置写入 `blockhabit.windowLayout.v1`，重启保留（P2-2）；补 pocket/display 两档组件测试。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。