---
id: D-20261110-042
date: 2026-11-10
title: 测试覆盖体检：给积木投影（builds）与蓝图注册表补 18 例单测
status: approved
owner: lead
surface: []
axioms: [A6]
files: [src/logic/builds.test.ts, src/logic/blueprints/index.test.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

做完 41 条记录后，做了一次「哪些模块还没有测试」的体检：

| 目录 | 源文件 | 有测试 | 缺口 |
| --- | --- | --- | --- |
| `src/logic` | 13 | 9 | `blueprints/generators.ts`、`blueprints/index.ts`、`builds.ts`、`useTodayKey.ts` |
| `src/render` | 9 | 3 | 场景组件 2 个 + iso 四模块（颜色/几何有间接覆盖） |
| `src/platform` | 11 | 6 | `detect/haptics/notify/usePlatform`（多为薄封装） |

其中**风险最高**的是两个纯逻辑模块：
- `logic/builds.ts`（121 行）：积木层是「打卡 + 全勤」事实的**确定性投影**，同步合并、导入、撤销打卡都依赖它；容量钳制（A8）与保守移除（A5b）都在这里。此前零测试。
- `logic/blueprints/index.ts`（71 行）：`getBlueprint` 的「未知 id 回落」是 A7「脏数据不白屏」的实现细节，此前零测试。

## 设计决定

### 1. `builds.test.ts`（14 例）
覆盖的是**不变量**，而不是实现细节：
| 组 | 断言 |
| --- | --- |
| `rebuildBuilds` | 只投影有效打卡（墓碑/无块信息被忽略）；全勤块 `bonus:true` 且来源 `__day__`；按 placedAt 升序 + id 决胜、index 连续 0..N-1；**超容量不投影且不改事实**；容量 0 整组不投影；多蓝图按 (blueprintId, index) 稳定排序 |
| `buildsMatchFacts` | 等价 → true；多出无法推导的块 → false（重建会丢数据）；同 id 不同蓝图 → false；**只比 id+蓝图、不比 index**（旧档 index 偏移不应触发重建） |
| `removeBlocksAndCompact` | 删指定块并压实同蓝图 index；跨蓝图各自压实；**保留无法由事实推导的块**（宁可不重建） |
| `BLUEPRINT_CAPACITY` | 与每座蓝图块数一致且覆盖全部蓝图 |

### 2. `blueprints/index.test.ts`（4 例）
- 12 座按 order 全部注册、id 与键一致；
- 每座有块、**同蓝图内坐标唯一**（重复坐标会导致积木重叠，属视觉级错误）；
- `getBlueprint` 已知 id 原样返回；未知 id **回落第一座 + 告警**（用 `vi.spyOn(console, 'warn')` 锁住行为）。

## 取舍与被否方案

1. **没有为覆盖率而写「调用即通过」的测试**：每个用例都断言一个可能被后续改动破坏的**不变量**（排序规则、容量钳制、保守移除的语义）。
2. **暂不给 `builds.ts` 加「合并多端数据」的集成测试**：那属于 `sync/merge` 的职责，已有测试；在投影层重复造集成场景会形成脆弱测试。
3. **`render/` 下的场景组件不写单测**：它们依赖 canvas/DPR/尺寸，单测性价比低；运行时已用「canvas 非白像素采样」验收（多轮记录可查）。

## 影响面

- 新增 2 个测试文件、**18 例**；无生产代码改动。
- 测试规模：64 → **67 文件**，515 → **538 用例**。

## 验收标准

- `npx tsc --noEmit` 0 错误；`npm test` **67 文件 / 538 用例全绿**；
- `npm run design:check` 通过（42 条记录）。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
