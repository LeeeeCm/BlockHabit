---
id: D-20261124-085
date: 2026-11-24
title: 从其他应用导入习惯定义（CSV / JSON，预览后确认）
status: proposed
owner: Claude
surface: [settings]
axioms: [A6, A7]
files: [src/logic/habitImport.ts, src/logic/habitImport.test.ts, src/components/HabitImportPanel.tsx, src/components/SettingsDialog.tsx, src/i18n/locales/zh.ts, src/i18n/locales/en/settings.ts, src/i18n/types.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

已有完整 JSON 备份导入，但它只接受 BlockHabit 自己的状态格式。从其他习惯应用迁移时，用户需要先理解并改造整份存档，门槛过高。

## 设计决定

- 新增只导入**习惯定义**的通道（设置 → 数据安全）：CSV 或 JSON，解析后先预览「可导入 N 个 / 跳过 M 个」，用户确认后才写入。
- CSV 表头：`name,frequency,days,times,period,target_minutes,target_value,unit,step,note,category,pinned`；支持中英文表头别名、带引号字段、中文逗号分隔星期。
- JSON 接受 `HabitInput[]` 或 `{ habits: [...] }`；`frequency` 可为字符串（daily/weekly/custom）或对象。
- 推断规则：`target_value + unit` → counter；`target_minutes > 0` → focus；否则 instant。只从既有 `HabitExtra` 取字段，不新增类型。
- 与现有习惯（含已归档）按名称不区分大小写去重；文件内重名、空名、缺 times 的 weekly、缺 days 的 custom 都跳过并在预览里计数。
- 不联网、不引入解析依赖、不写 localStorage；写入走既有 `addHabit`。

## 取舍与被否方案

- 否掉「同时导入历史打卡」：一条历史记录会牵动积木、连击、全勤与容量；必须走完整 JSON 备份导入，不能在这里静默补建（A6）。
- 否掉「自动导入不预览」：命名冲突与格式错误会静默制造脏数据。
- 否掉「支持 Excel/xlsx」：需要新依赖，YAGNI；用户可先导出 CSV。

## 影响面

- 纯逻辑模块 + 一个设置面板；新增 9 条解析测试。
- 中英新增 8 条 `settings.habitImport*` 文案。
- 不改变现有完整 JSON 导入/导出路径。

## 验收标准

1. CSV/JSON 均可解析出习惯定义；非法行被跳过且有原因。
2. 预览显示可导入数与跳过数；未确认前不写入 store。
3. 同名习惯不会被重复创建。
4. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-24 created (Claude)
