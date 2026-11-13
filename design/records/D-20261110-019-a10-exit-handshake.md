---
id: D-20261110-019
date: 2026-11-10
title: 实施 A10：OS 关机/注销也走存档握手 + 迷你悬浮件关闭不再卡死尺寸
status: approved
owner: lead
surface: [today]
axioms: [A6, A7]
files: [src-tauri/src/lib.rs, src/App.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

批次 A 的最后一条（审计 C22 / C23）。两处边角但都是「用户会真的遇到」的：

1. **OS 关机 / 注销会跳过存档 flush**：项目只在「托盘菜单 → 退出」这条路径上做了握手（Rust `emit('app-quit-requested')` → 前端 `forceFlush()` → `invoke('confirm_quit')` → Rust 退出，1.5s 超时兜底）。而 Windows 关机、注销、任务管理器结束进程走的是 Tauri 的 `RunEvent::ExitRequested`——当时没有任何处理，**进程直接消失，最后一次异步写盘来不及完成**。
2. **迷你悬浮件关闭会把用户锁在小窗口里**：迷你模式把窗口改成 260×380 并 `setResizable(false)`。此时点关闭只是 `win.hide()`，下次从托盘唤起仍然是那个不可调整大小的迷你窗，用户会以为应用坏了。

## 设计决定

### 1. Rust 侧拦截 ExitRequested（复用既有握手，不另造流程）
把 `Builder::run(context)` 改为 `build(context).run(|app_handle, event| ...)`，在事件回调里：
```rust
if let tauri::RunEvent::ExitRequested { api, .. } = event {
    if !confirmed { api.prevent_exit(); begin_quit(app_handle.clone()); }
}
```
- 未确认 → `prevent_exit()` 并触发同一套 `begin_quit` 握手（emit → 前端 flush → confirm → 1.5s 超时强退）；
- 已确认（`QuitGate` 已置位）→ 放行退出，不会死循环。

### 2. 握手去重
关机 + Alt+F4 + 托盘退出可能同时触发；`begin_quit` 用 `static QUIT_HANDSHAKE_STARTED: AtomicBool` 做 `swap` 判重，保证**只 emit 一次、只起一个等待线程**。

### 3. 迷你模式下关闭 = 先退出迷你模式再收进托盘
- `TitleBar` 新增 `onRequestClose` prop（由 `App` 注入），Alt+F4 / 系统关闭 / 标题栏关闭三条路径统一走它；
- App 的 `handleWindowCloseRequest()`：迷你模式下先 `toggleMini(false)`（恢复原尺寸 + 可调整 + 取消置顶），再 `win.hide()`；非迷你模式行为与之前完全一致（直接收进托盘）。
- 回调经 `ref` 承载（`onRequestCloseRef`），避免监听器随 props 身份变化重绑 —— 与仓库里其它事件监听器的写法一致。

## 取舍与被否方案

1. **否决「关机时干脆不等待，接受丢最后一次」**：一次打卡 + 积木的写入丢失，对「积累型」产品是最伤的一类失败。1.5s 的等待远小于 Windows 关机宽限（通常 5s）。
2. **否决「迷你关闭时弹确认框」**：用户按下关闭的意图很明确，多一次确认反而烦；直接恢复成正常窗口更符合预期。
3. **否决「在 Rust 侧自己写存档 flush」**：会绕开前端的墓碑/投影逻辑，产生第二个数据源。

## 影响面

- 代码：`src-tauri/src/lib.rs`（+约 20 行：静态标志、去重、事件回调）、`src/App.tsx`（+约 20 行：`handleWindowCloseRequest` 与 `TitleBar` prop 贯通）。
- 用户可见：关机/注销时最后一次保存不再丢；迷你悬浮件关闭后下次打开是正常窗口。**界面样式零变化**。
- 风险：若前端在 1.5s 内没确认，仍按原设计强退（行为不变）。

## 验收标准

### 已通过
- `cargo check`（src-tauri）：**Finished dev profile，零错误**（`RunEvent::ExitRequested` 的 `api.prevent_exit()` 签名与 `build().run()` 形态均编译通过）。
- `npx tsc --noEmit` 0 错误；`npm test` **58 文件 / 458 用例全绿**。

### 需要人工验收（本环境无法模拟关机）
1. 桌面端运行中，用任务管理器「结束任务」→ 重启后检查最后一次打卡是否还在；
2. Windows 注销 → 重新登录 → 同上；
3. 进入迷你悬浮件 → 点关闭 → 从托盘「打开」→ 窗口应恢复为 1100×760 且可调整大小。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。

## 落地复核与补齐（2026-11-14）

- 复核结论：本文描述的 `RunEvent::ExitRequested` 拦截与握手去重**当时并未随记录一起落地**——
  `src-tauri/src/lib.rs` 里仍是 `.run(generate_context!())`，`QuitGate` 没有任何 `ExitRequested` 入口，
  也没有去重标志。本轮按本记录的设计原样补齐（不是新方案）：
  - 抽出纯函数 `should_handshake(code, confirmed)`：`code == None` 且未确认才拦截；
  - `.build(...).run(|app, event| ...)` 里 `api.prevent_exit()` + `begin_quit(app.clone())`；
  - 新增 `QuitHandshake(AtomicBool)` 用 `swap` 去重，保证只 emit 一次、只起一个等待线程；
  - 超时抽成常量 `QUIT_HANDSHAKE_TIMEOUT = 1500ms`。
- **为什么 `code == Some(_)` 必须放行**：托盘退出与 `tauri-plugin-updater` 的 Windows 安装器都走 `AppHandle::exit()`；
  在那种路径上 `prevent_exit()` 会让进程永远退不出去（安装器装完应用却不退出）。`cargo test --lib` 的三个用例把这条钉死。
- **安装器路径的补充（本轮新增，记录在此）**：`tauri-plugin-updater` 在 Windows 上是「起安装器 → `std::process::exit(0)`」，
  Tauri 的退出事件根本不会跑到前端。因此「安装前 flush」只能在**前端**做：
  `src/platform/updater.ts` 的 `installUpdate()` 新增可选 `beforeInstall` 回调，在 `downloadAndInstall()` 之前 await；
  失败则中止安装并返回稳定码 `save-failed`（宁可不更新，也不在未落盘时覆盖安装）。
  `src/components/AboutPanel.tsx` 传入 store 的 `forceFlush`。
- **诚实的边界（未解决项）**：`tao 0.37.1` 明确不处理 `WM_QUERYENDSESSION`（源码注释："we don't process `WM_QUERYENDSESSION` yet"），
  所以 Windows 关机/注销时 tao 会直接结束消息循环，`ExitRequested` 不保证送达。因此本记录的「系统退出」覆盖到的是
  「关闭最后一个窗口 / 程序化退出」；真·关机场景的兜底是既有的「关键动作立即落盘」（打卡/撤销/领取/导入都走 `requestFlushNow()`），
  最多丢一次非关键设置的防抖窗口。这一点已同步写进 `docs/release/real-device-acceptance.md` 的 T7 清单。
- 补测：`src/platform/updater.test.ts` 新增 2 例（`beforeInstall` 必须在下载安装之前完成；握手失败 → `save-failed` 且不下载不重启）；
  `src/components/AboutPanel.test.tsx` 断言安装时把 `forceFlush` 交给了适配层。`cargo test --lib` 3 例 + `npm test` 全绿。
