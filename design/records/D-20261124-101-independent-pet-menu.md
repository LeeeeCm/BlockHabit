---
id: D-20261124-101
date: 2026-11-24
title: 桌宠右键面板改为独立透明窗，不移动桌宠
status: approved
owner: Claude Code
surface: [mini-widget]
axioms: [A2, A5]
files: [src-tauri/tauri.conf.json, src-tauri/capabilities/default.json, src-tauri/src/lib.rs, src/main.tsx, src/pet/PetMenuWindow.tsx, src/pet/PetWindow.tsx, src/pet/petWindow.css, src/platform/petWindow.ts, src/App.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

右键桌宠时，现有实现扩大并移动桌宠窗口来容纳面板，导致桌宠位置被强制改变。用户要求面板与桌宠位置解耦，更灵活。

## 设计决定

- 新增独立 `pet-menu` 透明置顶窗（236×300），只渲染右键面板。
- 右键时 Rust 命令优先把面板放在桌宠右侧；右侧超出工作区就翻到左侧，并钳制上下边界；桌宠窗口不 resize、不移动。
- 面板显示/隐藏通过 `pet-menu-state` 事件同步给桌宠；面板打开期间桌宠暂停走动，关闭后恢复。
- 主窗把 `pet-config` 同时发给桌宠和面板；面板修改大小/形象/走动用 `pet-pref` 回传主窗，逻辑与设置页同源。
- 面板的设置按钮收起面板并打开主窗设置；Esc/关闭按钮均隐藏面板。

## 取舍与被否方案

- 否掉继续扩大桌宠窗口：必然移动桌宠。
- 否掉把面板塞进 160×180 小窗：空间不足。
- 否掉面板与桌宠位置绑定同步移动：用户明确要更灵活，面板只需依附一次位置。

## 影响面

新增窗口 label 与 capability、两个 Rust 命令；桌宠窗口不再有面板尺寸/位置逻辑。旧 `pet-menu-state` 无持久化。

## 验收标准

- 右键面板出现在桌宠旁，桌宠窗口坐标不变；右边缘自动翻左。
- 面板打开时桌宠暂停，关闭后恢复；面板操作与设置页一致。
- 桌宠仍可拖动、双击主窗、自主跳跃。

## 变更履历

- 2026-11-24 created（Claude Code），按用户明确要求解耦面板与桌宠位置。
