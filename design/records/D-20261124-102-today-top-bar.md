---
id: D-20261124-102
date: 2026-11-24
title: 今日页日期栏并入统一顶栏
status: approved
owner: Claude Code
surface: [today]
axioms: [A2, A4]
files: [src/pages/Today.tsx, src/pages/today/TodayHeader.tsx, src/components/ui-base.css]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

今日页日期栏仍是页内大标题（24px）与胶囊动作，与建造/展台/统计已经统一的 64px 顶栏不一致；切换页面时高度跳动。

## 设计决定

- 今日页头移入 `.page-top-bar`，固定 64px、14×20 内距与 1px 下边线；正文放入独立滚动容器。
- 日期标题改用 `--fs-title`，星期用 `--fs-small`；蓝图进度与完成数使用统一 `.block-action` 倒角方块，新建习惯保留图标按钮。
- 今日页头内容宽度 100%，移动端沿用既有 today-header 换行规则。

## 取舍与被否方案

- 否掉只缩字号不改结构：页内留白和滚动仍与其它页不同。
- 否掉把日期栏做成浮动胶囊：与统一顶栏不一致。

## 影响面

今日页顶栏结构与滚动容器；业务内容与数据不变。

## 验收标准

- 今日/建造/展台/统计四页顶栏同高；日期与动作对齐一致。
- 今日页内容独立滚动，提示、横幅和弹窗仍正常。
- `tsc`、页面测试与构建通过。

## 变更履历

- 2026-11-24 created（Claude Code），按用户要求统一今日页日期栏。
