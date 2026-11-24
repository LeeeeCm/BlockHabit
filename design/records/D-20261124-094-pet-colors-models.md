---
id: D-20261124-094
date: 2026-11-24
title: 桌宠材质色 DIY 与第三形象（猫）
status: approved
owner: Claude Code
surface: [mini-widget, settings]
axioms: [A1, A2, A6]
files: [src/pet/types.ts, src/pet/PetWindow.tsx, src/render/petCanvas.ts, src/components/settings/PetSettingsGroup.tsx, src/types.ts, src/storage/adapter.ts, src/App.tsx, src/i18n/]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户希望桌宠有更多 DIY 空间：可改积木颜色、使用更多已设计过的模型。直接开放任意取色会破坏 A1“黑白灰为骨、唯一琥珀点缀色”，因此只在已批准的蓝图材质色板内提供选择。

## 设计决定

- `petColor` 可选值限定为 D-067 已批准材质色中的 6 个（石、浅、陶土、暖黄、天蓝、苔绿），另提供“跟随主题”默认；无任意 hex 输入。
- 颜色通过 `deriveShadingForColor` 生成三面明暗；脸墨色按对比度选深浅，保持可读。颜色只影响桌宠角色，不改变建筑与全局主题。
- 增加 `cat` 形象，复用旧版 `petGeometry` 已有 `cat`；block 默认、robot 完成 1 座建筑解锁、cat 完成 3 座建筑解锁。旧存档的 robot 值保持可用，未知 skin 回落 block。
- 颜色入口放在设置 → 桌宠分组；右键悬浮面板保持精简，不塞入色板。

## 取舍与被否方案

- 否掉自由取色器/任意 hex：会扩张视觉语言并破坏主题一致性。
- 否掉新增彩色专用色板：复用 D-067，避免第二套材质语义。
- 暂未新增专属桌宠蓝图；先用“完成建筑数”解锁，后续可把模型注册表接到专属蓝图。

## 影响面

设置与存档新增可选 `petColor`，按白名单 sanitize，不升 schema；`PetSkin` 增加 cat。桌宠渲染接受可选 shading，默认行为不变。i18n 中英补齐。

## 验收标准

- 四主题下颜色切换不改变桌宠轮廓与表情可读性；跟随主题仍与原版一致。
- 未知颜色/形象回落默认；旧存档安全读取。
- 设置与右键面板都能切换猫（满足条件时），完成数不足时说明解锁条件。
- `tsc`、测试、`design:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户明确要求增加颜色 DIY 与更多模型。
