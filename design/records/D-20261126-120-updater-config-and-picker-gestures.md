---
id: D-20261126-120
date: 2026-11-26
title: 更新通道按配置就绪启用、下拉菜单拼成一体、时间滚轮改为点击后才接管
status: proposed
owner: Claude Code
surface: [settings, stats, gallery]
axioms: [A2, A4]
files: [vite.config.ts, src/vite-env.d.ts, src/platform/updater.ts, src/platform/updater.test.ts, src/components/SelectMenu.tsx, src/components/TimeWheelPicker.tsx, src/components/TimeWheelPicker.test.tsx, src/components/ui-drop.css]
supersedes: []
reviewer: pending
---

## 背景与问题

三处问题（用户截图指出）：

1. **发布链路未启用**：设置页「检查更新」一直显示禁用说明，但 `src-tauri/tauri.conf.json` 里的签名公钥与 `latest.json` 端点其实都已经配好。
2. **下拉菜单拼接处圆角/尖角互相顶撞**：展开后触发器仍保持完整圆角，列表又带自己的上边框与阴影，接缝处出现双重轮廓。
3. **时间滚轮误触**：只是把鼠标滑过控件、想往下翻设置页时，滚轮就被控件接管并改了时间。

## 设计决定

- **更新通道判据改为「配置是否就绪」**：`vite.config.ts` 在构建期读取 `src-tauri/tauri.conf.json` 的 `plugins.updater`，公钥与端点都非空时用 `define` 注入 `__BH_UPDATER_CONFIGURED__ = true`；`isUpdaterEnabled()` 改为 `Tauri 运行时 && (VITE_UPDATER_ENABLED=1 || 该标志)`。CI 的显式开关继续有效，浏览器预览仍永远禁用。这正是本机 `npm run tauri build` 的真实情形 —— 以前它不带环境变量，所以永远显示未启用。
- **下拉菜单拼成一块**：展开时触发器只留上两角圆角、去掉下边框；列表 `border-top: none`、`marginTop: 0`、只有下方两角圆角；阴影只挂在列表上。实测几何完全对齐（`listTop === trigBottom === 293`，`listLeft === trigLeft === 249`，宽度同为 132）。
- **时间滚轮必须先点一下**：`onWheel` 在 `!expanded` 时直接 `return`，不再「悬停即展开并接管」。展开后才 `preventDefault` 并步进，且按指针在该行左/右半边分派小时或分钟。指针离开控件范围时滚轮仍然属于页面。

## 取舍与被否方案

- **否掉「构建时强制打开更新」**（把 `VITE_UPDATER_ENABLED` 写死打包进去）：那会让任何本地调试构建都去访问线上 latest.json，违反 A7 的本地优先与「不静默联网」。按配置就绪判断既能修好发布构建，又保留诚实禁用。
- **否掉给触发器加 `overflow: hidden` 硬裁圆角**：会把焦点环一起裁掉；改成按展开态切换 `border-radius` / `border-bottom` 更准确。
- **否掉列表用负 `marginTop` 压住 1px 边框**（旧实现）：压住后两条边框叠加成 2px 深线，正是「尖角」观感的来源。
- **否掉给时间滚轮加冷却时间（如 300ms 内忽略）**：仍会在用户连续滚页面时被偶发接管；「先点击」是明确的意图信号，且与弹窗类交互的心智一致。
- **否掉把滚轮判断改成几何命中测试**：监听器本就挂在控件根节点上，事件能到达即说明指针在其上；再叠几何判断反而在 jsdom（`rect` 全零）里误杀，测试也无法覆盖。

## 影响面

- 构建：`vite.config.ts` 新增 `define`，仅在构建期读一次配置文件（不改运行时行为）。
- 更新：本机构建与 CI 构建都会显示可用的「检查更新」；不联网直到用户点击。
- 界面走查：统计页手账的两处下拉、纪念品弹窗的建筑选择、设置页晚间收尾时间控件。
- 无障碍：下拉的 `aria-expanded` / `aria-activedescendant` 不变；时间控件仍是 `spinbutton` + 键盘可操作。

## 验收标准

- 本机构建（未设 `VITE_UPDATER_ENABLED`）打开设置 → 关于，「检查更新」可点击（不再显示未启用说明）；浏览器预览仍禁用。
- 下拉展开时触发器与列表左右边界、接缝 y 坐标完全一致，接缝处只有一条 1px 线，没有双层圆角。
- 鼠标仅滑过时间控件时滚动滚轮：页面正常滚动、时间不变；点击展开后滚动滚轮：时间逐格变化、页面不滚；点击外部收起后恢复原行为。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按三条反馈分别修更新判据、下拉接缝与滚轮误触。
- 2026-11-26 verified（Claude Code）：CDP 实测下拉 `listTop=293=trigBottom`、宽度同为 132、触发器 `10px 10px 0 0` / 列表 `0 0 10px 10px`；时间控件未点击滚动时页面 `scrollTop 0→128` 且小时保持 21，点击后两格 21→23 且 `scrollTop` 不变；`npm test` 128 文件 / 1243 用例全绿。
