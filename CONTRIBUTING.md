# 贡献指南

感谢你愿意参与 BlockHabit——一个**本地优先**的极简黑白风格桌面习惯打卡应用：每次有效打卡掉落一块 2.5D 等距积木，按蓝图拼成建筑。黑白灰为骨，琥珀为魂。

动手之前请先读两份规则文件：

- [`AGENTS.md`](AGENTS.md) —— 仓库级强制规则，AI 代理与人类共同遵守；
- [`design/README.md`](design/README.md) —— **唯一设计入口**：设计公理、四主题令牌、积木美术、界面规格、文案语气、记录台账。

本文件是面向贡献者的摘要；两者冲突时，以 `AGENTS.md` 与 `design/README.md` 原文为准。

## 1. 五条硬约束

| #   | 约束                 | 说明                                                                                                                     |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **不改视觉语言**     | 黑白灰 + 唯一琥珀点缀色、圆润积木、1px 线、不用阴影堆叠；新增颜色 / 渐变 / 阴影 / 圆角档位必须先有设计记录并人工批准     |
| 2   | **不引入 UI 组件库** | `src/components/` + `ui.css` 就是设计系统；引入 Antd / MUI / Tailwind 等于换掉视觉语法                                   |
| 3   | **本地优先**         | 不得引入「必须联网」的主路径；无账号、无遥测上传                                                                         |
| 4   | **双语齐全**         | 所有用户可见文案必须走 `src/i18n/`，zh 与 en 同时补齐；禁止 `lang === 'zh' ? a : b` 内联三元（画布绘制类例外需注释说明） |
| 5   | **数据诚实**         | 完成态只能由规则函数（`habitMetOnDay`）判定；删除数据必须级联回收积木 / 连击 / 全勤                                      |

另外遵守工程约定：**单文件超过 800 行时，新增逻辑应拆到新文件**（大规模重构需先有设计记录）。

## 2. 记录先于代码

任何会改变用户**看得见**的东西的改动——颜色、字体、圆角、间距、图标、布局、动效、文案、建筑数据、品牌资产——都必须先走设计流程：

1. 读 [`design/README.md`](design/README.md) 与设计公理 A1–A7；
2. 查 [`design/RECORDS.md`](design/RECORDS.md)，避免重复已否决的方案；
3. 在 `design/records/` 新建 `D-YYYYMMDD-NNN-*.md`，状态写 `proposed`，写清背景 / 决定 / 取舍 / 影响面 / 验收；
4. 改代码实现；
5. 在 `design/RECORDS.md` 与 `design/index.json` 登记；
6. 跑 `npm run design:check`；
7. 提交人类审核，**`approved` 之后才算完成**。

**`design/` 不可删除**：记录、章节、表格行都是项目记忆。想淘汰就改 `status: deprecated` / `superseded`（全文保留）；确实要物理删除，必须先写 `design/APPROVALS.md` 申请并由人类填 `approved`。**任何情况下不得修改校验脚本绕过 `design:check`。**

## 3. 开发环境

