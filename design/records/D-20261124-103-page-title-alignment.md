---
id: D-20261124-103
date: 2026-11-24
title: 四页顶栏标题与说明排印统一
status: approved
owner: Claude Code
surface: [today, build, showcase, stats]
axioms: [A2, A4]
files: [src/pages/stats/StatsHeader.tsx, src/pages/Showcase.tsx, src/pages/Build.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

统计页标题与「近 13 周…」说明分两行，和展台页「展台沙盘 + 说明」同一行的结构不一致；四页标题的横向起点、标题字号和说明字号仍有细微差异。

## 设计决定

- 统计页标题与说明改为同一基线一行，说明用 12px `--fs-small`，和展台页一致。
- 四页顶栏统一 14×20 内距、16px `--fs-title` 标题；说明/辅助文字统一 12px `--fs-small`。
- 建造页块数说明由 13px 降为 12px；展台页内距从 22px 收为 20px，使标题横向起点一致。
- 右侧动作继续使用统一 `.block-action`；不改变交互与数据。

## 取舍与被否方案

- 否掉统计标题保留独立副标题行：与展台结构不一致，顶栏高度也被撑高。
- 否掉靠页面容器 padding 统一：顶栏仍有不同内距，切换页面会跳。

## 影响面

四页顶栏排印；不改正文、按钮行为或滚动逻辑。

## 验收标准

- 四页左标题起点、字号一致；说明文字同字号；统计标题与说明同一行。
- 顶栏仍为 64px 高，移动端换行正常。
- `tsc`、页面测试、构建通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户要求对齐四页标题与说明。
