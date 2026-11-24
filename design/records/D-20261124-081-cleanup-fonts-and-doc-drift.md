---
id: D-20261124-081
date: 2026-11-24
title: 清理零引用字体依赖与设计文档漂移（零可见变化）
status: proposed
owner: Claude
surface: []
axioms: []
files: [package.json, package-lock.json, design/ART.md, design/AESTHETIC.md, design/TOKENS.md, design/REVIEW-QUEUE.md, CHANGELOG.md]
supersedes: []
reviewer: pending
---

## 背景与问题

2026-11-24 设计复盘发现四处已记录但未执行的工程/文档债，均不改变任何用户可见结果：

1. `package.json` 仍声明 4 个零引用字体包：`@fontpkg/alimama-fang-yuan-ti-vf`、`@fontsource/fredoka`、`@fontsource/plus-jakarta-sans`、`@fontsource/zcool-qingke-huangyou`。审计 D-20261110-003 / D-20261110-005 与优化计划 E1 已指出，但一直未落地；`node_modules` 约 22MB 纯浪费，并扩大供应链面。
2. `design/ART.md` §7 仍写「所有调用点都没传 bonus，奖励块外观与普通块一致」；实际渲染链路已在 B5 收尾时接通（`render/buildscene/sceneDraw.ts:97–104`、`ShowcaseScene`、`PolaroidModal`、`MonthlyPosterModal`、`BuildingArchiveCanvas`）。
3. `design/AESTHETIC.md` §7 的三条设计债已解决但未标注：首启引导（D-023/D-053）、191 天后的内容（D-063/D-070，现 23 座 / 2485 块）、动效令牌（D-026）。
4. `design/TOKENS.md` §8 仍把 `.day-check` / `.fab` 列为「死令牌」；2026-11-24 复核 `src/` 中已无二者的定义或引用。另 §7 的点缀色越界表是 2026-11-10 快照，未注明 A1 的最终口径（D-20261110-048：同一时刻只有一个点缀色相）。

另：`design/REVIEW-QUEUE.md` 停留在 2026-11-12 的 71 条 / 58 条 proposed，现实是 80 条全部 approved，已成为一份会误导审核者的过期副本。

## 设计决定

- 从 `package.json` / `package-lock.json` 移除上述 4 个字体包；不新增、不升级任何依赖。
- 校准三处文档，保留原文并追加「2026-11-24 复核」说明（不删除历史结论）。
- `REVIEW-QUEUE.md` 顶部标记 `DEPRECATED`，明确当前状态只看 `RECORDS.md` 与 `index.json`；全文保留，不物理删除。
- 不触碰 UI、令牌值、渲染、数据模型与测试断言。

## 取舍与被否方案

- 否掉「顺手重写 A1 / 清理 accent 用法」：那会改变可见界面，且需要单独的设计记录与截图验收，不属于本次零可见变化清理。
- 否掉「删除 REVIEW-QUEUE.md」：违反 `design/README.md` §5 的删除规则；标记 deprecated 即可达到「不再被误用」的目的。
- 否掉「保留字体包以防未来换字体」：未来若要用，重新安装即可；当前保留只会扩大安装体积与依赖面。

## 影响面

- 依赖：`node_modules` 减少 4 个包；安装包体积不变（这些包从未被打进 bundle）。
- 文档：`design/ART.md`、`design/AESTHETIC.md`、`design/TOKENS.md`、`design/REVIEW-QUEUE.md`、`CHANGELOG.md`。
- 代码 / UI / 数据：零改动。

## 验收标准

1. `grep -rn "fredoka\|plus-jakarta\|zcool\|alimama-fang-yuan" package.json package-lock.json` = 0 命中。
2. `npm test`、`npx tsc --noEmit`、`npm run design:check`、`npm run format:check` 全绿。
3. `npm run build` 产物与清理前同量级（无新增/缺失 chunk）。
4. 复核文档中的每一条「已解决」都能指到对应记录或代码位置。

## 变更履历

- 2026-11-24 created (Claude)
