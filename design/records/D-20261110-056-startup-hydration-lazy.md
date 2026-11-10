---
id: D-20261110-056
date: 2026-11-10
title: 启动流畅：水合完成前不渲染空态，重页面懒加载 + 空闲预取
status: proposed
owner: lead
surface: [global, today, build, showcase, stats]
axioms: [A4, A5]
files: [src/App.tsx, src/main.tsx, src/App.test.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

initPersistence 是异步的（Tauri 读文件 / localStorage 读档），但 App 首帧用默认空 store 直接渲染：有存档的用户会先看到「首启空态引导」再被真实习惯替换，形成闪变与一次无意义的布局重排；同时 Build / Showcase / Stats / 迷你摆件全部静态 import，导致首屏 JS 把三套 canvas 场景一并解析，冷启动与首屏可交互时间被拉长。

这是「打开应用时的第一印象」问题，不是新功能。

## 设计决定

1. 水合门：App 读取 hydrated，未完成时只渲染标题栏/底栏骨架与空内容区（背景色与主题已由 applyCachedAppearance 预设，不闪白），不渲染今日空态；hydrated 后再渲染页面。读档失败/损坏/需升级的既有提示保持不变。
2. 路由懒加载：Build / Showcase / Stats 改为 React.lazy + Suspense（fallback 为空白内容区，无 spinner），Today 保持同步（首屏页面）；MiniDeskToy 也改为懒加载，仅在迷你模式需要时加载（它静态依赖 BuildScene，会拖累主包）。
3. 空闲预取：水合完成后用 requestIdleCallback（无则 setTimeout 1.2s）预取三页 chunk，用户切页时通常已就绪；切页失败由既有 ErrorBoundary 兜底。
4. App.tsx 不再从 ./render/iso barrel 取 clearCubeSpriteCache，改从 ./render/isoCube 直接引用，避免主包无意拉入整套绘制模块。

## 取舍与被否方案

- 否掉骨架屏：一次 10–50ms 的空窗，画骨架反而引入噪音与布局跳动；保持空白是最克制的。
- 否掉全部页面懒加载（含 Today）：今日页是首屏主路径，懒加载会让第一次打开多一次网络/解析往返，得不偿失。
- 否掉手动 manualChunks 把页面拆成大块：Vite 对动态 import 的自动分包已经足够，手工配置容易与 Tauri 的 file:// 加载方式冲突。
- 否掉「先渲染空态、水合后淡入」：这正是要消除的闪变；A5 也禁止无意义位移。

## 影响面

- App.tsx：hydrated 门、lazy/Suspense、idle 预取、sprite cache import 路径、tab title 提示（与 D-054 同批）。
- App.test.tsx 需适配异步页面加载（findBy* / await）。
- 构建产物：主 chunk 应显著变小，Build/Showcase/Stats 各自成为独立 chunk；首次进入某页时可能有一个 chunk 拉取，空闲预取后通常无感。
- 无数据模型 / 同步变更；无视觉变化（加载完成后逐像素一致）。

## 验收标准

1. 浏览器（localStorage 有真实存档）冷加载：首帧不出现空态引导，水合后直接显示真实内容；无「空态 → 内容」布局跳变。
2. 生产构建 chunk 报告：主 chunk 体积下降；存在 Build/Showcase/Stats 独立 chunk；空闲预取后切页无 loading 闪烁。
3. 切页、水合失败、损坏档、演示模式（?demo-castle）路径均正常。
4. App.test.tsx 全绿；tsc / npm test / npm run design:check 通过。
5. 水合完成后的四页截图与改造前逐像素 0 差异。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 implemented in worktree (lead); 待人类审核：状态保持 proposed，审核后由人类改为 approved/implemented
- 2026-11-10 追加修正（实测驱动）：页面 React.lazy 首次切页有 ~300ms 的 Suspense 延迟提交空白（证据见 `.tmp-perf/report.md` §5，非动态 import，同页二次切换 12–18ms），已回退 Build/Showcase/Stats 为静态 import；水合门与 MiniDeskToy 懒加载保留。切页恢复即时（~13–18ms），冷启动仍受水合门保护。
- 2026-11-10 规格对齐：水合未完成时渲染主题一致的空白壳（`aria-busy`、`--bg`），不渲染标题栏/底栏，避免读档窗口内误点；spec §2.5 已同步为最终口径。
- 2026-11-10 实施校正：`src/main.tsx` 最终未改动（原 files 字段为计划范围）；页面静态 import 回退后验收 #2 的「独立 chunk」不再适用，以本条与上一条变更履历为最终口径。
