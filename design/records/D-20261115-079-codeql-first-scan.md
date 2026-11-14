---
id: D-20261115-079
date: 2026-11-15
title: CodeQL 首次扫描 3 条告警处置：README 表格转义补反斜杠 / WebDAV 服务商识别改为解析 host
status: approved
owner: lead
surface: [settings, build]
axioms: [A1]
files: [src/storage/archiveManifest.ts, src/storage/archiveManifest.test.ts, src/components/WebdavPanel.tsx, src/components/webdavProvider.test.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261115-078 启用 CodeQL（javascript-typescript）后，首次扫描（run 43623021324，commit `ba66e80`）
在 Security → Code scanning 报了 **3 条 warning（security severity: high）**，全部落在既有代码上：

| # | 规则 | 位置 | 提示 |
| --- | --- | --- | --- |
| 1 | `js/incomplete-sanitization` | `src/storage/archiveManifest.ts:239` | 表格转义只替换 `|`，没有转义输入里的反斜杠 |
| 2 | `js/incomplete-url-substring-sanitization` | `src/components/WebdavPanel.tsx:32` | `endpoint.includes('jianguoyun.com')` 判断服务商，host 可出现在 URL 任意位置 |
| 3 | `js/incomplete-url-substring-sanitization` | `src/components/WebdavPanel.tsx:138` | 同上（切预设时判断「当前是坚果云」） |

逐条评估：

1. **真问题（低危但正确性相关）**：`buildBuildingsReadme` 把用户可编辑的「奠基石铭言」写进 Markdown 表格。
   若铭言含反斜杠（例如 `\\|`），只转义 `|` 会让反斜杠先被 Markdown 吃掉，单元格仍可能被拆开/渲染错。
   修复方式：先转义 `\\` 再转义 `|`（顺序不能反）。
2. **真问题（低危）**：`detectProvider()` 用 `endpoint.includes('jianguoyun.com')` 识别坚果云，恶意/异常
   URL（如 `https://evil.example/?x=jianguoyun.com`）会被误判成坚果云预设；同理 `applyProvider` 里的
   「当前是坚果云就清空 endpoint」判断也会被误导。它不是安全边界（只影响设置页预设高亮与是否清空输入），
   但按 CodeQL 建议改为解析 URL 后比较 **host** 是零成本且更正确的做法。
3. 与 2 同一根因，同一处修复。

## 设计决定

1. `archiveManifest.ts`：`foundationNote` 归一化改为
   `.replace(/\\/g, '\\\\').replace(/\\|/g, '\\|').replace(/\\n/g, ' ')`（先反斜杠、再竖线、最后换行）。
   正常铭言（不含 `\\`）输出**逐字节不变**；含反斜杠的铭言渲染更正确。
2. `WebdavPanel.tsx`：新增两个本地纯函数
   `endpointHost(endpoint)`（`new URL().host.toLowerCase()`，非法 URL 返回空串）与
   `isJianguoyunEndpoint(endpoint)`（host 等于 `jianguoyun.com` 或其子域）；`detectProvider` 与
   `applyProvider` 改用它。nextcloud/synology 的识别仍按 **path 标记**（`/remote.php/dav/`、
   `/home/BlockHabit`），不受影响。
3. 两个纯函数 `export` 出来以便单测；新增 `src/storage/archiveManifest.test.ts`（表格转义）与
   `src/components/webdavProvider.test.ts`（host 识别与恶意 URL 回归）。
4. **修复不进入 0.2.2 二进制**（0.2.2 已于 `da20cb6` 发布）：这两处是低危正确性/健壮性改进，
   不影响已发布版本的安全边界；下一次发版会自然带上。已在发布报告 §15.6 如实标注。

## 取舍与被否方案

- **否掉「直接在 GitHub 上 dismiss 这 3 条告警（false positive / won't fix）」**：第 1 条是真问题，
  第 2/3 条按建议改 host 判断成本不到 20 行且有测试可锁；dismiss 会留下「high severity 被人工关掉」的审计噪音。
- **否掉「为 WebDAV 识别引入 URL 解析库」**：浏览器/Node 都自带 `URL`，零依赖。
- **否掉「顺手把 nextcloud/synology 的 path 判断也改成 URL 解析」**：path 用 `includes` 没有 host 伪造问题，
  改动会扩大行为面；本记录只处置 CodeQL 明确指出的两条。
- **否掉「关掉 CodeQL 或改查询规则」**：等于自欺；门禁要保留。

## 影响面

- 两处代码 + 两个新测试文件；无新依赖、无 i18n 文案、无视觉变化、无存档/schema 变化。
- 行为变化仅限：含反斜杠的铭言在 README 表格中渲染更正确；异常 URL 不再误判为坚果云预设
  （正常 URL 行为不变）。
- `npm test` 文件数/用例数增加 2 文件（约 +5 例），其余门禁不回归。

## 验收标准

1. 修复后新的 CodeQL 扫描（push 触发）成功，且 3 条告警全部变为 **fixed/closed**（Security 页不再有 open 告警）。
2. `npx tsc --noEmit` 0；新增测试通过；`npm test` 全绿且用例数只增不减。
3. 既有 `archive.test.ts`（档案包生成）与 `WebdavPanel.test.tsx`（预设切换）不回归。

## 后续（本记录不做）

- 若以后引入更多 Markdown 生成（年鉴/README），统一抽一个 `escapeMarkdownTableCell()` 工具并复用。
- 下一轮发版时把这两处修复带进发布二进制。

## 变更履历

- 2026-11-15 created (lead)：本轮 goal 授权「批准一切必要请求与最佳方案；可修改并 push main…」直接置为
  approved（reviewer=LeeCM），授权来源即本 goal 的授权文字；告警来源为 GitHub CodeQL 首次扫描。
- 2026-11-15 implemented：修复 + 单测，等待下一次 push 的 CodeQL 复扫确认告警关闭。
