---
id: D-20261110-016
date: 2026-11-10
title: 实施 E2：展台热路径三处零分配化（复用离屏底座 / footprint 缓存 / 偏移积木预计算）
status: approved
owner: lead
surface: [showcase]
axioms: [A3]
files: [src/render/ShowcaseScene.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

审计 C10 / C13 / C14（`D-20261110-003`）发现展台沙盘有三处「每帧重复做纯派生计算」：

| 编号 | 问题 | 量级（12 座模型 / 约 1400 块） |
| --- | --- | --- |
| C10 | 底座离屏层用 `document.createElement('canvas')` **每帧新建**（平移时 baseKey 每帧都变） | 每帧约 2200×1120×4B ≈ **9.8 MB** 画布分配，60fps 下约 590 MB/s 的分配/GC 抖动 |
| C13 | `findModelUnderPointer` 每次 pointermove 对每个模型重算 `getModelFootprint()`（遍历所有块） | 每次移动约 **1800 次**块迭代 |
| C14 | 阴影与植被绘制循环里对每个模型 `bp.blocks.map(...)` 新建偏移数组，且**同一份数据算两遍** | 每帧约 **2800 个**临时对象 |

## 设计决定

### 1. 复用同一块离屏 canvas（C10）
```ts
const off = base?.canvas ?? document.createElement('canvas')
if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh }  // 尺寸变化时自动清空
const octx = off.getContext('2d')   // 同一 canvas 复用，不再每帧新建
```
重绘前 `setTransform(1,0,0,1,0,0); clearRect(...)`，再设置 dpr 变换。语义与原实现完全一致（底座内容只依赖 w/h/dpr/view/gyro/ambient/palette）。

### 2. footprint 表进 ref（C13）
`footprintMap` 本来就用 `useMemo` 算好了，但命中检测函数在事件闭包里重新 `getModelFootprint()`。改为 `footprintRef.current.get(bp.id) ?? getModelFootprint(bp.blocks)` —— 命中检测热路径直接读缓存。

### 3. 偏移积木列表预计算（C14）
```ts
const offsetBlocksMap = useMemo(() => { /* blueprintId → [{x,y}] */ }, [placements, blueprintsMap, footprintMap])
const offsetBlocksRef = useRef(offsetBlocksMap); offsetBlocksRef.current = offsetBlocksMap
```
阴影与植被循环改为直接读 `offsetBlocksRef.current.get(id)`，并合并了原先重复计算的两份 map。只在 placements / 蓝图 / footprint 变化时重算（一次拖拽落位算一次）。

## 取舍与被否方案

1. **否决「把阴影与植被也烤进离屏底座」**：拖拽中的模型阴影需要跟着移动（当前实现是落位后才更新），塞进静态层会导致拖拽时阴影错位 —— 属于视觉行为变更。
2. **否决「用 LRU 缓存 footprint」**：footprint 是 `blueprintsMap` 的纯函数，蓝图集合在会话内基本不变；一个 `useMemo` + ref 就够，不值得引入缓存淘汰逻辑。
3. **否决「给 draw 加脏区（只重绘变化区域）」**：收益不确定且容易产生残影；本轮三处都是「零分配化」，不改变绘制顺序与像素结果，风险最低。

## 影响面

- 代码：`ShowcaseScene.tsx` 单文件（+15/−18 行），无新增依赖、无新增导出。
- 用户可见：**逐像素无变化**（见验收）。
- 性能：平移/拖拽期间画布分配从「每帧约 9.8 MB」降为 0；pointermove 处理耗时下降约 23%；12 座模型平移约 **3.6 ms/帧**。

## 验收标准

### 视觉回归（决定性证据）
同一存档（12 座模型全部落位）在优化前后各截一张展台截图，`sharp` 逐像素比对（阈值 ±2/通道）：**0 / 790,000 像素变化（0.00000）**。

### 性能实测（`npm run dev` + agent-browser，同一会话内前后对比）
| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| 300 次 pointermove 总耗时 | 75.5 ms | **57.5–58.9 ms** | −23% |
| 单次 pointermove | 0.2517 ms | **0.1917–0.1963 ms** | −23% |
| 200 帧平移绘制 | — | 726.5 ms → **3.63 ms/帧** | 60fps 预算内（16.7ms）有余量 |

### 自动化
- `npx tsc --noEmit` 0 错误；`npm test` **56 文件 / 441 用例全绿**（无回归）。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
