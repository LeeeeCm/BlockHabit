---
id: D-20261110-053
date: 2026-11-10
title: 习惯模板：空态提供 5 个一键起步选项，降低第一次创建的门槛
status: approved
owner: lead
surface: [today]
axioms: [A2, A4, A6]
files: [src/logic/habitTemplates.ts, src/components/HabitTemplates.tsx, src/pages/Today.tsx, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, src/i18n/types.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

首启空态（D-20261110-023）已经有三步说明与「新建习惯」按钮，但用户点下去仍要面对完整表单（即使选填项已折叠，仍需命名、选频率、确认）。从「想开始」到「第一块积木落下」之间仍有一次决策成本；产品最想要的第一块积木因此被推迟。

## 设计决定

在空态三步说明下方增加「或者，从这些开始」一行模板胶囊，点一下即创建真实习惯（每日、瞬时打卡），并提示「已建好「喝水」，点卡片完成第一次打卡」：

| 模板 id | 中文 | 默认 |
| --- | --- | --- |
| water | 喝一杯水 | daily / period=any |
| read | 读 10 分钟 | daily / period=evening |
| walk | 走动 5 分钟 | daily / period=any |
| sleep | 按时睡觉 | daily / period=evening |
| ledger | 记一笔账 | daily / period=evening |

模板数据放 src/logic/habitTemplates.ts（纯数据 + 创建参数），名称与说明走 i18n templates 组；组件 HabitTemplates 只负责渲染胶囊与回调 onPick(template)，实际创建仍调用现有的 addHabit。不使用演示数据、不预填进度，符合 A6 与 AESTHETIC §5「不做假数据」。

## 取舍与被否方案

- 否掉「引导式多步建习惯向导」：会把空态变成表单流程，违背 A4 克制；模板是更轻的等价物。
- 否掉模板带目标数值/单位（如 2000ml）：用户在不知道自己想要多少时被塞进一个目标，反而增加修改成本；只保留名称 + 频率 + 时段。
- 否掉 6 个以上模板：一行放不下，且选择过多本身就是摩擦；5 个覆盖身体 / 输入 / 输出 / 睡眠 / 财务。
- 否掉模板创建后自动打开建造页：用户还没打卡，看不到变化；先完成第一次打卡才有意义。

## 影响面

- src/logic/habitTemplates.ts + 单测（创建参数合法、id 唯一）。
- src/components/HabitTemplates.tsx + 今日空态挂载。
- i18n templates 组（zh/en 同步）。
- 不新增依赖、不改数据模型。

## 验收标准

1. 新建空档 → 空态显示 5 个模板胶囊；点「喝一杯水」后习惯列表出现该习惯（每日、任意时段），toast 正确。
2. 模板创建的 Habit 通过现有 addHabit 校验与持久化；刷新后仍在。
3. 键盘 Tab 可逐个聚焦模板，Enter 触发；按钮有可访问名称。
4. 四主题截图无新增色相；窄窗口自动换行。
5. 单测 + tsc + npm test + npm run design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 implemented in worktree (lead); 待人类审核：状态保持 proposed，审核后由人类改为 approved/implemented
- 2026-11-10 实施校正：模板中文名精简为「喝水 / 阅读 / 走动 / 早睡 / 记账」（原表为「喝一杯水 / 读 10 分钟…」，一行放不下 5 枚胶囊）；创建参数与验收其余不变。

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
