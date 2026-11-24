---
id: D-20261124-106
date: 2026-11-24
title: 模型图鉴分组标题与桌宠蓝图可置顶
status: proposed
owner: Claude Code
surface: [gallery]
axioms: [A2, A4]
files: [src/components/GalleryDialog.tsx, src/components/GalleryDialog.test.tsx, src/components/ui-cards.css, src/platform/galleryPrefs.ts, src/platform/galleryPrefs.test.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, README.md]
supersedes: []
reviewer: pending
---

## 背景与问题

模型图鉴把 23 座建筑蓝图与 2 座桌宠蓝图放在同一个滚动区里，只有桌宠蓝图有 `h4` 标题，建筑蓝图没有分组标题；玩家难以快速判断两组内容的边界。用户希望两组都以二级标题区分，并允许把桌宠蓝图置顶，方便优先查看刚解锁的桌宠形象。

## 设计决定

- **两组二级标题**：建筑蓝图与桌宠蓝图都使用 `h4`（图鉴主标题是 `h3`），并在标题旁显示该组数量；标题样式统一为 `--fs-subhead` / 700，数量用 `--fs-caption` 的次级色。桌面端保持 3 列网格，不改变卡片尺寸。
- **桌宠置顶**：图鉴顶栏右侧（关闭按钮左边）放一枚「桌宠置顶 / 取消置顶」按钮，复用 `IconPin`（未置顶描边、置顶填充）；`aria-pressed` 暴露状态，点击带 `selection` 触感反馈。按钮始终可见，不必先滚到 23 张建筑卡底部才能操作。
- **排序**：默认建筑蓝图在前；置顶后桌宠蓝图整组移到建筑蓝图之前。使用条件 DOM 顺序而不是 CSS `order`，保证键盘与读屏顺序与视觉一致。切换后把弹窗主体滚动位置归零，避免用户停在原来的中段。
- **窄窗口**：对话框宽度 ≤ 480px 时置顶按钮只保留图钉图标，完整名称由 `aria-label` / `title` 提供，避免顶栏被中英文长标签挤爆。
- **持久化**：置顶偏好只存设备本地 `localStorage` 的 `blockhabit.galleryPetFirst.v1`（`'1'` / `'0'`），不进入存档、不参与 WebDAV 同步；读取失败或值损坏时回到默认顺序。
- 不改变蓝图解锁规则、卡片状态、档案入口与总数。

## 取舍与被否方案

- **否掉默认永远把桌宠蓝图放最前**：建筑主线仍是主路径，默认顺序不应被支线打断；把选择权交给用户。
- **否掉拖拽排序**：图鉴只有两组，拖拽的交互成本与实现复杂度都高于一枚置顶按钮。
- **否掉存进 AppSettings**：这是设备屏幕上的浏览顺序，不是需要跨设备同步的用户数据；存存档会增加 schema 迁移与合并噪音。
- **否掉 CSS `flex-direction: column-reverse`**：视觉顺序反转但读屏/键盘顺序不变，属于可访问性陷阱。

## 影响面

- `GalleryDialog`：分组结构、置顶按钮与条件排序。
- `ui-cards.css`：分组标题、数量、图钉按钮与组间距。
- `galleryPrefs.ts`：新增设备本地偏好读写。
- `i18n`：新增建筑蓝图/置顶/取消置顶三条中英文案。
- 需人工走查：默认顺序、置顶/取消置顶、重开图鉴保持、锁定卡与档案入口仍正常。

## 验收标准

- 图鉴内存在 `#gallery-buildings-title` 与 `#gallery-pet-blueprints-title` 两个 `h4`，分别显示「建筑蓝图」「桌宠蓝图」。
- 默认 DOM 顺序为 `buildings → pets`；点击顶栏「桌宠置顶」后为 `pets → buildings`，按钮 `aria-pressed=true`，重开图鉴仍保持；取消置顶后恢复。
- 置顶按钮在打开图鉴时即可见，无需滚动到页尾。
- 25 张卡片数量、锁定规则、档案入口与原有测试不变。
- `npx tsc --noEmit`、`npm test`、`npm run design:check`、`npm run format:check` 通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户要求增加二级标题与桌宠蓝图置顶。
- 2026-11-24 verified（Claude Code）：CDP 实测默认 `buildings → pets`、标题为「建筑蓝图 23 / 桌宠蓝图 2」、25 张卡片；点击顶栏「桌宠置顶」后变为 `pets → buildings`、`aria-pressed=true`、localStorage 记 `1`，重开保持；取消后恢复。375px 窄视口下按钮收为 29px 图钉，`aria-label` 仍为完整名称；弹窗主体 `offsetWidth-clientWidth=0`。
