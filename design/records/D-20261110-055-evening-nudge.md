---
id: D-20261110-055
date: 2026-11-10
title: 晚间收尾提醒：首次打卡后自愿开启，只在还有未完成习惯时提醒一次
status: proposed
owner: lead
surface: [today, settings, global]
axioms: [A5, A7]
files: [src/logic/eveningNudge.ts, src/components/ReminderWatcher.tsx, src/pages/Today.tsx, src/components/SettingsDialog.tsx, src/types.ts, src/store/appStore.ts, src/storage/adapter.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, src/i18n/types.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

现有提醒是「每个习惯各自设置 start/end」的到点提醒，必须逐个习惯配置，且只在用户已经意识到要打开应用后才有意义。对一个「每天打开一次」的桌面习惯应用，缺少一条面向当天整体的收尾提醒：晚上还有 2 件没做、连击将断，但应用不会主动说。

不做默认推送是 AESTHETIC §5 的硬边界（「不做推送型营销，提醒只能是用户为自己设的」）。因此这条提醒必须是用户自愿开启的，且只服务于用户自己的习惯。

## 设计决定

1. 触发时机：首次成功打卡后，今日页出现一张一次性确认卡（也可视为简报的延伸）：要每天 21:00 提醒你收尾吗？ + 「开启提醒 / 暂时不用」；选择写入 localStorage（blockhabit.nudgeConsent.v1），不再询问。设置页「提醒」组常驻开关 + 时间（默认 21:00），用户随时可改。
2. 数据字段：AppSettings.eveningNudgeEnabled?: boolean（默认 false）、eveningNudgeTime?: string（默认 21:00）；normalizeState 补默认值，旧存档无字段时按关闭处理。
3. 触发规则（纯函数 shouldEveningNudge）：全局提醒开关开启 + 晚间提醒开启 + 当前时间 ≥ 设定时间 + 今天存在应做且未达标的习惯 + 今天尚未提醒过（localStorage 记录日期）；不做连击羞辱文案，只陈述事实。
4. 发送：复用 platform/notify（Tauri 原生通知，浏览器回退 Web Notification），标题 BlockHabit，正文「还有 N 件没落块，今天还没收尾。」；不播放提示音（已有到点提醒的提示音，避免叠加）。
5. 应用完全退出后不会提醒（平台限制），设置项下方注明「应用运行中生效」，与现有提醒一致；不引入后台服务、不上云。

## 取舍与被否方案

- 否掉默认开启：会在用户没预期时弹通知，违背「提醒只能是用户为自己设的」；改为首次打卡后的显式选择，转化率仍高于设置页深处的一个开关。
- 否掉每天多次催促 / 分时段多档：一次足够，多次会变成压力源。
- 否掉与每个习惯的到点提醒合并调度：两者语义不同（习惯窗口 vs 当天收尾），合并会让调度器复杂且互相抑制；独立纯函数更可测。
- 否掉在提醒里放连击天数：容易变成道德绑架（「别让 12 天连击断掉」）；只说你还有几件没做。

## 影响面

- 新增 src/logic/eveningNudge.ts + 单测（时间边界、已完成、无习惯、全局开关、当天已提醒）。
- ReminderWatcher 每 30s 扫描末尾追加一次判断；通知去重写入 localStorage。
- 今日页一次确认卡（仅首次打卡后出现，选择后永久消失）；设置页提醒组两个控件。
- types.ts / appStore 默认值 / adapter.normalizeState 字段补全与测试。
- 不新增依赖、不新增网络请求。

## 验收标准

1. eveningNudge.test.ts：未开启、全局关、未到点、已全部完成、无应做习惯、当天已提醒 → 均不触发；到点且有未完成 → 触发一次。
2. 全新数据：完成第一次打卡后今日页出现确认卡；点「开启提醒」后设置页开关为开、时间为 21:00；点「暂时不用」后不再出现且开关保持关。
3. 改时间到过去时刻并留 1 件未完成 → 30s 内收到一次通知；第二次扫描不重复；打卡完成后不再提醒。
4. 旧存档（无该字段）加载后开关为关、不报错；adapter 单测覆盖。
5. tsc / npm test / npm run design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 implemented in worktree (lead); 待人类审核：状态保持 proposed，审核后由人类改为 approved/implemented
- 2026-11-10 实施补充：系统通知权限申请放在用户点「开启提醒」的当下（授权卡与设置开关两处），避免 21:00 提醒时才弹系统权限框；浏览器/Tauri 均走 platform/notify 的 ensureNotifyPermission。
- 2026-11-10 实施校正：实际新增文件包含 `src/platform/eveningNudgePrefs.ts`（consent 与 lastNudgedDay 的 localStorage 读写），原 files 字段漏列。
