---
id: D-20261124-086
date: 2026-11-24
title: 全局快捷键唤起主窗并回到今日页
status: proposed
owner: Claude
surface: [settings]
axioms: [A7]
files: [src/platform/globalShortcut.ts, src/platform/globalShortcut.test.ts, src/App.tsx, src/components/settings/SystemGroup.tsx, src/components/SettingsDialog.tsx, src/types.ts, src/storage/adapter.ts, src/store/appStoreHelpers.ts, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, package.json, package-lock.json]
supersedes: []
reviewer: pending
---

## 背景与问题

桌面端是正式目标，但应用运行在托盘时没有任何系统级入口；用户必须先找到托盘图标或任务栏。快捷键是桌面应用最自然的「唤起」方式。

## 设计决定

- 接入 `@tauri-apps/plugin-global-shortcut` + `tauri-plugin-global-shortcut`（依赖已获人类批准）。
- 快捷键固定 `CommandOrControl+Alt+H`；设置 → 系统集成新增「全局快捷键唤起」开关，**默认关**，用户显式开启才注册。
- 触发行为：显示主窗 → 取消最小化 → 聚焦 → 切到今日页；**不自动打卡**，避免误触改数据。
- 注册失败（被其他应用占用 / 权限缺失）时把设置回滚为关，并 toast 如实说明；不留下「开关开着但没反应」。
- 关闭开关或应用卸载时注销；非 Tauri 环境（浏览器预览/测试）直接降级，不调用插件。
- Rust 侧只注册插件，快捷键由前端按设置动态注册/注销。

## 取舍与被否方案

- 否掉「快捷键直接完成一次打卡」：误触会改变积木、连击与全勤，不符合数据诚实；唤起后由用户确认。
- 否掉「自定义快捷键录制」：需要冲突检测 UI 与更多状态，v1 固定组合足够。
- 否掉「启动时默认注册」：系统级快捷键属于用户授权行为，默认关。

## 影响面

- 新增一个 JS 插件依赖与一个 Rust crate；capabilities 增加三条 global-shortcut 权限。
- `AppSettings` 新增 `quickCheckInEnabled`，存档 sanitize 与默认值同步补齐。
- 新增 4 条 platform 单测；桌面端真实按键需人工验收（CI 无法模拟）。

## 验收标准

1. 设置开关默认关；开启后 `Ctrl/⌘+Alt+H` 从其他应用唤起主窗并回到今日页。
2. 注册失败时开关回滚并出现提示；关闭开关后快捷键失效。
3. `npx tsc --noEmit`、`npm test`、`cargo check`、`npm run design:check` 通过。
4. 桌面端人工验证：隐藏/最小化/其他应用前台三种状态下均可唤起。

## 变更履历

- 2026-11-24 created (Claude)
