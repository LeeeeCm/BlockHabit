# 变更说明

<!-- 做了什么、为什么做；关联 issue 可用 "Closes #123" -->

## 关联设计记录

<!--
视觉 / 交互 / 文案 / 建筑数据 / 品牌资产等用户可见改动，必须先有 design/records/ 记录并人工批准。
纯内部逻辑、构建、测试、文档改动写「不需要」，并说明理由。
-->

- 设计记录 id：
- 不需要设计记录的理由（如适用）：

## 门禁清单

本地与 CI（`.github/workflows/ci.yml`）一致，以下命令必须全绿：

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run design:check`
- [ ] `npm run format:check`
- [ ] `npm run check:versions`

## 硬约束自查（AGENTS.md §3）

- [ ] 未改变视觉语言（黑白灰 + 唯一琥珀点缀、圆润积木、1px 线、不堆阴影）；若改变，已附 approved 设计记录
- [ ] 未引入 UI 组件库（Antd / MUI / Tailwind 等），沿用 `src/components/` + `ui.css`
- [ ] 用户可见文案 zh / en 同时补齐，全部走 `src/i18n/`，未出现内联 `lang === 'zh' ? ... : ...`
- [ ] 新增 / 修改文件 < 800 行；超出的新逻辑已拆到新文件
- [ ] 未提交密钥 / 凭据（WebDAV 密码、`TAURI_SIGNING_PRIVATE_KEY`、token）与构建产物（`dist/`、`src-tauri/target/`、`.tmp*/`）
- [ ] 本地优先未被破坏：没有新增「必须联网」的主路径，无账号、无遥测上传
- [ ] 数据诚实：完成态仍由 `habitMetOnDay` 判定，删除操作已级联回收积木 / 连击 / 全勤

## 测试与验证证据

<!--
贴关键输出：测试文件 / 用例数量、tsc 结果、手测步骤或截图（先打码 WebDAV 地址、账号与个人数据）。
修复 Bug 的 PR 请说明「先写失败用例再修」的过程。
-->

## 发布影响

- [ ] 无发布影响（纯内部重构 / 文档 / 测试）
- [ ] 有发布影响：已更新 `CHANGELOG.md`，并在下方说明影响面与验证方式

<!--
发布由 .github/workflows/release.yml 手动触发；三处版本号（package.json / tauri.conf.json / Cargo.toml）
必须一致，不要在无关 PR 里顺手改版本号。
-->
