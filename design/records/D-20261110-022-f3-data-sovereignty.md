---
id: D-20261110-022
date: 2026-11-10
title: 实施 F3：数据主权 —— 应用内备份列表、一键恢复、打开数据目录
status: proposed
owner: lead
surface: [settings]
axioms: [A6, A7]
files: [src/storage/backups.ts, src/storage/backups.test.ts, src/components/SettingsDialog.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

审计 F3（P1）：项目宣称「本地优先、无账号」，但**磁盘上的备份对用户完全不可见**：

- 自动备份（`blockhabit-backup-*.json`，保留 5 份）只在「覆盖导入」时才产生，用户既不知道它存在、也没有任何入口恢复；
- `blockhabit.json.corrupt-backup`（存档损坏时的原文）更是只写不读；
- 用户唯一的兜底是「导出 JSON」——那需要自己选个地方存好，等于把数据安全外包给用户记忆；
- 没有「打开数据目录」，想手动看一眼存档只能靠猜路径。

对一个「数据只属于你」的产品来说，这等于**把主权写在了文档里，而不是做在了界面上**。

## 设计决定

### 1. 新增 `src/storage/backups.ts`（纯 IO 层，全部动态 import）
| 函数 | 作用 |
| --- | --- |
| `listBackups()` | 列目录 → 只挑 `auto` / `manual` / `corrupt` 三类 → 按时间从新到旧；`corrupt` 无时间戳排最后；`stat` 失败时 size 记 0 不报错 |
| `readBackup(name)` | 读文件 → `prepareImport()` 严格校验（v1 旧档自动迁移）→ 失败返回 null |
| `createBackup(state)` | 写 `blockhabit-manual-<stamp>.json`，**手动快照单独保留 5 份**（不与自动备份互相挤占） |
| `openDataDir()` | `plugin-opener` 的 `openPath(appDataDir())` |

时间戳不读文件 mtime（`readDir` 在 Tauri 2 里不返回），而是从文件名反解：`blockhabit-backup-2026-11-10T03-40-12-345Z.json` → `Date.UTC(...)`，并配了 3 条单测覆盖合法/非法/综合名。

### 2. 恢复流程完全复用既有导入管线
`doRestoreBackup(name)` 只做两件事：读档 + 设 `importCandidate`。之后走的还是**原来那条经过审计的路径**：确认弹窗 → 覆盖前自动备份当前数据 → `importData()` → 重建积木。**没有第二套覆盖逻辑。**

### 3. UI 只在桌面端出现
备份是磁盘概念，浏览器端状态在 `localStorage`，所以整组挂在 `inTauri` 下。组内三块：`立即备份` / `打开数据目录` 两个按钮；`可恢复的备份` 列表（时间 · 大小 · 类型徽章 · 恢复按钮）；空态提示说明「每次覆盖导入前都会自动留档」。

## 取舍与被否方案

1. **否决「用 Rust 新增 list/restore 命令」**：`plugin-fs` 与 `plugin-opener` 已在依赖里且已注册，前端直接调用即可；加 Rust 命令等于多一层要维护的桥，收益只是「dir 路径在 Rust 侧算」，不划算。
2. **否决「手动备份也进自动备份的 5 份轮转」**：用户主动点的快照被自动轮转删掉是最反直觉的行为，因此用独立前缀 + 独立保留策略。
3. **否决「恢复时直接覆盖、不弹确认」**：恢复是破坏性操作（会替换当前数据），必须复用既有的「覆盖前自动留档 + 二次确认」。
4. **否决「corrupt-backup 不列出来」**：它是用户最后的救命稻草，哪怕恢复大概率失败也要让它可见 —— 读不出来时给明确提示而不是静默消失。

## 影响面

- 代码：新增 `backups.ts`（约 150 行）+ `backups.test.ts`（12 例）；`SettingsDialog.tsx` 新增一组 UI 与 4 个函数（约 60 行）；i18n 两种语言各 +13 键。
- 用户可见：**桌面端设置页新增「备份与恢复」组**（浏览器端不显示，故 Web 预览逐像素无变化）。
- 风险：恢复走既有导入管线，风险面与「手动导入 JSON」相同且额外有自动留档。

## 验收标准

### 自动化（已通过）
- `src/storage/backups.test.ts` **12 例**：文件名时间戳解析（合法/非法）；三类识别；列表过滤 + 排序 + `stat` 失败降级 + 读目录失败返回空数组；`readBackup` 校验通过与拒绝损坏档、**接受 v1 旧档并迁移**；`createBackup` 写入 manual 前缀并轮转删旧；非桌面环境三个函数全部短路且不触达 FS；`openDataDir` 调用正确路径。
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **59 文件 / 472 用例全绿**。

### 浏览器实测（`npm run dev` + agent-browser）
- 打开设置弹窗：`{ dialog: true, hasBackupGroup: false, hasExport: true, inTauri: false }` —— 备份组正确**不出现**在浏览器端，导出/导入仍在，无回归（截图 `.tmp-verify/f3-settings.png`）。

### 需人工验收（桌面端）
1. `npm run tauri dev` → 设置页应出现「备份与恢复」；
2. 点「立即备份」→ 列表立刻多出一条「手动」；
3. 点「打开数据目录」→ 资源管理器打开 `%APPDATA%\..\blockhabit`；
4. 对一条「自动」备份点「恢复」→ 确认弹窗 → 确认后数据回到那一刻。

## 变更履历

- 2026-11-10 created (lead)