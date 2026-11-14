---
id: D-20261115-074
date: 2026-11-15
title: 自动同步与 keyring 迁移提前到应用级（修「不开设置页就永不同步」）
status: approved
owner: lead
surface: [settings]
axioms: [A7]
files: [src/main.tsx, src/sync/SyncProvider.tsx, src/sync/types.ts, src/sync/webdav.ts, src/sync/useSync.ts, src/components/SettingsDialog.tsx, src/components/WebdavPanel.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

WebDAV 的自动同步（启动同步 + 定时同步）与 keyring 的探测/迁移/回填，全部写在 `useSync()` 的 effect 里。
但 `useSync()` 的唯一调用点是 `SettingsDialog`，而 `App.tsx` 渲染设置对话框的方式是：

```tsx
{settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
```

也就是说：**设置对话框不打开时，`SettingsDialog` 根本不存在，`useSync()` 的 effect 一次都不会跑**。
后果（都是真的会发生，不是理论问题）：

1. 配了「自动同步」的用户，重启应用后**永远不会自动同步**，直到他主动打开设置页——而重新打开设置了，往往也不会再等 2 秒看它同步。
2. 「启动即同步」的既有设计（见提交 `1b2e537` 的 commit message：`sync-on-launch`）实际上没有生效。
3. C4 §4 方案 B 的 keyring 迁移/回填时点被推迟到「第一次打开设置页」，与设计记录里的预期不一致（本轮 D-072 已在履历中如实标注，但根因是同一个挂载方式问题）。
4. 同步状态（`status`/`lastSyncAt`）只存在于设置对话框的生命周期里：关掉再开会被 `loadWebDavConfig()` 重新初始化，UI 上的「上次同步」其实读的是磁盘里的旧值，而不是本次会话的真实状态。

## 设计决定

**把同步控制器提升为「应用级单例」，只提升挂载位置，不改同步逻辑本身。**

1. 新增 `src/sync/SyncProvider.tsx`：内部调用一次 `useSync()`，通过 React Context 把它的返回值（`SyncController`）分发给设置页。
2. 挂载点放在 `src/main.tsx` 的**主窗口分支**上：
   ```tsx
   {isTrayMenu ? <TrayMenu /> : <SyncProvider><App /></SyncProvider>}
   ```
   托盘菜单窗口（`tray-menu`）**不挂** SyncProvider——两个窗口同时跑自动同步会互相打架（同一份远端被并发条件写）。
3. `SettingsDialog` 改为 `useSyncController()`；`useSync()` 本身**一行逻辑都不改**（含 keyring 迁移、启动同步 2s 延迟、定时器、412 冲突重试）。
4. 类型归位：`SyncErrorCode` / `SyncController` 从「组件文件」与「hook 文件」收进 `src/sync/types.ts`，避免 `sync` 层反向依赖 `components` 层；`WebDavErrorCode` 一并上移，`webdav.ts` 保留 re-export 保持公开面不变。
5. 顺带清掉 `useSync.ts` 顶部重复粘贴过两遍的 B1 注释块（纯注释，无行为）。

## 取舍与被否方案

- **否掉「在 App 组件里直接调用 `useSync()`」**：App 会因为同步状态变化（idle→syncing→success）重渲染整棵页面树（Today/Build/Showcase/Stats）。Context 方案下 provider 重渲染时 `children` 的 element 引用不变，React 会跳过 App 子树，只有设置页这个消费者重渲染。
- **否掉「把 useSync 改成模块级单例引擎 + useSyncExternalStore」**：那是对的架构方向，但要重写 360 行 hook、改 12 个既有测试，收益与本方案相同；当前产品已发布 0.2.1，优先小步、可回滚。已在「后续」记下这条。
- **否掉「让 SettingsDialog 常驻挂载、只是不显示」**：对话框里有焦点陷阱、Esc 监听、滚动锁，常驻会引入看不见的副作用；而且「靠保持 UI 组件挂载来跑后台任务」本身就是错的方向。
- **否掉「在 App 里再加一份独立的同步 effect」**：会变成两份配置状态、两个定时器、两份 412 重试逻辑，必然冲突。

## 影响面

- 新增 1 个文件（`SyncProvider.tsx`）+ 1 个测试；修改 `main.tsx` / `SettingsDialog.tsx` / `WebdavPanel.tsx` / `sync/types.ts` / `webdav.ts` / `useSync.ts`（后四个只有类型与导入的搬移，无行为）。
- 行为变化（用户可见）：**配了自动同步的用户，重启应用后 2 秒左右会自动同步一次**，不必打开设置页；keyring 迁移/回填在启动时完成，而不是首次打开设置时。
- 不变：主路径仍不联网（同步是用户自己开启的可选功能）；不新增依赖；不改存档/settings/schema；同步的合并/冲突/墓碑语义零改动。
- 托盘窗口不参与同步，单实例语义不变。

## 验收标准

1. 新增 `src/sync/SyncProvider.test.tsx`：
   - 只渲染 `<SyncProvider>`（**不挂 SettingsDialog**）时，到点仍会触发一次同步 → 证明回归被修掉；
   - 在 Provider 外调用 `useSyncController()` 抛出明确错误 → 防止以后又有人把 hook 塞回某个弹窗里。
2. 既有 `useSync` 12 例、`webdavConfig` 5 例、`webdavKeyring` 10 例、`WebdavPanel` / `SettingsPanels` / `BottomSheet` 全绿（同步逻辑未被改写）。
3. `npx tsc --noEmit` 0 错误；`npm run design:check`；`npm run format:check`。
4. `npm run build` 打包体积与拆包不回归（`useSync` 原本就随 `SettingsDialog` 静态导入进主包，挂载点上移不改变 chunk 归属）。

## 后续（本记录不做）

- 把 `useSync` 改成 `useSyncExternalStore` + 模块级引擎（真正的单例语义：多窗口/多消费者安全、状态不受组件生命周期影响）。
- 同步成功后给一个非设置页的轻量反馈（例如托盘 tooltip 或今日页角标），当前只在设置页展示状态。

## 变更履历

- 2026-11-15 created (lead)：按用户「还有哪些需要优化」清单中的 B1 项实施；本记录状态由人类授权（“ok了”= 继续做）直接置为 approved（reviewer=LeeCM）。
- 2026-11-15 implemented：新增 `SyncProvider` 并在 `main.tsx` 主窗口分支挂载；`SettingsDialog` 改用 `useSyncController()`；
  `SyncErrorCode`/`SyncController`/`WebDavErrorCode` 归位到 `src/sync/types.ts`（`webdav.ts` 与 `WebdavPanel.tsx` 保留 re-export，调用点零改动）；
  新增 `src/sync/SyncProvider.test.tsx`（2 例）。实测见提交信息。
