---
id: D-20261110-064
date: 2026-11-10
title: 桌面专注陪伴：摆件倒计时，到点确认落块，不监控
status: approved
owner: lead
surface: [mini-widget, today]
axioms: [A5, A6]
files: [src/store/timerStore.ts, src/logic/focusSession.ts, src/logic/focusSession.test.ts, src/components/MiniDeskToy.tsx, src/components/MiniDeskToy.test.tsx, src/App.tsx（TimerWatcher 内联）, src/components/HabitRow.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

专注习惯的倒计时只存在于今日页卡片里；切走页面或收起窗口就看不见。桌面摆件可以承担「陪着你专注」的角色，但必须与 Focus Bear 的监控/阻断划清价值观边界：只显示用户自己启动的计时。

## 设计决定

摆件增加专注模式状态机：idle / focusing / ready / done。用户从今日页或摆件开始专注后，会话写入 timerStore 并持久化到 localStorage（设备本地，不进存档/同步）；摆件显示习惯名 + 倒计时 + 环形进度；到点发通知（可选）并进入 ready，用户确认才调用 checkIn(actualMinutes) 落块，可「再等 5 分钟」1–2 次；放弃需二次确认且不产生打卡。应用退出不暂停计时（绝对时间），重开恢复并在已超时时直接 ready。不做监控、阻断、后台服务。详见方案 §3.6。

## 取舍与被否方案

- 否掉自动完成打卡：数据诚实优先。
- 否掉监控/网站阻断：越界且违背 A7。
- 否掉循环动画：A5；静态环形进度即可。
- 否掉后台常驻服务：需要系统权限，保留「应用运行中生效」的诚实限制。

## 影响面

timerStore 持久化、纯逻辑 focusSession、MiniDeskToy 状态机、TimerWatcher 通知去重、i18n；依赖 A1 尺寸（可先标准档）。

## 验收标准

focusSession 单测（剩余时间/ready/超时恢复/延长/时钟回拨/跨午夜）；开始→摆件切换→到点→确认落块；关应用重开恢复；放弃无打卡；三档不裁切；reduced-motion 无动画；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §6）：会话存 `localStorage: blockhabit.focusSessions.v1`（设备本地，不进存档/同步）；`notifiedAt` 持久化去重并 prune（现有 TimerWatcher 的内存 set 重启会重复通知）；托盘 tooltip 只在相位变化时更新，避免每秒 IPC；Chromium 隐藏/最小化时定时器节流可能导致通知延迟约 1 分钟，文案需诚实说明；到点确认复用现有 `checkIn`，不做自动完成。
- 2026-11-10 人类在对话中确认按路线图进入 Wave 2（记录仍保持 proposed，状态更新由人类在台账完成）；Wave 2 实现开工。
- 2026-11-10 实现（innovation-engineer）：`logic/focusSession.ts` + 21 tests、timerStore 重写（localStorage v1、TTL/prune/notifiedAt/extend）、MiniDeskToy 专注态三档（6 tests）、TimerWatcher 通知去重落盘、TraySync 仅相位变化；全量 89 files / 841 tests。Lead 补 HabitRow 用 `session.targetMs ?? targetMinutes` 判断 running/ended，修复「延长后今日页提前待确认」。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。
- 2026-11-11 B4 收尾（b4-focus）：① 今日页新增专注入口条（有可开始专注习惯且无会话时出现，复用 `timerStore.start`，与 HabitRow 既有入口同源不重复）；② 多会话展示规则抽为 `viewFocusSessions`（ready 优先于 focusing、同相位按最早到点，主面板 + 「另有 N 个专注」副行），`primarySessionId` 改为其别名；③ `planFocusNotifications` / `trayPhaseFor` / `trayStatusFor` 从 App 抽成纯函数，App 只做副作用；④ HabitRow 改用含延长的 `effectiveTargetMs` 判断进行中/待确认（修正上一条「session.targetMs」不含延长的缺陷），新增 `HabitRow.focus.test.tsx` 回归。