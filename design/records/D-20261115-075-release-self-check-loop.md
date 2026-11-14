---
id: D-20261115-075
date: 2026-11-15
title: 发布侧自检闭环：tag 钉住触发提交 / 空 notes 兜底 / .sha256 资产 / release:check 收尾
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [.github/workflows/release.yml, scripts/check-release.mjs, scripts/check-release.test.mjs, design/records/D-20261115-075-release-self-check-loop.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

0.2.1 的发布链路已经真实跑通（Release 有 exe/sig/msi/latest.json，公网 200，签名与公钥配对校验通过），
但「发布后自检」是发布之后**人工**在开发机跑的一次性动作，而不是流水线门禁。具体有四个缺口：

1. **tag 目标不可控**：workflow 里用 `gh release create "$env:RELEASE_TAG" ...`（不带 `--target`），
   GitHub 会把 tag 指向**创建那一刻默认分支 HEAD**。发布期间只要再往 main push 一条 docs 提交，
   tag 就会落在「二进制构建提交之后」的提交上——0.2.1 已经出现过类似情况（tag → `8ac03c9`，
   二进制构建自 `fae5a0b`），当时只能靠发布报告如实解释，无法从机制上保证。
2. **空 notes 会炸**：`gh release create --notes "$env:RELEASE_NOTES"` 与
   `node make-latest-json.mjs --notes "$env:RELEASE_NOTES"` 在 notes 为空时，PowerShell 5.1 / pwsh
   会把空字符串参数吞掉，变成「参数缺少值」类错误。当前触发都带 notes 所以没暴露，但这是流水线的
   隐藏地雷（verifier 在 0.2.1 复查里也点过）。
3. **没有安装包校验文件**：Release 只有 exe / sig / msi / latest.json。用户或企业内部要核对下载完整性，
   只能去 GitHub 资产 API 看 digest；应该直接随 Release 上传标准的 `.sha256` 校验文件。
4. **自检不在流水线里**：`npm run release:check`（11 项）是发布后人工跑的命令；跑不跑、结果如何，
   Actions 不知道。发布流水线自己声称成功、而 Release 实际不可用时，CI 仍是绿的。

## 设计决定

把「发布后自检」从人工动作升级成**发布流水线的最后一步（失败即红灯）**，并补齐上述三个地雷：

1. **tag 钉住触发提交**：`gh release create ... --target "$env:GITHUB_SHA"`。tag 永远指向本次
   workflow run 的 checkout 提交，与「二进制由哪个提交构建」严格一致；发布期间再 push 也不会漂。
2. **notes 一律走文件**：先把 `$env:RELEASE_NOTES` 写入 `release-notes.md`（UTF-8），
   `gh release create --notes-file` 与 `node scripts/make-latest-json.mjs --notes-file` 都读这个文件。
   空 notes 时文件为空，命令本身仍合法（不再依赖 shell 的空字符串参数行为）。
3. **上传 `.sha256`**：发布步骤用 `Get-FileHash -Algorithm SHA256` 生成 GNU 风格
   `<hash>  <文件名>` 的 `BlockHabit_<ver>_x64-setup.exe.sha256`（MSI 存在时同样生成一份），
   与 exe/sig/msi 一起作为 Release 资产上传。
4. **release:check 进流水线**：workflow 最后一步执行
   `node scripts/check-release.mjs --version <ver> --download`，带 10 次 × 15 秒重试（CDN 传播与
   Release 索引有秒级延迟），任一次成功即绿，10 次都失败则 throw（红灯）。
5. **release:check 增加 .sha256 判定**：资产清单要求 `x64-setup.exe.sha256` 存在；其内容里的 hash
   必须与 GitHub 记录的 digest 一致；`--download` 时仍额外下载安装包现算 sha256 比对
   （原有判定保留，不放宽）。

## 取舍与被否方案

- **否掉「只改文档提醒发布期间别 push」**：靠人记规则就是下一次事故；`--target` 是 gh 自带参数，零成本。
- **否掉「在 workflow 里用内联 pwsh 手写 HTTP 校验」**：仓库已经有 9 例单测的 `check-release.mjs`，
  再写一份等于两套判定迟早漂移；流水线直接复用同一条命令。
- **否掉「让 release:check 在 Actions 里跑但不阻断」**：不阻断等于没有门禁；发布失败必须红灯。
- **否掉「重试放到脚本里」**：脚本是「给定事实 → 判定」的纯工具，发布后人工跑时不该自己睡 150 秒；
  重试是流水线对 CDN 延迟的让步，放在 workflow 步骤里更合适。
- **否掉「把 .sha256 做成必需资产但只在 --download 才校验」**：没有 --download 时也能拿 GitHub digest
  比对，成本几乎为零，直接做进默认路径。

## 影响面

- 只改发布工具链：`.github/workflows/release.yml`、`scripts/check-release.mjs`、
  `scripts/check-release.test.mjs`；不改任何产品运行时代码、不改版本号、不新增依赖。
- Release 资产从 4 个变成 5 个（exe / sig / msi / latest.json / exe.sha256）。
- 发布后自检项：带 `--download` 时 11 → 13 项（新增 .sha256 资产存在 + 内容与 GitHub digest 一致，原有实测哈希保留）；不带 `--download` 时 10 → 12 项。
- 对已发布的 v0.2.1 不会回溯补资产；新规则只对 v0.2.2 及以后生效。

## 验收标准

1. `npm test` 中 `scripts/check-release.test.mjs` 全绿；新增/更新用例覆盖：
   缺 `.sha256` 资产会失败、`.sha256` 内容与 digest 不一致会失败、正常事实 0 失败。
2. release workflow 语法可被 `actionlint` 类检查接受（本仓库无 actionlint，靠一次真实 v0.2.2 发布验证）。
3. v0.2.2 发布后：`gh release view v0.2.2` 资产含 `BlockHabit_0.2.2_x64-setup.exe.sha256`；
   workflow 的「Verify release (release:check)」步骤 success；`npm run release:check -- --version 0.2.2 --download` 13/13 通过。
4. tag `v0.2.2` 指向触发 workflow 的那个提交（`git rev-parse v0.2.2` 与 workflow run 的 head SHA 一致）。

## 后续（本记录不做）

- 给 `createUpdaterArtifacts` 之外的产物（MSI）也接 updater 清单（当前 updater 只发 NSIS exe，符合 Tauri 约定）。
- 自动更新闭环的真机验证仍是 T6（见 `docs/release/real-device-acceptance.md` §6），本记录不涉及。

## 变更履历

- 2026-11-15 created (lead)：本轮 goal 授权「批准一切必要请求与最佳方案；可修改并 push main；可新增/调整
  GitHub Actions 版本；可新增仓库治理文件…」直接置为 approved（reviewer=LeeCM），授权来源即本 goal 的授权文字。
- 2026-11-15 implemented：release.yml 增加 `--target $GITHUB_SHA` / `--notes-file` / `.sha256` 资产 /
  末尾 `release:check`（带重试）；`check-release.mjs` 增加 .sha256 资产与内容判定，同步更新单测。
