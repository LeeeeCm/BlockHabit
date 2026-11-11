---
id: D-20261110-061
date: 2026-11-10
title: WebDAV 服务商预设 + 分步连接自检
status: approved
owner: lead
surface: [settings]
axioms: [A7]
files: [src/sync/providers.ts, src/sync/diagnose.ts, src/sync/webdav.ts, src/sync/useSync.ts, src/platform/http.ts, src/components/SettingsDialog.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

多设备同步是「敢不敢长期用」的承诺，但当前配置要求用户自己拼 WebDAV URL、理解 401/403/CORS，失败后只有少量人话提示。Joplin/Obsidian Remotely Save 等同类产品均以「服务商预设 + 应用专用密码 + 测试连接」降低门槛。

## 设计决定

设置页 WebDAV 组改为：选择服务商（Nextcloud / 坚果云 / 群晖 / 通用）→ 填服务器、用户名、应用专用密码 → 测试连接。自检分五阶段：地址规范化 → TLS/可达 → 认证 → 读/写/删临时文件 → 清理；每阶段 ✓/✕ + 人话 + 下一步，可取消，单阶段 10s 超时。预设与 endpoint 生成放 `sync/providers.ts`，阶段判定放 `sync/diagnose.ts`（注入 transport 便于单测），复用 `platform/http.ts`（桌面原生 HTTP 绕过 CORS）与 `webdav.ts` 的请求封装。密码仍存 localStorage（现状），UI 明示风险并引导应用专用密码，提供清除凭据；keyring 单独立项。详见方案 §3.3。

## 取舍与被否方案

- 否掉自动探测服务商：需要第三方请求、泄露端点且不可靠。
- 否掉 OAuth：WebDAV 无统一 OAuth，且引入账号依赖。
- 否掉本轮上 keyring：新依赖与迁移成本高于先把连通性做对。
- 否掉隐藏错误细节：用户需要复制给服务商排障；但必须脱敏。

## 影响面

新增 providers/diagnose 模块与单测；设置页 WebDAV 组重构；错误码映射与 i18n；不改变同步数据格式。

## 验收标准

provider URL 生成单测；diagnose 覆盖 200/401/403/404/405/507/超时/TLS；错误文本不含密码；真实 Nextcloud/群晖各连通一次（人工）；浏览器预览不发起测试；四主题与键盘可完成全流程；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §3）：自检必须独立于同步合并、成功要有正向文案；TLS/DNS 在 JS 侧只能按错误文本启发式归类；http:// 端点会被 CSP 拦截，需明确文案（并顺手修正 zh 文案里「桌面端直连通道还在开发中」与 D-048 已落地的原生 HTTP 冲突）；401 文案必须点名「两步验证请用应用专用密码」，补自签证书/特殊字符分支；凭据缓解采用「应用密码提示 + rememberPassword + 不回显 + 清除凭据 + 错误脱敏」，不引 keyring；需导出 `encodeUrlPath` 供诊断复用。
- 2026-11-10 实现（innovation-engineer + lead 接线）：`src/sync/providers.ts`（13 tests）、`src/sync/diagnose.ts`（31 tests，transport 注入、五阶段、脱敏、临时文件清理）、`webdav.ts` 导出 `encodeUrlPath`；SettingsDialog 服务商预设 + 分步结果 + 复制/清除 + 浏览器端拦截；zh/en 文案与 CORS 旧文案修正；真实 Nextcloud/群晖连通为人工验收项（本轮无凭据）。
- 2026-11-10 独立验证后修复（verifier P3 部分）：UI 改用 `PROVIDER_PRESETS.requiresServer/requiresAppPassword` 接线（固定端点地址只读、应用密码提示按预设显示）；坚果云固定端点切到需自填服务器的预设时先清空地址，避免旧 host 残留；复制诊断详情前用 `sanitizeDiagnosticDetail` 脱敏 endpoint。**保留 follow-up**：诊断取消按钮、rememberPassword 开关、密码 DOM value 属性（React 受控输入既有行为，明文已在 localStorage，属已记录的凭据取舍）、`switchProvider` 与 UI 的统一。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。
- 2026-11-11 B1 技术收尾（lead）：B3 拆分出独立 `WebdavPanel` 后，补齐三件事——① 自检可取消（AbortController；取消后不再发起后续阶段、仍尽力 DELETE 已创建的临时文件，结果 `cancelled=true` 并区分「已取消」与「取消但清理失败」提示）；② `rememberPassword` 开关（关闭时 localStorage 不写密码、读取旧配置时丢弃遗留密码，当前会话内存内继续可用；提示文案如实说明重开需重输）；③ 密码 DOM 缓解（已保存密码永不回填 input.value，placeholder 提示「留空继续使用」，`autoComplete=new-password`）。服务商切换统一为单一 handler，未改预设/端点语义与任何视觉语言。新增单测：diagnose 取消 4 例、WebDAV 配置落盘 5 例、WebdavPanel UI 4 例；`npx tsc --noEmit` 0 错。
- 2026-11-11 B3 收尾（b3-settings）：把 WebDAV 组从 `SettingsDialog.tsx` 抽为独立 `src/components/WebdavPanel.tsx`（服务商预设 / 端点 / 凭据 / 分步自检结果 / 自动同步 / 立即同步及其 state 与 handler），`useSync()` 仍常驻 SettingsDialog 并以 `sync` prop 注入，折叠与自动同步的 hook 生命周期不变；可见文案与 DOM 逐行保留（`onToast` 只转发到原 toast 位置）。新增 `SettingsPanels.test.tsx` 覆盖预设联动、自检浏览器拦截、同步成功/失败 toast 与状态行，为 B1 的取消 / rememberPassword / 密码 DOM 缓解提供干净接口。
