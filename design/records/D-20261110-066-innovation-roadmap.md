---
id: D-20261110-066
date: 2026-11-10
title: 创新路线图与优先级：三波次（每天看见 / 陪伴与带走 / 长期故事）
status: approved
owner: lead
surface: []
axioms: [A1, A4, A6, A7]
files: [docs/superpowers/specs/2026-11-10-blockhabit-innovation-deep-dive.md, docs/superpowers/specs/2026-11-10-blockhabit-innovation-research-desktop-data.md, docs/superpowers/specs/2026-11-10-blockhabit-innovation-research-recap-content-focus.md, docs/superpowers/specs/2026-11-10-blockhabit-innovation-technical-notes.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261110-058 给出了 10 条差异化建议，但哪些先做、为什么、怎么验收、彼此如何衔接尚未成体系。若一次全做会变成大 diff；若只做最安全的会错过打开动机的窗口。

## 设计决定

把创新收敛到三条线（每天看见 / 长期故事 / 数据主权）与三个波次：0.3.0 做 A1 摆件三档 + A3 WebDAV 预设自检 + A2 年鉴 MVP（2–3 周）；0.4.0 做 B2 专注陪伴 + A4 档案包 + B3 建筑档案（3–4 周）；0.5.0 做 B1 免费扩建包与内容版本门，并以代码签名/自动更新/内容生产为前置（6–10 周）。每波次遵守同一 DoD：设计记录先 approved、单测、四主题与 zh/en、未改动区域像素零回归、tsc/test/design/build 全绿。详见方案 §5–§7。

## 取舍与被否方案

- 否掉先做 B1：内容包解决老用户之后玩什么，但当前更痛的是新用户留存与老用户打开动机；且无签名分发时付费/分发不成立。
- 否掉一次全做：无法 review 且风险叠加。
- 否掉先做商业化：信任基建（签名/更新/备份）未完成前收费会反噬。

## 影响面

产品排期与设计记录状态；无直接代码改动。后续每个创新项有独立记录。

## 验收标准

方案文档与 7 条创新记录互相可追溯；每波次 DoD 可执行；人类确认波次顺序与 B1 定价策略后，才进入对应单项的 approved→实现。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §8–§11）：在 Wave 1 前增加 **Wave 0 hotfix**（0.5 人日）：修 `repairBrickMonth` 未进 persistState / buildLocalState（重启可重复补月度修复砖额度）、`openDataDir()` 缺 opener 权限、zh CORS 旧文案；实施内部顺序调整为 A1 → A3 →（A2 → B3/B2）→ A4 → B1；B1 必须在内容版本门与兼容矩阵完成后再启动。
- 2026-11-10 人类在对话中确认按路线图进入 Wave 2（记录仍保持 proposed，状态更新由人类在台账完成）；Wave 2 实现开工。
- 2026-11-10 Wave 0 + Wave 1 已实现（见 CHANGELOG 第五轮）；同日晚人类对话确认进入 Wave 2，A4/B3/B2 已实现并通过 Lead 门禁（记录仍 proposed，状态由人类更新）。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。
- 2026-11-11 人类确认 D-059…D-066 为 approved；Wave 3 技术前置与 6 座扩展内容包已实现（18 座 / 1979 块 / contentVersion=2），独立验证见 task-21。