- **Windows 10 / 11**：桌面端是唯一正式目标；托盘、单实例、关窗存档握手、原生通知等只在 Windows 路径上验证。
- **Node.js 22+**：CI 使用 Node 22；仓库提交了 `package-lock.json`，请用 `npm ci` 安装。
- **Rust stable + MSVC 生成工具**：构建 Tauri 2 桌面壳需要；仓库未固定 `rust-toolchain` 版本（`src-tauri/Cargo.toml` 为 edition 2021）。
- **WebView2 Runtime**：Windows 11 自带；Windows 10 若缺失请安装。
- 在 Git Bash 下跑 cargo 需把 MSVC `link.exe` 目录放到 `PATH` 最前（避免命中 coreutils 的 `link`），路径示例见 [README](README.md#开发)。

## 4. 安装与运行

```bash
npm ci               # 按 lockfile 安装依赖
npm run dev          # 浏览器预览（Vite，端口 1420）
npm run tauri dev    # 桌面窗口（首次 Rust 编译约 3–10 分钟）
npm run tauri build  # 出安装包（src-tauri/target/release/bundle/）
```

浏览器预览的 WebDAV 同步受跨域限制，验证同步请用 `npm run tauri dev`（桌面端走 Tauri 原生 HTTP）。

## 5. 提交前门禁

以下命令与 CI（`.github/workflows/ci.yml`）一致，提交 PR 前请在本地全部跑过：

| 命令                     | 检查内容                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`       | TypeScript 类型检查（零错误）                                                         |
| `npm test`               | vitest 单元测试全绿                                                                   |
| `npm run design:check`   | 设计台账一致性 + 未审批删除检测                                                       |
| `npm run format:check`   | Prettier 格式检查（范围见 `package.json`：`src/**` + `scripts/**` + 配置文件）        |
| `npm run check:versions` | 三处版本号一致：`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` |

CI 还会额外跑 `npm run build`（生产构建）。**不要用改测试的方式让 CI 变绿**；修 bug 先写失败用例再修（纯逻辑 `src/logic/**` 必须有 vitest 单测）。

## 6. 发布相关

- 发布由 `.github/workflows/release.yml` **手动触发**：需要三处版本号一致、`plugins.updater` 的签名公钥与端点已配置、`TAURI_SIGNING_PRIVATE_KEY` 等 secrets 就绪。流程见 `docs/release/release-runbook.md`。
- 发布后自检（需要已发布的 Release、可访问公网、已登录的 `gh` CLI）：

```bash
npm run release:check -- --version 0.2.2
# 额外下载安装包并核对 sha256（较慢）
npm run release:check -- --version 0.2.2 --download
```

## 7. 提交规范

- 沿用 conventional 前缀：`feat:` / `fix:` / `perf:` / `refactor:` / `chore:` / `docs:` / `test:`，描述用中文，例如 `fix: 修复跨天撤销打卡后连击不回滚`。
- **一次提交只做一件事**；不要顺手格式化无关文件。
- 不新增依赖（先讨论）；不擅自改版本号（发布时三处版本号必须一致，由维护者统一处理，见第 6 节）；不提交 `dist/`、`src-tauri/target/`、`.tmp*/` 产物。
- 不得用 `git checkout` / `reset --hard` / `clean -fd` 清理他人未提交的成果。

## 8. PR 流程

1. 从 `main` 切出分支，完成改动并跑完第 5 节门禁。
2. 按 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) 填写 PR：变更说明、关联设计记录 id（无则说明为何不需要）、门禁清单、硬约束自查、测试证据、发布影响。
3. 用户可见改动必须附上 `design/records/` 记录（`approved` 或至少已提交审核），并按需更新文档。
4. 等待 CI 全绿与人工 review；合并由维护者执行。
5. Bug 与需求请使用 [Issue 模板](.github/ISSUE_TEMPLATE/)；安全问题请走私密渠道，见 [`SECURITY.md`](SECURITY.md)。

## 9. 文档归口

- 设计类（公理 / 令牌 / 美术 / 界面 / 文案 / 决策记录）→ `design/`；
- 方案与计划 → `docs/superpowers/specs/` 与 `docs/superpowers/plans/`；
- 发布与运维 → `docs/release/`；
- 历史规格是时间快照，只读，不要改写。

## 10. 红线

- 改测试 / 改校验脚本让 CI 变绿 → 视为数据造假，回滚并记录。
- 删除 `design/` 下任何文件、章节、表格行 → 回滚并补 `APPROVALS.md` 流程。
- 改视觉语言而没有人工批准 → 回滚。
- 提交密钥、WebDAV 凭据、个人数据或构建产物 → 拒绝合并且需要轮换密钥。

讨论请聚焦技术与证据：能跑的命令、能复现的步骤、能对上的设计记录。
