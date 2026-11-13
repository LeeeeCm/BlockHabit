---
id: D-20261114-073
date: 2026-11-14
title: format:check 扩到全仓源码（src/** 与 scripts/**），一次性 Prettier 对齐 + 进 CI
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [package.json, .prettierignore, .github/workflows/ci.yml]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261110-050（F5 收尾）当时把 Prettier 的**校验范围**收窄成一份手写的 19 个文件白名单，理由是「避免一次全仓格式化污染 git blame」。
代价是：白名单之外的文件（`src/store/appStore.ts`、`src/sync/useSync.ts`、`src/render/ShowcaseScene.tsx` …… 共 180+ 个）
**从未被任何门禁约束**。结果是同仓库里存在两套缩进/换行风格，新人（或 AI）改哪个文件就跟着哪个风格走，评审成本逐年上涨；
新增文件也不会自动纳入，必须手工往白名单里加——这本身就是个反复遗忘的坑。

## 设计决定

1. **校验范围改为「目录级」而不是「文件白名单」**：`format:check` 变成
   `prettier --check "src/**/*.{ts,tsx,css}" "scripts/**/*.mjs" .prettierrc.json vite.config.ts index.html`。
   `src/**` 覆盖全部前端源码（含测试与 CSS），`scripts/**` 覆盖全部校验/发布脚本，二者之外的文件（`design/`、`docs/`、`*.md`、
   `src-tauri/target/`、`dist/`、`.tmp*/`）继续由 `.prettierignore` 排除，**不碰**生成物与证据目录。
2. **一次性对齐**：对同一批文件跑一次 `prettier --write`，单独一个提交（不做任何逻辑改动），
   提交信息里写明「纯格式化」，方便 `git blame --ignore-rev` 或 `-w`（忽略空白）审阅。
3. **进 CI**：`.github/workflows/ci.yml` 增加 `npm run format:check` 步骤，格式从此是机器门禁，不再靠人记。
4. **`.prettierignore` 保持不变**（它已经排除了生成物、设计中枢、文档与临时目录）；本次不改忽略清单，避免把「排除」和「纳入」混在一次提交里。

## 取舍与被否方案

- **否掉「维持白名单，靠自觉扩表」**：D-050 之后又新增了十几个文件，白名单一次都没跟上；这次就是来还这笔债的。
- **否掉「用 ESLint + Prettier 组合」**：仓库没有 ESLint（D-050 已写明不引入的理由：Tauri/Vite 的 TS 配置已覆盖类型层，
  团队规模不需要额外的 lint 噪音）。纯 Prettier 只做排版，不引入新的规则集，风险最低。
- **否掉「prettier --check .」全仓**：会把 `src-tauri/**`（Rust/JSON/Toml，Prettier 不支持）和 `public/**` 一起卷进来，
  需要额外维护 ignore 规则；用两个明确 glob 更可读、出错时定位更快。
- **否掉「顺手改格式化规则」**：`semi:false / singleQuote / printWidth 100` 保持不动——本次是**对齐**，不是**重设**。

## 影响面

- 代码：约 185 个文件的空白/换行/引号风格统一，**零逻辑改动**；
- 门禁：`format:check` 从 19 个文件扩到整个 `src/**` + `scripts/**`，并进入 CI（PR/push 都会跑）；
- 协作：`git blame` 会有一次大范围漂移，已在提交信息里标注纯格式化提交的哈希，后续审阅可用 `git blame --ignore-rev`。

## 验收标准

1. `npm run format:check` 通过（0 个未格式化文件）。
2. 格式化前后 `npx tsc --noEmit` 0 错误、`npm test` 用例数与通过数完全一致（证明纯排版）。
3. `npm run design:check` 通过；`.tmp*/`、`dist/`、`src-tauri/target/`、`design/`、`docs/` 未被格式化。
4. CI 的 `format:check` 步骤存在且在干净树上为绿。

## 变更履历

- 2026-11-14 created (lead)：按用户授权扩围；本记录状态由人类授权直接置为 approved（reviewer=LeeCM）。
