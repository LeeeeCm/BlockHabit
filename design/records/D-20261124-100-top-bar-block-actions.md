---
id: D-20261124-100
date: 2026-11-24
title: 三页顶栏高度统一、倒角方块动作与移除建造页夜灯
status: approved
owner: Claude Code
surface: [build, showcase, stats]
axioms: [A2, A4]
files: [src/components/ui-base.css, src/pages/Build.tsx, src/pages/Showcase.tsx, src/pages/Stats.tsx, src/pages/stats/StatsHeader.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

建造页（蓝图名）、展台页（展台沙盘）、统计页（统计）顶栏高度不一致；同一栏里的动作还混用胶囊、方块和不同字号。用户还要求移除建造页的夜灯/时段提示。

## 设计决定

- 新增 `.page-top-bar`：三页共用 `min-height: 64px`、`padding: 14px 20px`、1px 下边线、垂直居中；统计页头移入同一顶栏，标题改用 `--fs-title`。
- 新增 `.block-action`：顶栏动作统一为圆角 `--r-sm` 的方块（不是胶囊），最小高度 34、padding 6×12、正文号；静态徽章用 `.is-static` 提供 surface 底与 1px 线。
- 建造页「透视考古」「图鉴」使用该样式；展台页「自动排列」「陈列 N 座」统一；统计页「纪念品」「修复积木」统一。
- 移除建造页时段/夜灯提示胶囊；环境光设置与渲染逻辑保留，只去掉顶栏指示。

## 取舍与被否方案

- 否掉只给夜灯换样式：用户明确要求删除。
- 否掉保留胶囊并只调高度：同类动作仍不整齐。
- 否掉给每页单独写样式：会产生三套近似规则。

## 影响面

三页顶栏结构/样式、统计页滚动容器（顶栏固定、内容独立滚动）；不影响数据与其它页面。

## 验收标准

- 桌面宽度下三页顶栏同高，切换页面不跳动；移动端仍按既有窄屏规则换行。
- 指定按钮圆角、高度、字号一致；建造页无夜灯提示。
- `tsc`、页面测试、构建通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户明确要求。
