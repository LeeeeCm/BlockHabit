---
id: D-20261115-077
date: 2026-11-15
title: 清理 verifier 遗留 P3：安装成功后释放 Update 句柄 / credential_set 空串删除旧条目
status: approved
owner: lead
surface: [global]
axioms: [A1]
files: [src/platform/updater.ts, src/platform/updater.test.ts, src-tauri/src/credentials.rs]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

0.2.1 的独立 verifier 提了两条 P3（当时判定「保持与已发布二进制一致，不在发布后改逻辑」，记在
`docs/release/release-candidate-report.md` §12）：

1. `src/platform/updater.ts` 的 `installUpdate()` 在 `downloadAndInstall()` 成功后没有调用
   `update.close()`。虽然 Windows 上安装器即将接管进程、句柄会随进程回收，但这是资源泄漏语义不完整：
   `checkForUpdate()` 重复检查与 `discardPendingUpdate()` 都会 close，唯独「安装成功」这条最该收尾的路径没做。
2. `src-tauri/src/credentials.rs` 的 `backend::set()` 在 `secret` 为空字符串时直接 `Ok(())` 返回，
   不写入新密码、也不删除旧条目。前端当前只在密码非空时调用 set、清空走 `credential_delete`，
   所以用户可见行为没有差异；但后端语义是坑：将来任何调用点传空串，都会静默保留旧密码。

本轮 0.2.2 发布候选已经包含 keyring（0.2.1 已发布）与 updater 链路，这两处是低风险、可独立验证的收尾，
因此按 P3 清理掉，而不是继续「接受并记录」。

## 设计决定

1. **安装成功后释放句柄**：`downloadAndInstall()` 返回后、`pendingUpdate = null` / `relaunch()` 之前，
   `await update.close()`，异常吞掉（与 `clearPendingUpdate()` 一致：释放失败不篡改安装结果）。
   同时在 `updater.test.ts` 的成功路径断言 `close` 恰好被调用一次（加强既有断言，不放宽）。
2. **空串 = 删除**：`backend::set()` 先 `open(account)?`（账号键校验不通过仍返回 `invalid-account`），
   若 `secret` 为空则走 `delete_credential()`（`NoEntry` 视为成功，幂等）；否则照常 `set_password()`。
   把「空密码 → 删除」的判定抽成顶层纯函数 `empty_secret_means_delete()` 并加 Rust 单测，
   这样语义可测且不依赖真实 Windows 凭据管理器。
3. **前端零改动**：`src/platform/credentials.ts` 与设置页不改；用户可见行为不变（仍然只在密码非空时 set，
   关闭「记住密码」走 delete）。

## 取舍与被否方案

- **否掉「继续接受」**：两条都是「正确性/资源语义」问题，修复成本 < 20 行，且在发布新版本时顺带带上，
  比留到下轮更划算；0.2.1 当时不改是因为已发布二进制不宜动，现在正要发 0.2.2。
- **否掉「安装成功前 close（比如 finally）」**：失败路径需要保留 `pendingUpdate` 让用户重试安装，
  提前 close 会让重试变成 `not-checked`，反而破坏体验；只在成功路径 close。
- **否掉「给空串删除加 Tauri command 层测试」**：会真实读写 Windows 凭据管理器，测试不可移植、可能留垃圾；
  测纯函数判定即可，OS 交互本身有 0.2.1 的 6 例单测与真机 T8 覆盖。

## 影响面

- `src/platform/updater.ts` +5 行；`updater.test.ts` +1 断言；`src-tauri/src/credentials.rs` 重构 `set()`
  并新增 1 个 Rust 单测（cargo test --lib 6 → 7 例）。
- 无新依赖、无存档/schema/文案变化、无视觉变化；前端行为不变。
- 已发布 0.2.1 用户不受影响（这些是 0.2.2 二进制内的改动）。

## 验收标准

1. `npx tsc --noEmit` 0；`npm test` 全绿（updater.test.ts 12 例，成功路径新增 close 断言）。
2. `cargo test --lib` 7 例全绿（新增 empty_secret_means_delete 用例）。
3. 行为回归：失败安装路径仍可重试（`not-checked` 语义不变）；前端设置页零改动。

## 变更履历

- 2026-11-15 created (lead)：本轮 goal 授权「批准一切必要请求与最佳方案；可修改并 push main…；verifier
  遗留 P3 清理（低风险、可独立提交）」直接置为 approved（reviewer=LeeCM），授权来源即本 goal 的授权文字。
- 2026-11-15 implemented：见提交信息与发布报告 §15。
