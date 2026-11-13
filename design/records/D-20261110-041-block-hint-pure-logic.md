---
id: D-20261110-041
date: 2026-11-10
title: 把「打卡无掉块」的原因判别抽为纯逻辑并补 5 例单测（F2 收尾）
status: approved
owner: lead
surface: [today]
axioms: [A6]
files: [src/logic/blockHints.ts, src/logic/blockHints.test.ts, src/pages/Today.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

`D-20261110-038` 在 `Today.tsx` 里内联了「没有掉块时该说什么」的判断：

```ts
const allDone = completedBlueprintIds.length >= blueprintOrder.length
const activeDone = placedCountRef.current >= getBlueprint(activeBlueprintId).blocks.length
```

问题有二：
1. 这是**规则**（判别条件 + 优先级），不是展示；放在组件里只能靠浏览器手测（上一轮就因为合成状态不一致差点验证到假分支）；
2. 「全部落成优先于当前蓝图已满」这个优先级是隐式的三元嵌套，读代码的人要自己推。

## 设计决定

抽到 `src/logic/blockHints.ts`：

```ts
export type NoBlockReason = 'normal' | 'active-blueprint-complete' | 'all-blueprints-complete'
export function noBlockReason(ctx): NoBlockReason
```
优先级显式写在函数里：**全部落成 > 当前蓝图已满 > 正常**。组件只负责「原因 → 文案」映射。

## 取舍与被否方案

1. **否决「把文案也搬进逻辑层」**：i18n 文案依赖 UI 语言与语气（`design/VOICE.md`），不属于纯逻辑；逻辑层只产出枚举。
2. **否决「写成组件内的 `useMemo` + `if/else`」**：测不到。抽取成本约 30 行，换来 5 条确定性用例，值得。
3. **没有顺手改文案**：文案在 `D-20261110-038` 已按 VOICE 定稿，本轮零文案变更。

## 影响面

- 代码：新增 `blockHints.ts`（约 25 行）+ 单测 5 例；`Today.tsx` 的 else 分支改为调用纯函数（净减 4 行条件嵌套）。
- 用户可见：**无**（判别结果与上一轮一致）。

## 验收标准

- `src/logic/blockHints.test.ts` **5 例**：正常 / 当前蓝图已满 / 全部落成 / **全部落成优先于已满** / 完成数超过总数（脏数据不越界）；
- `npx tsc --noEmit` 0 错误；`npm test` **65 文件 / 520 用例全绿**；
- `npm run design:check` 通过。

## 附：构建告警 `STATIC_VCRUNTIME` 的结论

`D-20261110-039` 记下的 `STATIC_VCRUNTIME is deprecated` 告警，本轮排查结论：**仓库内没有该配置**（`tauri.conf.json` 无 `bundle.windows`、无 `.cargo/config.toml`、环境变量为空），告警来自工具链自身升级路径。
在不知道原链接意图的情况下改 Rust 链接配置（例如强制 `staticVCRuntime: true`）会改变运行时依赖方式，风险大于收益——**有意不改**，等 Tauri 上游给出明确迁移指引。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
