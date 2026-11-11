---
id: D-20261111-069
date: 2026-11-11
title: 手动检查更新入口（关于页设计草案；发布链路未启用，暂不实现）
status: approved
owner: lead
surface: [settings]
axioms: [A7]
files: [src/components/AboutPanel.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, design/SURFACES.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

C4 评估（`docs/release/updater-and-keyring-assessment.md`）结论：Tauri 2 updater 技术上可行，但当前仓库没有 updater 插件、没有签名密钥、没有发布端点、没有 release workflow，且按规则不得擅自新增依赖。评估同时建议把「手动检查更新」先做成**设计记录**（C4「现在可做」第 ② 项），等依赖与发布链路获批后再实现，避免届时临时拍脑袋决定交互与文案。

产品原则是本地优先、无账号、无遥测：**不做启动自动检查、不做静默下载**；联网只能由用户显式点击触发。

## 设计决定

- 入口位置：设置 → 「内容路线/关于」分组内新增一行「版本与更新」。显示当前版本号（来自构建版本，不硬编码），右侧为「检查更新」按钮。
- 状态机（纯展示，未来接 updater API）：
  1. `idle`：显示版本号 + 「检查更新」；
  2. `checking`：按钮禁用并显示「检查中…」，可取消（AbortController；取消后不显示失败）；
  3. `up-to-date`：诚实显示「已是最新版本」并附检查时间；
  4. `available`：显示新版本号/发布说明摘要 + 「下载并安装」（安装模式 passive，需退出前存档握手）；
  5. `error`：显示可复制的错误详情（脱敏），不伪装成「已是最新」。
- 发布链路未启用时：按钮保持禁用，行内如实说明「自动更新尚未启用，需在发布链路获批后开启」；不得出现点了没反应的静默按钮。
- 网络纪律：只有用户点击「检查更新」才发起请求；不携带任何账号/设备标识；不上报成功率遥测；请求失败不阻塞应用、不反复重试。
- 视觉：沿用 AboutPanel 现有行样式（1px `--line` 分隔、`--fs-small/--fs-caption`、`--ink/--ink-2`），不新增颜色/阴影/控件类型。

## 取舍与被否方案

- 否掉「启动自动检查」与「后台定时检查」：违背本地优先与「主路径不强制联网」，且会引入未披露网络行为。
- 否掉「静默自动下载安装」：用户不可预期；updater 只在用户确认后执行。
- 否掉独立「更新」页面：设置页已足够，不扩大导航层级（SURFACES §14 不新增表面）。
- 否掉 toast-only 提示：版本信息需要可回看，行内常驻更诚实。
- 否掉在未获批时先接插件：C4 明确依赖/签名/端点均需人类批准。

## 影响面

代码（获批后）：AboutPanel 增加版本与更新行、i18n 三文件、纯状态机逻辑与单测；主进程需 updater 插件与 capabilities。设计文档：SURFACES §6 设置页补一行。不改变存档格式、不改变 contentVersion/schemaVersion。

## 验收标准

1. 四主题（light/dark/oat/fog）× zh/en 下版本与更新行样式正确、无新颜色。
2. 未启用发布链路时按钮禁用并有诚实说明；点击不发起网络请求。
3. 状态机 idle/checking/up-to-date/available/error 的纯逻辑单测；取消不误报失败。
4. 只有用户点击才发请求；错误详情脱敏可复制；不伪装「已是最新」。
5. 依赖未获批前**不写实现代码**；获批后按本记录实现并更新 SURFACES/CHANGELOG。

## 变更履历

- 2026-11-11 created (lead)：C4「现在可做」第 ② 项（仅设计记录，proposed，reviewer=pending）。依赖（updater/process）、签名密钥、发布端点、CI secrets 仍需人类批准。
- 2026-11-11 人类确认（LeeCM）：按用户「批准你的所有内容，继续完成」指示，status proposed → approved；本轮开始实现。
- 2026-11-11 实现（c4-updater，task-9）：新增 `@tauri-apps/plugin-updater@2.14.1` + `@tauri-apps/plugin-process@2.4.0` 与 Rust `tauri-plugin-updater`/`tauri-plugin-process`，lib.rs 注册插件，capabilities 加 `updater:default`/`process:default`，tauri.conf.json 加 `plugins.updater` 占位（pubkey/endpoints 为空；空值经 updater 2.14.1 Config 反序列化接受，未开启 `createUpdaterArtifacts`）；新增 `src/platform/updater.ts` 适配层（isUpdaterEnabled/checkForUpdate 四态/installUpdate/取消只忽略迟到结果）与 AboutPanel「版本与更新」行（idle/checking/latest/available/error，未启用时按钮禁用 + updateDisabled 诚实说明），i18n 未改（Key 由 Lead 提供）；测试 `src/platform/updater.test.ts` 9 例 + `src/components/AboutPanel.test.tsx` 原 3 例 + 新增 6 例全绿；`npx tsc --noEmit` 0；`npm run tauri build -- --no-bundle` 结果见 `.tmp-c4/report.md`。默认构建（未设 `VITE_UPDATER_ENABLED`）不 import 插件、不发任何请求。**仍 blocked（需人类提供）**：签名私钥生成与保管（`npx tauri signer generate`，公钥填 pubkey、私钥只进 CI secrets/离线备份）、发布端点 URL、`latest.json` 托管、CI release secrets、Windows Authenticode 代码签名；启用前还需补 Rust `on_before_exit` 存档握手与真机验收。keyring 仅更新评估文档的实施状态（设计+迁移方案，未接依赖、未改存储格式）。
