---
id: D-20261110-001
date: 2026-11-10
title: 建立设计中枢：唯一入口、追加式记录、删除需人工审核
status: approved
owner: lead
surface: []
axioms: [A1, A2, A3, A4, A5, A6, A7]
files: [design/README.md, design/AESTHETIC.md, design/RECORDS.md, design/APPROVALS.md, design/index.json, AGENTS.md, scripts/design-ledger.mjs, src/designLedger.test.ts, package.json, tsconfig.json]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

项目的设计知识在 2026-11 时分散在四处、且互相漂移：

1. `docs/superpowers/specs/*.md`（4 份规格 + 3 份计划，共 12 万字符）——是**历史快照**，不是现行规范；其中大量条目已实现或已推翻，新人无从判断哪条还算数。
2. `src/theme.css` + `src/components/ui.css`（1280 行）+ `src/render/iso.ts`——是**事实上的规范**，但没有任何文字说明"为什么"，改一个数值不知道会连带影响什么。
3. `design/logo/`——只有品牌资产原件，没有使用规则。
4. 仓库**没有 AGENTS.md 或任何代理规则文件**，AI 代理每次协作都从零读代码猜风格，于是出现"纸白主题漏令牌导致白屏""硬编码 #f59e0b 造成两种琥珀"这一类典型事故。

用户要求：**所有设计必须从一个统一的文件夹或文件开始查看；每次设计完成后写回同一处；删除必须经人工审核确认。**

## 设计决定

把 `design/` 升格为**全项目唯一设计入口**（唯一入口 = `design/README.md`），并配套四件套：

1. **入口与索引**：`design/README.md` —— §1 设计公理 A1–A7（每次开工逐条自检）、§2 文件地图（什么改动必须读哪个文件）、§3 五步流程 + 记录模板、§5 删除铁律。
2. **规范正文**：`AESTHETIC.md`（理念与边界）、`TOKENS.md`（四主题令牌矩阵）、`ART.md`（积木美术）、`SURFACES.md`（界面表面）、`VOICE.md`（文案）。
3. **追加式台账**：`records/D-YYYYMMDD-NNN-*.md` 一条设计一个文件，**append-only**；`RECORDS.md` 汇总表 + `index.json` 机器索引。状态机 `proposed → approved → implemented | superseded | deprecated | revoked`，其中 `approved` 及之后**只能由人类设置**。
4. **删除需人工审核**：`APPROVALS.md` 台账 + `scripts/design-ledger.mjs` 校验器。校验器对比 git HEAD 检测记录删除，未经审批的删除直接让 `npm run design:check` 失败；`src/designLedger.test.ts` 把这条守门接进 `npm test`。

配套 `AGENTS.md`（仓库根）把这套流程写成 AI 代理的强制规则：设计前必读 `design/README.md`，记录先于代码，禁止删除。

## 取舍与被否方案

- **否决「只写一个超大设计文档」**：单文件会随每次改动无限膨胀，且无法表达"这条还有效吗"。采用"一个入口 + 多条不可变记录"结构，历史可追溯、状态可读。
- **否决「直接改写历史 spec」**：历史 spec 是时间快照（含当时的取舍理由），改写会丢证据。它们保持只读，由 `design/records/` 承接新决策。
- **否决「用 wiki/外部平台」**：项目要满足"从统一文件夹开始查看"，必须与代码同仓、可被 grep、可被脚本校验。
- **删除用状态位而非物理删除**：设计记忆是资产，`deprecated` 比删除信息量大得多；物理删除只留给"写错了/含敏感信息"。
- **校验器放 vitest 而不是 CI**：项目当前无 CI（见审计报告），vitest 是唯一必然被执行的入口，接进 `npm test` 才能形成约束；后续接 CI 只需一行。

## 影响面

- 代码：新增 `scripts/design-ledger.mjs`、`src/designLedger.test.ts`；`package.json` 增 `design:check` 脚本；`tsconfig.json` 的 exclude 增 `src/designLedger.test.ts`（同 `theme.test.ts` 惯例，因使用 `node:fs`）。
- 文档：新增 `AGENTS.md`；`design/` 由"品牌资产目录"变为"设计中枢"（`design/logo/` 保留原位）。
- 流程：此后任何视觉改动的 PR 必须带一条 `design/records/` 记录。
- 无用户可见界面变化，不影响运行时行为。

## 验收标准

1. `design/README.md`、`AESTHETIC.md`、`RECORDS.md`、`APPROVALS.md`、`index.json`、`records/` 全部存在且自洽。
2. `npm run design:check` 通过：无未登记记录、无 id 重复、无非法状态、无未审批删除。
3. 人为删除一条记录（不写 `APPROVALS.md`）→ `npm run design:check` 失败并明确指出被删记录 id。
4. `npm test` 全绿（含 `src/designLedger.test.ts`），`npx tsc --noEmit` 零错误。
5. 人工走查：按 `design/README.md` §0 的 60 秒上手流程，能在 5 分钟内独立找到"改一个颜色该读哪一节"。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
