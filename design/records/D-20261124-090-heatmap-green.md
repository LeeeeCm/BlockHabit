---
id: D-20261124-090
date: 2026-11-24
title: 统计页热图完成格由墨色改为完成绿
status: proposed
owner: Claude
surface: [stats]
axioms: [A1, A6]
files: [src/components/Heatmap.tsx, src/components/HeatmapColors.test.ts, design/SURFACES.md, design/AESTHETIC.md]
supersedes: [D-20261110-035]
reviewer: pending
---

## 背景与问题

用户明确要求：统计页里代表「打卡成功」的黑色方块改成绿色。当前实现按 D-20261110-035 走灰阶点亮，全完成日是满墨色；在用户看来成功的格子仍是黑的，反馈不直观。

这是人类对既有设计决定的直接覆盖：绿阶不是新增色相，而是把既有的状态绿 `--progress-green` 用于「完成」语义。

## 设计决定

- 全完成日：`--progress-green` 满亮。
- 部分完成：`color-mix(--progress-green N%, --surface)`，N 随完成度从 15% 递增到 75%，保持深浅可读。
- 空白天保持 `--line` 底板；未来/无数据透明；不引入蓝色，不使用墨色填充打卡格。
- 深色主题沿用 `--progress-green` 的暗色令牌（#34d274），不新增颜色。
- 仅统计页热图；今日页、建造页、进度条不受影响。

## 取舍与被否方案

- 否掉「只把全完成日改绿、部分完成仍用墨色」：同一张图里会出现黑绿两套进度语义，用户仍会看到黑格。
- 否掉「用主题点缀色 accent」：accent 是奖励色，完成状态应走状态绿（A1 的状态语义例外）。
- 否掉「新增一套绿色色阶」：直接使用既有 `--progress-green` 的四主题取值。

## 影响面

- `cellColor` 两行取值 + 注释；`HeatmapColors.test.ts` 断言改为绿色规格。
- `design/SURFACES.md` §3 与 `design/AESTHETIC.md` §2.3 中「灰阶点亮」的描述同步更新为绿色。
- 无数据、无布局、无圆角变化。

## 验收标准

1. 统计页任意完成格显示绿色，全完成日满亮；空白天仍为灰底板。
2. 四主题下绿色均可读，深色主题不刺眼。
3. `npx tsc --noEmit`、`npm test` 通过。

## 变更履历

- 2026-11-24 created (Claude)
- 2026-11-24 实现并桌面验收：统计页完成格显示绿色，空白天仍为灰底板。
