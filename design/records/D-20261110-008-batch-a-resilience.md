---
id: D-20261110-008
date: 2026-11-10
title: 实施 A4（ErrorBoundary + 全局错误捕获 + 本地崩溃日志）、A5a（旧档导入可达）、A6（损坏档不静默清空）
status: approved
owner: lead
surface: [today, build, stats, settings]
axioms: [A4, A6]
files: [src/components/ErrorBoundary.tsx, src/platform/errorLog.ts, src/main.tsx, src/components/SettingsDialog.tsx, src/storage/adapter.ts, src/storage/tauriStorage.ts, src/store/appStore.ts, src/App.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

继续 `D-20261110-006` 的批次 A。P0 修复（`D-20261110-007`）解决「别把好数据弄坏」，本记录解决「坏了以后怎么办」：

1. **A4** 全仓无 ErrorBoundary、无全局错误捕获、无崩溃日志——任何渲染异常都会整树卸载；2026-10-03 曾发生过「纸白主题缺令牌导致 canvas 抛异常白屏」这类 P0，而上线后**没有任何兜底面**。
2. **A5a** 设置页导入预检直接用 `validateState`，而 v1 旧档的 `dayClaims: string[]` 在 v2 校验下非法 → **合法旧备份无法从 UI 恢复**（`importData` 内部其实已走 `prepareImport`，只是预检把它挡在门外）。
3. **A6** 存档损坏时静默清空：原文虽写进 `.corrupt-backup`，但用户看不到任何提示，会以为「习惯全丢了」。

## 设计决定

### A4 兜底三件套（零视觉语言改动）
- **`src/components/ErrorBoundary.tsx`**：class 组件 + `variant: 'full' | 'tray'`。降级 UI **只使用现有令牌**（`--bg/--surface/--ink/--ink-2/--line/--r-md/--r-lg/--r-pill` + 既有 `.btn.primary`），一块黑白卡片 + 1px 细线 + 胶囊按钮；托盘变体压到 240×172 内可读。**未新增任何颜色、阴影、圆角档位、字体或动效**。
- **`src/platform/errorLog.ts`**：`installGlobalErrorHandlers()`（`window.onerror` + `unhandledrejection`）+ 内存环形缓冲 30 条 + `localStorage['blockhabit-crash-log']` 持久化（写失败静默）+ `downloadDiagnostics()`（日志 + UA + 版本 → Blob 下载）。**不上传、不发网络请求**（A7 本地优先）。
- **`src/main.tsx`**：`installGlobalErrorHandlers()` 在所有初始化之前调用；`<ErrorBoundary variant={isTrayMenu ? 'tray' : 'full'}>` 包住 StrictMode 子树（主窗与托盘窗都覆盖）。
- i18n：`errorBoundary.*` 新增 4 个 key，zh/en/types 三处同步，无内联三元。

### A5a 旧档导入可达
- `SettingsDialog.doImport` 的预检从 `validateState(JSON.parse(text))` 改为 `prepareImport(JSON.parse(text))`：v2 档严格校验、v1 档先迁移再校验、损坏/未来版本拒绝。
- 未改 `importData` 内部（它早已使用 `prepareImport`），因此导入路径现在**两端一致**。

### A6 损坏档提示
- `LoadResult` 新增 `corruptRecovered?: boolean`；两个适配器在「JSON 解析失败、已写 `.corrupt-backup`」分支返回 true。
- `initPersistence` 据此置 `dataCorrupt: true`（照常以空态启动，**不挂起持久化**：损坏档本身已不可用，用户需要能继续记账）。
- `App.tsx` 用既有 `.toast` 样式提示 `t.settings.corruptRecoveredToast`（zh/en 同步），指引用户去设置里导入备份。

## 取舍与被否方案

1. **否决「损坏时也挂起持久化」**：与 A1 不同——A1 是「读不出来但可能没坏」，必须保护；A6 是「确认坏了且已备份」，挂起会让用户无法继续使用。
2. **否决「兜底页做插画/大图标/重试动画」**：那会引入新的视觉语言，违背 A2/A4；兜底页理应是最朴素的一块白卡片。
3. **否决「崩溃日志走 Tauri fs」**：需要新增 capability 与异步初始化，收益小；`localStorage` 在 Tauri WebView2 同样持久，且导出走 Blob 即可。
4. **否决「把崩溃日志上报远端」**：违背 A7；仅本地留存 + 用户主动导出。

## 影响面

- 代码：新增 `ErrorBoundary.tsx`、`platform/errorLog.ts` 与两组测试；修改 `main.tsx`、`SettingsDialog.tsx`、`storage/adapter.ts`、`storage/tauriStorage.ts`、`store/appStore.ts`、`App.tsx`、i18n 三处。
- 用户可见：**仅在异常路径**出现一块黑白兜底卡片与一条 toast；正常路径零变化，美术风格零变化。
- 性能：全局错误监听是 O(1) 回调；崩溃日志上限 30 条，无网络、无轮询。

## 验收标准

- `src/components/ErrorBoundary.test.tsx`（覆盖：子组件抛错渲染降级 UI、重载按钮、崩溃被记录、托盘变体紧凑）与 `src/platform/errorLog.test.ts`（覆盖：环形缓冲 30 上限、localStorage 写失败不抛、导出文本含版本与 UA）——**12 例全绿**。
- `src/storage/adapter.import.test.ts`：v1 档经 `prepareImport` 迁移成功且 `dayClaims` 由 `string[]` 变为结构体、`checkIns` 回填 `blueprintId`；损坏档被拒绝。
- `src/storage/tauriStorage.test.ts`：损坏档返回 `corruptRecovered: true` 且原文写入 `.corrupt-backup`。
- 全量：`npx tsc --noEmit` **0 错误**；`npm test` **47 文件 / 390 用例全绿**；`npm run design:check` 通过。

## 变更履历

- 2026-11-10 created (lead) —— A4 由 fix-boundary 实施、A5a/A6 由 lead 实施，全部通过验证

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
