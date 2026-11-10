---
id: D-20261110-062
date: 2026-11-10
title: 一键档案包：可读、可校验、可导入的本地档案馆
status: approved
owner: lead
surface: [settings]
axioms: [A6, A7]
files: [src/storage/archive.ts, src/render/archiveCanvas.ts, src/components/ArchiveExportPanel.tsx, src/components/SettingsDialog.tsx, src-tauri/capabilities/default.json, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

现有 JSON 导出/备份/打开数据目录对普通用户不是「拿走就能读」：没有说明、没有建筑图、没有校验。数据主权要同时满足能带走、能读懂、能验证。Apple Health / Spotify / Strava 的批量导出被信任，正因为给的是「文件夹 + 结构化数据 + 说明」。

## 设计决定

设置 → 数据安全新增「导出完整档案包」：生成目录（首选文件夹，ZIP 仅当无依赖 STORE+CRC32 实现可行时作为可选项），包含 README.md、manifest.json（版本/导出时间/文件清单/sha256）、data/blockhabit-state.json（可被现有导入直接读回）+ checksums.txt、buildings/*.png（已落成建筑等距图，透明 2×，固定取景）、可选 yearbook/。桌面端写到 appDataDir/exports 并用现有打开目录能力打开；浏览器回退逐文件下载。生成分片、可取消、失败可重试；不上传、不含 WebDAV 凭据。详见方案 §3.4。

## 取舍与被否方案

- 否掉只导出 JSON：普通用户读不懂。
- 否掉截图 UI：含主题/窗口尺寸/DOM，长期不可读。
- 否掉加密 ZIP：密码丢失即数据丢失；本地明文更符合 A7。
- 否掉自动上传云盘：A7；用户可自行放入同步盘。

## 影响面

新增归档生成模块与离屏建筑渲染、设置页入口与进度 UI、README 模板（zh/en）、i18n；无数据模型变更。

## 验收标准

manifest/checksums 一致；state.json 导入 round-trip 数据一致；已落成建筑图数量正确且透明 2×；取消/磁盘错误不留半成品；浏览器回退可用；四主题与 zh/en；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §4）：**文件夹是权威产物**，ZIP 作为可选副本（STORE+CRC32 约 150–180 行纯 TS，8MB CRC 13ms；DEFLATE 用 CompressionStream 且必须 try/catch 降级 STORE）；桌面端无 dialog 插件，写到 appDataDir/exports 后 rename，失败清理；新增 `fs:allow-write-file`；打开目录用已授权的 `revealItemInDir`，并顺手修 `openDataDir()` 缺 `opener:allow-open-path` 可能静默失败的问题；浏览器固定产出单个 ZIP；`data/blockhabit-state.json` 必须能经 `prepareImport` round-trip；导出前断言不含 WebDAV 密码。
- 2026-11-10 人类在对话中确认按路线图进入 Wave 2（记录仍保持 proposed，状态更新由人类在台账完成）；Wave 2 实现开工。
- 2026-11-10 实现（yearbook-impl）：`storage/archive.ts`（ZIP/CRC32/DEFLATE 降级、SHA-256、round-trip、凭据断言、桌面 tmp→write→rename→清理、browser 单 ZIP）+ 31 tests、`render/archiveCanvas.ts`（640×640 透明 RGBA 建筑图）、SettingsDialog 数据安全面板（进度/取消/打开）；浏览器实测 ZIP 解包/校验和/round-trip/无密码全过；真实 Tauri 桌面导出与 `revealItemInDir` 列人工验收。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。