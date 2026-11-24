---
id: D-20261124-098
date: 2026-11-24
title: 旧桌宠蓝图解锁形象、待机动作与尺寸收敛
status: approved
owner: Claude Code
surface: [mini-widget, settings, gallery]
axioms: [A2, A5, A6]
files: [src/logic/blueprints/generatorsV4.ts, src/logic/blueprints/index.ts, src/logic/blueprints/manifest.ts, src/logic/petModels.ts, src/logic/blueprint.ts, src/pet/types.ts, src/pet/PetWindow.tsx, src/components/settings/PetSettingsGroup.tsx, src/components/GalleryDialog.tsx, src/types.ts, src/storage/adapter.ts, src/App.tsx, src/i18n/]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

上一版把桌宠形象改成按“已完成建筑数”解锁的新猫，用户明确不要；用户要的是旧版 `pet-cat` / `pet-bot` 蓝图：只有把对应蓝图建造完成，才能在桌宠设置中选用对应形象。另要求桌宠尺寸收敛，并增加待机动作，不要一直走动。

## 设计决定

- 恢复旧内容包 v4：`pet-cat`（方块猫，12 块）与 `pet-bot`（小机器人，16 块）作为独立桌宠支线，不进入主线解锁顺序；`CONTENT_VERSION` 回到 4。
- 形象资格只由当前有效积木推导：block 默认；cat 需要 `pet-cat` 完整；bot 需要 `pet-bot` 完整。撤销/同步导致缺块时回退 block，不另存解锁旗标。
- 旧存档的 `petModel` 字段继续读取并映射到 `petSkin`；新写入使用 `petSkin`。
- 尺寸收敛：中档由 1.0 降到 0.9，小 0.8、大 1.05，仍只缩放角色，不改变 160×180 窗口。
- 自主走动从“2.5–6 秒间隔、2.2–4.6 秒行走”改为“6–16 秒间隔、1.2–2.4 秒行走”；空闲时增加张望、伸懒腰、原地小跳三种待机动作（约 7–13 秒一次），菜单/拖动时暂停。
- 图鉴增加独立的桌宠蓝图分区，卡片显示当前落块进度；尺寸与相机沿用现有图鉴缩略图。

## 取舍与被否方案

- 否掉按完成建筑数解锁：用户要的是蓝图对应模型。
- 否掉把蓝图模型直接当桌宠网格：先复用旧版正面积木几何，保持表情、左右跳和窗口尺寸可控。
- 否掉持续走动：改为静止为主、偶发待机动作和短距离跳跃。

## 影响面

内容版本 4、蓝图目录 25 座、图鉴分区、桌宠存档字段兼容、设置形象选择、待机动作与移动节奏。旧 v4 存档继续可读；含未知蓝图的数据仍拒绝。

## 验收标准

- 未完成 `pet-cat`/`pet-bot` 时对应形象不可选；完成后可选，撤销后回退积木。
- 桌宠待机时以静止/张望/伸懒腰/小跳为主，走动明显减少；菜单打开暂停。
- 图鉴桌宠分区显示进度，主线顺序与展台解锁不受影响。
- `tsc`、测试、`design:check`、构建通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户要求恢复旧蓝图解锁并增加待机动作。
