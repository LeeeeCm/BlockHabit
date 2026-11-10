---
id: D-20261110-010
date: 2026-11-10
title: 实施 B1：连击里程碑奖励块全链路接回（数据层 → 投影层 → 渲染层 → 反馈层）
status: proposed
owner: lead
surface: [build, showcase, today]
axioms: [A1, A6]
files: [src/store/appStore.ts, src/types.ts, src/logic/builds.ts, src/sync/merge.ts, src/storage/adapter.ts, src/render/BuildScene.tsx, src/render/ShowcaseScene.tsx, src/components/PolaroidModal.tsx, src/components/MonthlyPosterModal.tsx, src/pages/Today.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

README 与原始设计文档承诺：**「连击每满 7 天，下一块掉落点缀色 bonus 积木」**。2026-11-10 的三路审计**独立**在三个位置发现这条链路每一环都断了：

| 环节 | 断点 | 证据 |
| --- | --- | --- |
| 数据层 | 单习惯打卡创建的积木恒 `bonus: false`；`awardBlock()` 只在「全勤领取」里被调用，且结果仅作返回值 | `appStore.checkIn` 中 `bonus: false` 字面量 |
| 投影层 | `rebuildBuilds()` 重建积木时统一写死 `bonus: false`，同步/导入后任何标记都会被抹掉 | `logic/builds.ts` |
| 渲染层 | 六个绘制入口（BuildScene / ShowcaseScene / BlockDropModal / BlueprintThumb / PolaroidModal / MonthlyPosterModal）**全都不传 `bonus`**，`iso.ts:672` 的「点缀色顶面描边」分支是死代码 | `grep drawCube` 调用点 |
| 反馈层 | `CheckInResult.bonus` 无人消费 | `Today.tsx` 只读 `res.complete` |

结果：用户在建造页看到的琥珀描边块其实只可能是**全勤块**，而「连续 7 天」这个最重要的动机回路在视觉上完全不存在。

## 设计决定

### 数据层（`store/appStore.ts`）
```ts
const streakAfter = habit
  ? currentStreak(habit, [...checkIns, { id: blockId, habitId, date: day, at: '' } as CheckIn], new Date())
  : 0
const isBonus = Boolean(slot) && awardBlock(streakAfter)   // awardBlock: streak > 0 && streak % 7 === 0
```
- 语义：**本次打卡后**该习惯的连续天数每满 7 天，掉落的这块积木即为奖励块（第 7/14/21… 天当天的那一块）。
- `currentStreak` 只按「习惯 × 日期」计数，与打卡记录其它字段无关，因此用一个最小占位记录参与计算即可，无需改动 `currentStreak` 签名。
- 写入两处：`PlacedBlock.bonus`（渲染用）与 `CheckIn.bonus`（投影重建用）。

### 类型与投影层
- `CheckIn` 新增可选字段 `bonus?: boolean`（可选，不改 `schemaVersion`、无需迁移）。
- `rebuildBuilds()` 改为 `bonus: c.bonus === true`；`merge.ts` 的 `mergeCheckIns` 增加显式 `bonus: base.bonus ?? other.bonus`（否则 LWW spread 可能丢标记）。
- `adapter.isValidCheckInElement` 增加「`bonus` 若存在必须是 boolean」的校验（拒绝脏档，与 A3 同策略）。

### 渲染层
| 入口 | 取 bonus 的方式 |
| --- | --- |
| `BuildScene` | 已有 `blockMetaByIndex`（含 `pb`），传 `bonus: Boolean(meta?.pb?.bonus)` |
| `ShowcaseScene` | `RenderCube` 增加 `index?`（= `PlacedBlock.index`）；订阅 `builds` 生成 `Map<blueprintId, boolean[]>`，用 ref 承载避免进入 `draw` 依赖数组重绑监听 |
| `PolaroidModal` / `MonthlyPosterModal` | 蓝图块序位即块的 index，用 `bonusByIndex[i]` 查找 |
| `BlockDropModal` | 复用 `BuildScene`，自动生效 |
| `BlueprintThumb` | 蓝图全集预览（未建成的块不存在），**不新增**标记 |

### 反馈层
- `Today.handleHabitCheck`：`if (res.bonus) showToast(t.today.streakBonusToast(7), true)`，沿用既有 toast 组件与样式。
- i18n：`today.streakBonusToast` zh/en/types 三处同步（无内联三元）。

## 取舍与被否方案

1. **否决「把 bonus 存在 PlacedBlock 里就够」**：同步/导入会重建投影，不写进事实层（CheckIn）标记必然丢失。事实层必须承载它。
2. **否决「在 `CheckIn` 里存『是否里程碑』而非是否 bonus 块」**：语义重复且需要再算一次流；直接存投影所需的布尔值更简单、可验证。
3. **否决「7 天里程碑的块是『下一块』而非『这一块』」**：两种读法都合乎 README 的字面，但「当天这块变金」反馈更即时、也不会因第 8 天没打卡而永远拿不到奖励。已在记录中明确定义，避免后人反复。
4. **否决「给奖励块加新的视觉元素（光环/粒子/角标）」**：那会改变美术语言。只点亮 `iso.ts` 里**早已设计好、只是从未被调用**的琥珀顶面描边（1.5px，`p.accent`），完全在 A1 公理③ 与 `ART.md` 既有规范内。
5. **`checkInDay` 的全勤块仍恒 `bonus: true`**（沿用既有设计意图），并保持「奖励块」与「全勤块」共用同一描边语义；区分二者视觉等级（B5）留待 D1 公理决策后再做。

## 影响面

- 代码：13 个文件（store/types/builds/merge/adapter/4 个渲染入口/Today/i18n 三处）。
- 用户可见：**每 7 天连击的那块积木顶面出现 1.5px 琥珀描边**（iso.ts 既有实现），并在打卡后出现一条既有样式的 toast；其余块、布局、字号、颜色、动效**零变化**。
- 数据：`CheckIn` 增加可选字段；旧档向后兼容；`schemaVersion` 不变。
- 同步：多端合并后标记稳定（显式 LWW + 投影保留）。

## 验收标准

### 单元/集成（已通过）
- `src/store/streak-bonus.test.ts`（4 例）：第 7 天掉落 bonus 块并写入 `PlacedBlock.bonus` 与 `CheckIn.bonus`；第 3 天为普通块；第 14 天同样触发；`rebuildBuilds` 重建后保留/不保留正确。
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **50 文件 / 405 用例全绿**。

### 视觉验证（真实浏览器，2026-11-10 02:1x）
用 `npm run dev` + agent-browser 注入「4 块中第 2 块 bonus=true」的存档，截取建造页：
- 纸白主题：`.tmp-verify/bonus-light.png` —— 中间那块积木顶面可见琥珀描边，与其余三块差异明确。
- 墨黑主题：`.tmp-verify/bonus-dark.png` —— 描边在暗底上同样清晰，未破坏黑白灰基调。
- 结论：**只多了一条既有的点缀色描边，美术风格未变**（无新颜色、无新形状、无新动效）。

## 变更履历

- 2026-11-10 created (lead)