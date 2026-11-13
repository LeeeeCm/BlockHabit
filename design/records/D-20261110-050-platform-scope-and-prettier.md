---
id: D-20261110-050
date: 2026-11-10
title: F10 平台范围决议（移动端=实验）+ F5 收尾（Prettier 作用域化接入，ESLint 说明为何不接）
status: approved
owner: lead
surface: []
axioms: []
files: [README.md, package.json, .prettierrc.json, .prettierignore]
supersedes: []
reviewer: LeeCM
---

## 背景

优化方案最后两项：
- **F10**（P3）原文就是「明确取舍：要么 6 个月内出移动构建，要么把移动端标为「实验」并停止投入」——属决策项；
- **F5**（P2）要求「加 ESLint(flat) + Prettier（仅新文件）+ 补 LICENSE/CHANGELOG」，其中 LICENSE/CHANGELOG/CI 已完成，只剩 lint/format。

人类回复「都按照你的建议」，本轮按以下建议落地。

## 决议一：移动端标为「实验」，不再投入（F10）

理由：
1. 本项目定位是**桌面端**——托盘、单实例、关窗存档握手、原生通知、备份目录全部只在 Windows 路径验证过；
2. 移动构建需要一条独立流水线 + 安全区适配 + 触摸目标尺寸复查，是「一轮完整工作」，不是收尾项；
3. 代码里已有响应式布局与触摸手势（8 个文件 49 处引用），**保留但冻结**，不做删除（AGENTS §2 禁止物理删除设计性资产）。

落地：README 新增「平台范围」小节，明确桌面为唯一正式目标、移动为实验态。

## 决议二：Prettier 作用域化接入，ESLint 不接（F5）

### 接入 Prettier
- 配置 `.prettierrc.json` 刻意**对齐现有代码风格**（单引号、无分号、100 列、无尾逗号、箭头参数带括号），避免产生「全仓重排」的噪声 diff；
- `npm run format:check` **只覆盖本轮及以后新增/改写的模块**（`iso*` / `scene*` / `showcaseLayout` / `framing` / `blockHints` / `builds` / `repairBricks` / `useTransient` / `http` / `diagnostics` / `backups` / `BrickInspectPopover`）；
- 先跑 `--write` 把 13 个新文件对齐（纯空白改动），全量测试保持 604 例绿。

### 为什么不接 ESLint（诚实说明，不是偷懒）
1. 本仓库有约 20k 行既有代码，未按任何统一规则书写；接上 `typescript-eslint` 推荐集会产生**数千条存量告警**；
2. 两条出路都不可接受：全仓自动修复 = 一次与功能无关的巨大 diff（违反 AGENTS §4「不发格式化无关文件」）；或者把规则集削到只报真错误 = 变成装饰品；
3. 真正的质量闸门已经存在：**类型检查 + 604 条测试 + 设计台账守门测试 + 视觉像素回归**，这些比风格 lint 更能拦住问题；
4. 因此本轮只接 Prettier（作用于新代码），把 ESLint 留作「若要引入，必须先做一轮全仓格式化并单独评审」的后续项。

## 影响面

- 代码：13 个新模块按 Prettier 格式化（**仅空白/换行**）；vite.config.ts 同步；
- 工程：新增 1 个 devDependency（prettier）、2 个配置文件、2 个 npm 脚本；
- 文档：README「平台范围」新增、WebDAV 限制改写（F4 已落地）、内容上限补完成态说明。

## 验收标准

- `npm run format:check` 通过（All matched files use Prettier code style）；
- `npx tsc --noEmit` 0 错误；`npm test` **72 文件 / 604 用例全绿**（格式化未改变行为）；
- `npm run design:check` 通过（50 条记录）。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
