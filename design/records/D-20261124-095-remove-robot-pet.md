---
id: D-20261124-095
date: 2026-11-24
title: 移除机器人桌宠形象
status: approved
owner: Claude Code
surface: [mini-widget, settings]
axioms: [A2, A4]
files: [src/pet/types.ts, src/pet/PetWindow.tsx, src/components/settings/PetSettingsGroup.tsx, src/App.tsx, src/storage/adapter.ts, src/types.ts, src/i18n/]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户明确要求删除机器人桌宠，只保留积木与猫；机器人此前通过完成建筑解锁，但仍出现在设置、右键面板与存档白名单中。

## 设计决定

- `PetSkin` 只保留 `block` 与 `cat`；设置、右键面板、i18n 移除机器人入口。
- 旧存档中的 `robot` 值在 sanitize 时回落 `block`，不报错、不丢其它设置。
- 猫的解锁规则仍为完成 3 座建筑；积木默认可用。
- 旧版几何中的机器人绘制数据不再从桌宠入口暴露；保留代码资产不删除设计记录。

## 取舍与被否方案

- 否掉把 `robot` 自动映射成猫：会改变用户已选形象；回落积木更可预期。
- 否掉同时删除所有几何/测试：本轮只移除桌宠入口，避免牵连共享渲染资产。

## 影响面

设置与右键面板少一个选项；存档 sanitize 白名单收窄；i18n 清理。无 schema 变更。

## 验收标准

- 设置与右键面板不再出现机器人；旧 `robot` 存档加载为积木。
- 猫仍按 3 座建筑解锁；颜色、跳跃与面板行为不变。
- `tsc`、测试、`design:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户明确要求删除机器人桌宠。
- 2026-11-24 D-098 以“完成 pet-bot 蓝图后才可选”的方式恢复旧版机器人形象；本记录保留为当时的移除决定。
