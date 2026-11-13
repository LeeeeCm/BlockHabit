---
id: D-20261110-035
date: 2026-11-10
title: 实施 B3 热图灰阶化 + B4 全勤领取反馈修正（失败给原因、bonus 专属文案）
status: approved
owner: lead
surface: [stats, today]
axioms: [A1, A6]
files: [src/components/Heatmap.tsx, src/components/HeatmapColors.test.ts, src/pages/Today.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, design/SURFACES.md, README.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

### B3：热图是第二套色相
`design/AESTHETIC.md` 明确写着：「日历热图：近 13 周，用**灰阶点亮**，`全完成日`才允许满亮。」
而实现走的是「灰 → 蓝 → 绿」色阶（`cellColor` 里 `--progress-green` / `--progress-blue` 混合）。绿色在 A1 里既不是骨也不是魂——它是第二套点缀色，与「唯一点缀色」公理相抵。
（`design/SURFACES.md` 当时写的「灰→蓝→绿」与 AESTHETIC 冲突，本次一并校准。）

### B4：全勤领取无条件庆祝
`Today.tsx` 的领取按钮：调用 `checkInDay()` 后**不管返回什么**都播庆祝音 + 弹「已领取」文案，只额外判断了 `res.complete`。而 `checkInDay` 明明返回 `{ reason, bonus, complete }`：
- 失败（incomplete / already / no-habits）→ 也会显示「已领取」，属于假成功；
- 成功但 `bonus` → 少了一句「这是连击里程碑的点缀色块」的说明。

## 设计决定

### 1. 热图改为灰阶（墨色按完成度叠加）
```
future / no-data → transparent
ratio <= 0     → var(--line)             // 空白天
0 < ratio < 1  → color-mix(in srgb, var(--ink) (15+ratio*60)%, var(--surface))
ratio >= 1     → var(--ink)              // 满亮
```
用「墨色叠在卡片底色上」而不是直接写灰值，两个主题（纸白/墨黑）自动成立。绿色从此只保留给进度条。

### 2. 领取反馈按结果分支
- 失败 → `triggerHaptic('light')` + 对应原因文案（三选一），**不**播庆祝音；
- 成功 → 庆祝音 + 「已领取」；
- 成功且 `bonus` → 文案追加「连击里程碑：这块是点缀色奖励块」。

## 取舍与被否方案

1. **否决「保留绿色但降饱和」**：A1 的约束是**色相数量**，不是饱和度；降饱和仍是第二套色相。
2. **否决「用琥珀（accent）做热图点亮」**：琥珀是「唯一高亮」的保留色，铺满 91 个格子会直接稀释它（与 B5 同一类问题）。灰阶才是「点亮」的本义。
3. **B4 的失败分支在 UI 上很难触发**（按钮只在全部完成且未领取时渲染，失败基本是竞态）：仍然修，因为「无条件庆祝」在竞态下就是假成功提示，且成本极低。

## 影响面

- 代码：`Heatmap.tsx`（`cellColor` 改为灰阶 + 导出供测试）、`Today.tsx`（领取分支）、i18n 两种语言各 +4 键；`SURFACES.md` 与 `README.md` 同步修正（原文写的「绿色点亮」）。
- 用户可见：**统计页热图由绿/蓝变灰阶**（满完成日最黑）；今日页领取失败时给原因而不是假成功。

## 验收标准

### 自动化（已通过）
- 新增 `src/components/HeatmapColors.test.ts` **5 例**：满亮=墨色、空=线色、未来/无数据=透明、部分完成按比例递增、**任何比例都不再出现 progress-green/blue**（防回归）；
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **63 文件 / 510 用例全绿**。

### 浏览器实测
- 统计页热图实测采样：空白天 `rgb(232,232,232)` ×106、全完成日 `rgb(10,10,10)` ×66、未来透明 ×10 —— 无任何绿色；
- 截图 `.tmp-verify/heat-before.png`（绿）与 `heat-after.png`（灰阶）对比。

## 遗留
- **B5（全勤块恒 `bonus: true` 稀释琥珀稀缺性）需要与 D1「唯一点缀色」一起决策**：是否让全勤块与连击奖励块有不同视觉等级，属于美术决策，不在本轮替你定。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
