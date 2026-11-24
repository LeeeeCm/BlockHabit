---
id: D-20261124-107
date: 2026-11-24
title: 桌宠蓝图在图鉴中默认置顶（取代按钮方案）
status: proposed
owner: Claude Code
surface: [gallery]
axioms: [A2, A4]
files: [src/components/GalleryDialog.tsx, src/components/GalleryDialog.test.tsx, src/components/ui-cards.css, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, README.md]
supersedes: [D-20261124-106]
reviewer: pending
---

## 背景与问题

D-20261124-106 实现了「建筑蓝图 / 桌宠蓝图」两个二级标题，并在图鉴顶栏放了可切换的置顶按钮。用户确认：不需要按钮或可切换状态，桌宠蓝图应当**默认固定排在最前**，建筑蓝图在后。按钮方案增加了不必要的状态、持久化与点击成本。

## 设计决定

- 保留两组二级标题与数量：桌宠蓝图 `2`、建筑蓝图 `23`；标题使用 `h4` + `--fs-subhead` / 700，数量用 `--fs-caption` 次级色。
- **桌宠蓝图整组固定置顶**：图鉴打开时 DOM 顺序恒为 `pets → buildings`，不做按钮、不做 localStorage 偏好、不做条件排序。
- 删除 D-106 引入的 `galleryPrefs.ts`、`galleryPrefs.test.ts`、`.gallery-pin` / `.gallery-header-actions` 样式与 `pinPet` / `unpinPet` 文案。
- 不改变 25 张卡片数量、建筑蓝图顺序解锁规则、锁定剪影、建造中缩略图与已落成档案入口。
- 桌面端保持 3 列网格；窄窗口继续由对话框现有响应式规则处理。

## 取舍与被否方案

- **否掉保留按钮但默认置顶**：用户明确不要按钮；多余控件与持久化状态只会增加维护面。
- **否掉用 CSS `order` 置顶**：DOM/键盘/读屏顺序必须与视觉一致，直接按固定顺序渲染最简单。
- **否掉把建筑蓝图也做成可折叠组**：本次只要求分组与桌宠默认置顶，不扩张交互。

## 影响面

- `GalleryDialog`：固定渲染顺序与两个分组标题。
- `ui-cards.css`：分组标题、数量、组间距；撤下按钮样式。
- i18n：保留「建筑蓝图」标题，删除置顶按钮文案。
- 删除 D-106 的 `galleryPrefs` 模块与测试。
- 需人工走查：打开图鉴先看到桌宠蓝图；下面建筑蓝图；锁定/建造中/档案卡不变。

## 验收标准

- 图鉴 DOM 中 `[data-gallery-section]` 顺序恒为 `pets → buildings`，无 `.gallery-pin` 按钮。
- 存在 `#gallery-pet-blueprints-title` 与 `#gallery-buildings-title` 两个 `h4`，数量分别为 2 / 23。
- 25 张卡片、锁定规则、档案入口与既有测试全部通过。
- `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户澄清改为默认置顶。
