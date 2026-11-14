---
id: D-20261115-078
date: 2026-11-15
title: 仓库门面与供应链：Actions 升版 / SECURITY / CONTRIBUTING / Issue 模板 / Dependabot / CodeQL / 仓库元数据
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [.github/workflows/ci.yml, .github/workflows/release.yml, .github/workflows/codeql.yml, .github/dependabot.yml, .github/ISSUE_TEMPLATE/, .github/PULL_REQUEST_TEMPLATE.md, SECURITY.md, CONTRIBUTING.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

仓库已经公开（MIT）并发布到 0.2.1，但「对外可用性」和「供应链自动化」还缺一截：

1. **Actions 告警**：`.github/workflows/{ci,release}.yml` 仍用 `actions/checkout@v4` /
   `actions/setup-node@v4`，GitHub 已提示「Node.js 20 deprecated」——继续用会随 runner 升级变成红灯。
2. **没有安全与贡献入口**：`SECURITY.md` / `CONTRIBUTING.md` 都不存在，漏洞往哪报、外部贡献怎么提、
   门禁怎么跑，全靠猜；仓库本地优先/无账号/无遥测的隐私边界也没有对外声明。
3. **没有 Issue/PR 模板**：缺复现信息（版本、Windows 版本、显示缩放、WebDAV 状态）会让每个 bug 都要来回问一轮；
   PR 没有硬约束自查清单（设计记录、zh/en、单文件 < 800 行、不提交密钥）。
4. **没有依赖自动化**：npm 与 cargo 依赖完全靠人肉盯 CVE；但 Tauri 生态是手工 pin 的 2.x 版本线，
   无脑升级 major 会直接编译不过。
5. **没有静态分析**：公开仓库不跑 CodeQL 等于把「有没有明显注入/原型污染/不安全反序列化」交给运气。
6. **仓库元数据空白**：`repositoryTopics` 为空、description 可以更准确，搜索/发现性差。

## 设计决定

1. **Actions 升版**：`actions/checkout@v4 → v5`、`actions/setup-node@v4 → v5`（CI 与 Release 两个 workflow），
   node-version 保持 22（与本地跑通的 LTS 一致）。升版后必须等一次真实 CI 绿才算完成。
2. **新增 `SECURITY.md`**：优先 GitHub Security Advisories 私密报送；写清支持范围（0.2.x）、响应预期（无 SLA）、
   范围与不在范围（OS/WebView2、未做 Authenticode 的 SmartScreen 提示、第三方 WebDAV、用户自改装构建）、
   隐私与数据边界、以及「不要把密钥/密码贴进 issue」。
3. **新增 `CONTRIBUTING.md`**：`AGENTS.md` 的对外摘要 + 开发环境 + 门禁命令 + 中文 conventional commit 规范 +
   PR 流程 + 文档归口 + 「不要用改测试的方式让 CI 变绿」。
4. **新增 Issue Forms 与 PR 模板**：`bug_report.yml`（版本/系统/缩放/WebDAV/备份/截图/隐私提醒）、
   `feature_request.yml`（本地优先影响、zh/en 文案、是否触发设计记录）、`PULL_REQUEST_TEMPLATE.md`（硬约束自查）。
5. **新增 `.github/dependabot.yml`**：npm（`/`）与 cargo（`/src-tauri`）两组，weekly，limit 5，
   minor+patch 分组减少噪音；**不自动合并**；对 Tauri 生态（`@tauri-apps/*`、`tauri`、`tauri-build`、
   `tauri-plugin-*`）的 major 升级加 ignore——升级 major 必须先评估（Tauri 2.x 是手工 pin 的版本线）。
6. **新增 `.github/workflows/codeql.yml`**：Advanced CodeQL，`javascript-typescript`，push main / PR / 每周 cron，
   `security-events: write`；首次扫描结果记录进发布报告（若出告警逐条处置或声明接受理由）。
7. **仓库元数据**：`gh repo edit` 增加 topics（tauri / react / typescript / habit-tracker / desktop-app /
   local-first 等），description 保持简洁准确；homepage 暂不设置（没有官网，不造假）。

## 取舍与被否方案

- **否掉「Dependabot 全自动合并」**：仓库没有足够测试覆盖所有依赖面，自动合并等于把供应链风险自动化；
  本记录只开 PR，由人看 CI 与 changelog 决定。
- **否掉「ignore 所有 Tauri 依赖」**：minor/patch 仍应跟（安全补丁），只 ignore major。
- **否掉「用 `gh issue create` 把待办登记成 issue」作为主要手段**：本轮待办在 goal 与文档里已经可追踪，
  再开一堆 issue 只会制造噪音；issue 模板用于**外部反馈**，不是内部 TODO。真机 T6/T7/T8 仍记在
  `real-device-acceptance.md`（那里才有可执行步骤）。
- **否掉「CodeQL 用 default setup」**：default setup 需要在网页端开启、无法随仓库代码评审；
  Advanced workflow 可版本化、可 review，且能固定语言与触发条件。
- **否掉「改 setup-node 的 node-version 到 24」**：本地是 Node 24，但 CI 一直在 22 上跑通；
  升 Node 大版本是另一件事（要验证全部测试与构建），不与「消除 Node20 deprecated 告警」混在一个提交。

## 影响面

- 只新增/修改仓库门面与 CI 配置：不改产品运行时代码、不改视觉、不新增运行时依赖。
- CI 行为变化：`node_modules` 缓存 key 随 setup-node 版本走；CodeQL 每周多一个扫描 job（约几分钟）。
- Dependabot 生效后会自动开 PR（与 main 的 CI 联动）；不会自动合并、不会直接改 main。
- 安全边界公开化：`SECURITY.md` 声明本地优先/无账号/无遥测，与产品一致。

## 验收标准

1. 升版后的 CI run 在 main 上 **success**（含 Format check / Production build），且日志不再出现
   Node.js 20 deprecated 警告。
2. `gh repo view --json repositoryTopics` 返回包含设定 topics；`SECURITY.md` / `CONTRIBUTING.md` /
   模板文件全部在 main 上可见。
3. `.github/dependabot.yml` 被 GitHub 接受（Insights → Dependency graph → Dependabot 无配置错误；
   若 registry 拒绝会邮件/PR 报错，届时修正）。
4. CodeQL 首次扫描完成：在 Actions 里 success，Security → Code scanning 有结果；告警逐条处置并写进报告。
5. 门禁不回归：`npx tsc --noEmit` / `npm test` / `design:check` / `format:check` / `check:versions` 全绿。

## 后续（本记录不做）

- 等 Dependabot 第一批 PR 出来后，再决定是否引入 `groups` 之外的自动 label/assignee 规则。
- 若将来有官网，再填 homepage 与更多 topics。

## 变更履历

- 2026-11-15 created (lead)：本轮 goal 授权「批准一切必要请求与最佳方案；可新增/调整 GitHub Actions 版本；
  可新增仓库治理文件（SECURITY.md / CONTRIBUTING.md / issue 模板 / Dependabot / CodeQL 等）」直接置为
  approved（reviewer=LeeCM），授权来源即本 goal 的授权文字。
- 2026-11-15 implemented：文件与仓库设置落地，首次 CI/CodeQL 结果见发布报告 §15。
