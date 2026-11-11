---
id: D-20261110-020
date: 2026-11-10
title: 实施 E3：积木精灵缓存升级为 LRU + 字节预算（高 DPR 下内存封顶 24MB）
status: proposed
owner: lead
surface: [build, showcase, today]
axioms: [A2, A3]
files: [src/render/iso.ts, src/render/spriteCache.test.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

审计 C16（`D-20261110-003`）：`src/render/iso.ts` 的积木精灵缓存有两个结构性问题。

1. **只限条目数、不限字节数**：`MAX_SPRITE_CACHE = 512`。但单个精灵的位图大小随 `dpr` **平方**增长：
   - dpr=1 → 约 15 KB/个 → 512 条 ≈ 7.7 MB
   - dpr=2 → 约 60 KB/个 → 512 条 ≈ 30 MB
   - dpr=3 → 约 135 KB/个 → 512 条 ≈ 69 MB
   在高分屏 / 多显示器跨屏（DPR 会切换）场景下，缓存会把内存推到几十 MB 级别，与「极简轻量桌面小工具」的定位冲突。
2. **FIFO 而非 LRU**：`spriteCache.keys().next().value` 取的是**最早插入**的条目。可实际访问模式是「当前主题 + 当前屏幕上那几种块反复命中」，切换一次主题/时段后再切回来，命中过的热条目反而可能被后面的新块挤掉 → 触发重复离屏重绘（掉帧）。

## 设计决定

### 1. LRU 命中触碰
```ts
if (sprite) {
  spriteCache.delete(cacheKey)   // 先删
  spriteCache.set(cacheKey, sprite)  // 再插入 → 移到 Map 队尾
  return sprite
}
```
利用 `Map` 的插入序天然实现 LRU，不引入额外链表结构。

### 2. 双上限淘汰
```ts
while (size > 0 && (size >= MAX_SPRITE_CACHE || bytes + incoming > MAX_SPRITE_BYTES)) { evict(head) }
```
- 条目上限仍是 512（低 DPR 场景的既有行为不变）；
- 新增字节预算 `MAX_SPRITE_BYTES = 24 MB`（dpr=2 下约 400 个精灵、dpr=3 下约 180 个，覆盖任何真实场景的模型种类数）；
- 淘汰永远从「最久未使用」的队头开始。

### 3. 新增 `cubeSpriteCacheStats()`
返回 `{ count, bytes }`，供单测断言与将来做诊断面板。**不改动任何绘制路径**。

## 取舍与被否方案

1. **否决「切换调色板时清空缓存」**：`spriteCache.test.ts` 有一条既有契约用例明确写着「两种 palette 的缓存并存，互不失效」——切主题是低频操作，让两套精灵共存并交给 LRU + 字节预算自然淘汰更简单；且 `App.tsx` 的切主题路径本来就会调用 `clearCubeSpriteCache()`。
2. **否决「用 WeakMap / FinalizationRegistry」**：精灵是**按 key 复用**的，不是按对象引用；WeakMap 会立刻回收一切，缓存失去意义。
3. **否决「把上限降到 128」**：dpr=1 的纸白主题下 128 条会频繁抖动（展台 12 座模型就有上百种块组合），得不偿失。

## 影响面

- 代码：`iso.ts`（约 +25/−5 行）、`spriteCache.test.ts`（新增 2 个用例、1 个用例改用 dpr=1 以纯测条目上限）。
- 用户可见：**无**。渲染结果逐像素不变（缓存只影响「画几次」，不影响「画什么」）。
- 内存：最坏情况从「随 dpr 无上限增长」变成 **≤ 24 MB + 512 条**。
- 性能：热点精灵命中率上升（切主题来回切不再重绘），冷启动无变化。

## 验收标准

### 自动化（已通过）
- `src/render/spriteCache.test.ts` **11 例全绿**，本轮新增/强化：
  1. 「超出 512 条目上限时淘汰最久未使用」（改为 dpr=1，避免字节预算抢先介入，测的才是条目上限）；
  2. **「刚命中过的条目不会被后续新块挤掉」**（LRU 语义的决定性用例：命中 k0 → 插入新 key → k0 仍在）；
  3. **「高 DPR 下精灵缓存总量不超过 24MB」**（dpr=4 灌 200 个，断言 `stats.bytes ≤ 24MB` 且 `count < 200`）。
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **58 文件 / 460 用例全绿**。

### 人工验收（可选）
- 高分屏下连续切换四主题 × 多时段，DevTools Memory 面板中 Canvas 相关内存应收敛在 24MB 量级。

## 变更履历

- 2026-11-10 created (lead)