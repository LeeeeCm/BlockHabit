---
id: D-20261115-076
date: 2026-11-15
title: 纯拆分 4 个超过 800 行的文件（Today / MiniDeskToy / SettingsDialog / en.ts），零行为变化
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [src/pages/Today.tsx, src/pages/today/, src/components/MiniDeskToy.tsx, src/components/minidesk/, src/components/SettingsDialog.tsx, src/components/settings/, src/i18n/locales/en.ts, src/i18n/locales/en/]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

AGENTS.md §4 有硬约定「单文件超过 800 行时，新增逻辑应拆到新文件」，但仓库里有 4 个文件已经越线：

| 文件 | 行数 | 越线原因 |
| --- | --- | --- |
| `src/pages/Today.tsx` | 977 | 页面把头部/习惯列表/空态/内联图标等全部 JSX 堆在一个组件里 |
| `src/components/MiniDeskToy.tsx` | 931 | 悬浮件把 `useFocusNow` hook、`FocusRing` 组件与主视图混在一个文件 |
| `src/components/SettingsDialog.tsx` | 866 | 对话框把 `Group` 组件与多个设置分区的 JSX 混在一个文件 |
| `src/i18n/locales/en.ts` | 808 | 纯文案对象，所有域（common/today/build/stats/settings/webdav…）挤在一个对象字面量里 |

这不是「有人写屎山」：0.2.1 的 Prettier 全仓对齐（D-20261114-073，printWidth 100）把长行拆成短行，
四个文件从 766/717/745/774 涨到 947/905/830/806（见 0.2.1 verifier P2 记录）。但**约定仍然有效**：
下次往这四个文件加逻辑前必须先拆，否则只会在越线的路上越走越远。

## 设计决定

**纯搬运式拆分：只移动代码，不改行为；公共导出与 import 路径保持完全不变。**

1. `src/pages/Today.tsx`：保留 default export `Today`（props 接口不变）与全部状态/副作用；
   把大段 JSX 区块抽成 `src/pages/today/` 下接收 props 的展示组件，纯函数/常量抽到模块。
2. `src/components/MiniDeskToy.tsx`：保留具名导出 `MiniDeskToy`；`useFocusNow` 与 `FocusRing` 等
   移入 `src/components/minidesk/`。
3. `src/components/SettingsDialog.tsx`：保留具名导出 `SettingsDialog`；`Group` 与各设置分区展示组件
   移入 `src/components/settings/`，状态/副作用留在对话框。
4. `src/i18n/locales/en.ts`：保留具名导出 `en: TranslationSchema`；按文案域拆到
   `src/i18n/locales/en/` 下，`en.ts` 用对象展开按 key 唯一归属组合，最终对象与拆分前**逐 key 等价**。

不做的：不顺手改逻辑、不重命名既有导出、不引入新 hook（`useMemo`/`useCallback` 会改变行为面）、
不动测试断言、不碰 zh.ts / types.ts。

## 取舍与被否方案

- **否掉「改成目录 + index.ts 重导出，然后改所有 import」**：会让改动面从 4 个文件扩散到几十个调用点，
  评审成本高、回归风险大；保留原文件作为入口即可，收益相同。
- **否掉「只做文件级拆分记录、等下轮再拆」**：四个文件已经越线，且本轮有完整门禁与 verifier 兜底，
  正是拆的窗口；拖到「下次加逻辑时」就是把新逻辑也塞进超长文件。
- **否掉「一次性把 ShowcaseScene 841 / archive.test 833 / BuildScene 809 / appStore 806 也拆了」**：
  本轮 DoD 只点名这 4 个；其余 4 个刚好卡在 800 附近，留给下一轮（记录在「后续」），避免一次性动太多渲染热路径。
- **否掉「拆分同时顺手修死代码/合并重复 JSX」**：那就不再是零行为变化，verifier 也无法用「行数/快照/
  测试数字一致」来证明安全。

## 影响面

- 只新增文件与移动代码：不改 package.json、不改依赖、不改存档/schema/i18n key、不改 CSS/视觉。
- 公共 API：4 个文件的导出符号、类型、props 全部不变；所有既有 import 路径不变。
- 四文件行数目标：全部 < 800（实际目标 < 600，给后续增长留余量）；新增文件各自 < 500。
- 测试与构建：`npm test` 文件数/用例数保持不变；`npm run build` 产物 chunk 归属可能因模块拆分变化，
  但功能等价、体积量级不回归（以实测数字记录）。

## 验收标准

1. `npx tsc --noEmit` 0 错误；`npm test` 全绿且文件数/用例数与拆分前一致（110 文件 / 1139 用例）。
2. 4 个目标文件行数全部 < 800（实测值写进发布报告 §15）。
3. 既有测试全绿：`src/App.test.tsx`（Today）、`src/components/MiniDeskToy.test.tsx`、
   `src/components/SettingsPanels.test.tsx`、`src/components/dialogA11y.test.ts`、
   `src/components/BottomSheet.test.tsx`、`src/i18n/index.test.ts`。
4. `git diff` 只包含移动/import 改动，不包含逻辑改动（verifier 可用 `git diff -M` 复核相似度）。
5. `npm run format:check`、`npm run design:check`、`npm run check:versions` 通过。

## 后续（本记录不做）

- 下一轮继续拆 `src/render/ShowcaseScene.tsx`（841）、`src/storage/archive.test.ts`（833）、
  `src/render/BuildScene.tsx`（809）、`src/store/appStore.ts`（806）。
- 若拆分后仍出现 > 600 行的文件，后续新增逻辑必须写到新文件（约定不变）。

## 变更履历

- 2026-11-15 created (lead)：本轮 goal 授权「批准一切必要请求与最佳方案；可修改并 push main…；单次编码/验证
  任务可用 Agent Teams 并行」直接置为 approved（reviewer=LeeCM），授权来源即本 goal 的授权文字。
- 2026-11-15 implemented：4 个文件拆分完成（具体新文件清单与行数见发布报告 §15 与提交信息）。
