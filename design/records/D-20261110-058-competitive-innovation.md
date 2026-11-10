---
id: D-20261110-058
date: 2026-11-10
title: 竞品格局与差异化策略：桌面陪伴型习惯应用，而不是又一个打卡清单
status: proposed
owner: lead
surface: []
axioms: []
files: [docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md]
supersedes: []
reviewer: pending
---

## 背景与问题

用户需要的不只是「功能有没有坏」，而是「凭什么用它而不是市面上的 Streak / Habitica / Finch / Forest / Loop / Habitify / TickTick」。在此之前，仓库里没有一份竞品对比与差异化文档；所有设计取舍（不做社交、不做账号、不做虚拟货币）散落在 AESTHETIC 与历史方案里，缺少对外可解释的产品定位。

## 设计决定

产出一份竞品与创新文档，回答三件事：

1. 横向对比：移动端习惯应用（Streak、Habitica、Finch、Forest、Loop、Habitify、Fabulous、Structured 等）与桌面端习惯/待办（TickTick、Habitify Desktop、Microsoft To Do 等）的功能、留存机制、商业模式、平台、数据主权逐项对比。
2. BlockHabit 的优劣：优势（等距积木建筑作为长期可视化资产、本地优先无账号、桌面托盘/迷你摆件/开机自启、四主题黑白纪律、连击奖励与修复积木的宽容机制）；劣势（无移动端、内容 1385 块后进入 endgame、同步仅 WebDAV、无社交/问责、冷启动与引导仍有缺口、无可更新通道）。
3. 差异化与创新路线：区分「现在就能做」「需要一轮设计」「明确不做」三档。原则：不引入社交、账号、虚拟货币、彩色主题；创新必须强化「每天看得见的物理积累」与「桌面常驻陪伴」。

文档只做分析，不改代码；结论回写本记录并在最终答复中给出摘要。

## 取舍与被否方案

- 否掉「上排行榜/好友互相监督」：与 AESTHETIC §5 冲突，且会引入账号与云端。
- 否掉「加更多小游戏/成就徽章」：奖励只有积木、建筑与铭文。
- 否掉把竞品功能逐个补齐：那是跟随策略；差异化必须来自「桌面 + 物理积累 + 本地优先」这条独有组合。

## 影响面

- 新增 docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md。
- 无代码、无数据模型变更。
- 后续产品决策可引用本文档的「现在就能做」清单排期。

## 验收标准

1. 文档包含 10+ 个竞品的对比表与来源链接；至少 5 条可执行差异化建议，按成本/收益排序。
2. 明确列出「不建议做」及其理由，与 AESTHETIC §5 一致。
3. 所有引用可追溯（链接 + 访问日期）；不把未验证的宣传语当事实。
4. 设计台账登记通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 implemented in worktree (lead); 待人类审核：状态保持 proposed，审核后由人类改为 approved/implemented
