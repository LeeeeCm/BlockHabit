---
id: D-20261115-080
date: 2026-11-15
title: 还清单文件 800 行工程债：纯拆分剩余 6 个超长文件（ShowcaseScene / BuildScene / appStore / App / HabitRow / archive.test）
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [src/render/ShowcaseScene.tsx, src/render/showcase/, src/render/BuildScene.tsx, src/render/buildscene/, src/store/appStore.ts, src/store/, src/App.tsx, src/app/, src/components/HabitRow.tsx, src/components/habitrow/, src/storage/archive.test.ts, src/storage/archiveTestUtils.ts]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

D-20261115-076 拆掉了当时点名的 4 个文件（Today / MiniDeskToy / SettingsDialog / en.ts），并在「后续」里
留下剩余越线清单。0.2.2 发布后按同一口径（git show 换行计数）实测，仍有 6 个文件 > 800 行：

| 文件 | 行数 | 越线原因 |
| --- | --- | --- |
| `src/render/ShowcaseScene.tsx` | 869 | 展台画布把 pointer/drag/camera/绘制/浮层全塞进一个组件 |
| `src/storage/archive.test.ts` | 836 | 导出/解包/清单/渲染等 56 个用例 + 自建 ZIP 解析/mock fs 工具都在一个测试文件 |
| `src/store/appStore.ts` | 835 | 纯 helper、默认状态、~490 行 action 集合与持久化初始化混在一起 |
| `src/render/BuildScene.tsx` | 823 | 建造页画布的相机/手势/绘制/生态效果全在一个组件 |
| `src/App.tsx` | 802 | 应用壳里塞了 TimerWatcher / TraySync / TitleBar / useFocusPhase |
| `src/components/HabitRow.tsx` | 801 | 单行习惯卡把周视图/移动端/专注入口/菜单全塞进一个 memo 组件 |

AGENTS.md §4 明文约定「单文件超过 800 行时，新增逻辑应拆到新文件」；这 6 个文件已经越线，且下一轮任何功能
改动都会被逼着往超长文件里塞。D-076 已把「下一轮继续拆」写入后续，本记录执行该后续。

## 设计决定

**与 D-076 相同的纯搬运式拆分，只移动代码、不改行为；公共导出与 import 路径保持不变。**

1. `ShowcaseScene.tsx`：保留 `export function ShowcaseScene(Props)`；把纯函数（命中测试/拖拽数学/相机约束）、
   canvas 绘制函数与浮层子视图移到 `src/render/showcase/`；状态/副作用留在组件。
2. `BuildScene.tsx`：保留 `export function BuildScene(Props)`；相机/手势/生态绘制与子视图移到
   `src/render/buildscene/`。
3. `appStore.ts`：保留 `useAppStore` 与全部既有具名导出（含 `forceFlush` / `persistenceReady` /
   `initPersistence` / `markDemoMode` / `isDemoMode` / `applyDemoCastleState` / 类型）；把纯 helper
   （`uid` / `reconcileCompletion` / `defaultState`）与持久化相关实现搬到 `src/store/` 下的新文件，
   `appStore.ts` 用 re-export 保持公开面不变；store action 实现可拆成 `create<AppStore>()` 内的分组
   工厂（纯函数拼装），但 `set/get` 语义与调用顺序不变。
4. `App.tsx`：保留 default export `App`；`TimerWatcher` / `TraySync` / `TitleBar` / `useFocusPhase`
   移到 `src/app/`（或 `src/components/`），props 与原实现同源。
5. `HabitRow.tsx`：保留 `export const HabitRow = memo(...)`；子视图与纯 helper 移到
   `src/components/habitrow/`。
6. `archive.test.ts`：**不改任何断言**，按 describe 分组拆成两个测试文件
   （如 `archive.test.ts` + `archiveExport.test.ts`），共享的 ZIP 解析/mock fs/BASE_STATE 工具移到
   `src/storage/archiveTestUtils.ts`（非 `.test` 文件，不被 vitest 收集）。拆分前后 `it` 用例总数必须相等。

## 取舍与被否方案

- **否掉「只拆 4 个渲染文件、不碰 appStore/App」**：工程债清单是 6 个，拆一半等于下轮再来一次；且
  appStore/App 正是后续功能最常改的文件。
- **否掉「appStore 按 action 域拆成多个 zustand store」**：那会改变状态组织与持久化语义，不是零行为变化；
  本记录只做代码搬家 + re-export。
- **否掉「把 archive.test.ts 的用例删减/合并」**：测试断言零改动是硬约束；只按 describe 分组拆文件。
- **否掉「拆分同时顺手改逻辑/修警告」**：不再纯搬运，verifier 无法用等价性与测试数字证明安全。

## 影响面

- 只新增文件与移动代码：不改依赖、不改存档/schema/i18n key、不改 CSS/视觉、不改测试断言。
- 公共 API：6 个文件的导出符号/类型/Props 全部不变；所有既有 import 路径不变。
- 目标行数：6 个文件全部 < 800（目标 < 600），新增文件各自 < 500。
- 测试：代码拆分前后 `npm test` 文件数/用例数不变（112 文件 / 1147 用例；archive.test 拆分会让测试文件数
  +1 但用例数不变——这是拆分测试文件的必然结果，用例数只增不减的原则仍满足）。

## 验收标准

1. `npx tsc --noEmit` 0；`npm test` 全绿；拆分前后`it`总数一致（archive.test 拆分前后逐个数）。
2. 6 个目标文件行数全部 < 800（实测值写进发布报告 §16）。
3. 既有测试全绿：Showcase / BuildScene / HabitRow / App / store / archive 相关测试；任何测试断言零改动。
4. `git diff` 只有移动/import/re-export；公共导出面逐字不变。
5. `npm run format:check`、`npm run design:check`、`npm run check:versions` 通过。

## 后续（本记录不做）

- 0.2.3 发行：把 0.2.2 之后的运行时修复（D-077 / D-079）连同本轮纯拆分一起发布（D-077/D-079 的「后续」）。
- Dependabot 首批 PR 的评审与取舍（major 升级单独评估，不在本记录范围）。

## 变更履历

- 2026-11-15 created (lead)：延续 D-076「后续」，用户「继续推进」授权；按本轮 goal 授权
  「批准一切必要请求与最佳方案；可修改并 push main」直接置为 approved（reviewer=LeeCM），
  授权来源即本 goal 的授权文字。
- 2026-11-15 implemented：6 个文件拆分完成（行数与验证见发布报告 §16 与各提交信息）。
- 2026-11-15 复核更正（lead，verifier 复核后）：
  1) 正文表格里 archive.test.ts 的「56 个用例」系笔误：拆分前后实际为 **37 个 it / 153 个 expect / 10 个 describe**，
     拆分前后逐字节相同（28+9 个 it 分到两个文件）；以本条为准。
  2) 「纯搬运式拆分、只移动代码」是当时的目标口径，但独立 verifier 指出部分文件实际包含**等价重构 glue**
     （Showcase 的去重/闭包纯化、Build 的 hover 气泡去重、HabitRow 的 JSX 内联 handler 具名化、appStore 的
     store 注入）；行为等价由 tsc + 1147 用例全绿与逐块比对支撑，但措辞应更正为「**零行为变化重构**」而非字面的
     「只移动代码」。D-076 的同类表述同样以本条口径为准。
