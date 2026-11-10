---
id: D-20261110-039
date: 2026-11-10
title: 端到端集成验证：完整 tauri build 通过，E1/E4 声明复核无回退
status: proposed
owner: lead
surface: []
axioms: []
files: []
supersedes: []
reviewer: pending
---

## 背景与目的

经过 31 轮改造（`iso.ts` 拆四模块、`ui.css` 拆五个入口、Rust 退出握手、字体瘦身、字号/动效令牌化、零新增依赖），需要一个**端到端的真实出包验证**：不只是 `tsc` 与单测绿灯，而是「桌面端能不能真的打出来、体积是否仍符合记录」。

## 验证结果（`npm run tauri build`，2026-11-10）

| 项目 | 结果 | 与记录对照 |
| --- | --- | --- |
| 构建 | **成功**，Rust release 1m29s，两个安装包均产出 | — |
| NSIS 安装包 | **7.23 MB** | `D-20261110-014` 记录 7.22 MB（四舍五入内） |
| MSI 安装包 | **8.34 MB** | 记录 8.34 MB，一致 |
| 主程序 exe | **16.12 MB** | 记录 16.11 MB（+0.01） |
| `dist` | **5.44 MB / 213 文件** | 记录 5.42 MB / 212（+0.02 MB / +1 文件） |

体积小幅增长来自这 31 轮新增的实际功能代码（诊断包、瞬时提示 hook、iso 四模块拆分后的模块边界、热图灰阶、F2 完成态文案等），**远小于 E1 省下的 4.2 MB**，E1 的结论（安装包 −37%）依然成立。

## 构建期告警（逐条判断）

| 告警 | 影响 | 处置 |
| --- | --- | --- |
| `Some chunks are larger than 500 kB` | 主 JS chunk 实测 **497 kB**，尚未超限，但已贴近阈值 | 记为后续优化项（代码分割 + `manualChunks`），不属于本轮范围 |
| `dynamic import will not move module into another chunk` | 仅提示某个模块同时被静态与动态引用 | 无功能影响 |
| `STATIC_VCRUNTIME is deprecated` | Tauri 2 配置项迁移提示 | 可另行改为 `build.windows.staticVCRuntime`；纯配置清理 |

## 取舍与边界

1. **只验「能否出包 + 体积」，没有做「安装后手动点击」**：GUI 交互在本机无法自动化；运行时行为已在各轮通过 `npm run dev` + agent-browser 验证（含画布像素采样）。安装包的人工冒烟测试仍需人类在真机上做一次。
2. **没有为了减小 chunk 而重构入口**：代码分割属于新的工程决策（会影响首屏加载策略），应单独成记录，而不是在验证轮里顺手改。

## 影响面

- 无代码改动；产物重新生成于 `src-tauri/target/release/bundle/`。
- 文档：`design/REVIEW-QUEUE.md` 已补入 `D-20261110-038`。

## 验收标准

- `npm run tauri build` 退出码 0，两个 bundle 路径均存在；
- 体积与上表一致；
- `npx tsc --noEmit` / `npm test` / `npm run design:check` 保持全绿。

## 变更履历

- 2026-11-10 created (lead)
