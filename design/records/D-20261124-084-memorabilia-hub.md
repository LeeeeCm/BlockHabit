---
id: D-20261124-084
date: 2026-11-24
title: 纪念品中心：统计页收拢五个导出入口
status: proposed
owner: Claude
surface: [stats, yearbook, building-archive, polaroid, monthly-poster]
axioms: [A1, A4]
files: [src/components/MemorabiliaDialog.tsx, src/components/MemorabiliaDialog.test.tsx, src/pages/Stats.tsx, src/pages/stats/StatsHeader.tsx, src/i18n/locales/zh.ts, src/i18n/locales/en/stats.ts, src/i18n/types.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

统计页页头原本并排「月度画报」「年鉴」两个胶囊，建造页有「纪念相纸」，图鉴每座建筑有「档案」，设置页有「完整档案包」。五个导出入口分散在四个位置，统计页还要为其中两个各维护一份弹窗状态。

## 设计决定

- 统计页页头只保留一个「纪念品」按钮，打开 `MemorabiliaDialog`（宽 560）。
- 弹层内容：
  1. 月度画报 / 落成年鉴 两张卡（直接打开既有弹窗）；
  2. 「建筑档案与相纸」：从已落成建筑里选一座，打开既有 `BuildingArchiveModal` 或 `PolaroidModal`；
  3. 内嵌既有 `ArchiveExportPanel`（完整档案包），不复制导出逻辑。
- 建造页的纪念相纸与图鉴的档案入口**保持原位**——它们是「当前建筑」的上下文操作，不属于统计页聚合范围。
- 嵌套弹层打开时，纪念品中心让出 Esc/焦点圈闭；不新增画布、不新增持久化字段、不新增颜色。

## 取舍与被否方案

- 否掉「把所有入口物理迁进纪念品中心」：建造页/图鉴的入口依赖当前建筑上下文，迁走会增加两次选择。
- 否掉「新建一套纪念品画布」：五件印刷品已有成熟画布，聚合层只做导航。
- 否掉「建筑档案与拍立得各用一个下拉框」：共用同一个已落成建筑选择，少一个状态。

## 影响面

- 统计页少两个按钮、少两个弹窗状态；新增一个弹层组件与一条守门测试。
- 已落成建筑为空时如实显示空态，不生成假条目。
- 中英新增 8 个 `stats.memorabilia*` 文案。

## 验收标准

1. 统计页页头只有「纪念品」一个导出入口，点击打开聚合弹层。
2. 月度画报、年鉴、建筑档案、拍立得、完整档案包五条路径都能从弹层到达。
3. 没有已落成建筑时，「建筑档案与相纸」显示空态且不出现选择框。
4. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-24 created (Claude)
