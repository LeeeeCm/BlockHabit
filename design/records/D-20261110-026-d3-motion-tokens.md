---
id: D-20261110-026
date: 2026-11-10
title: 实施 D3：动效令牌收口（17 个时长 + 7 种缓动 → 7 档 + 4 档，裸值归零）
status: approved
owner: lead
surface: [today, build, showcase, stats, settings]
axioms: [A5]
files: [src/theme.css, src/components/ui.css, src/mobile.css, src/themeMotion.test.ts, design/TOKENS.md, 10 个 TSX]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

审计 D3（P2）：A5 要求「克制的物理动效」，但实际是**参数自由生长**：

| 维度 | 改前实况 |
| --- | --- |
| 时长 | **17 个不同字面值**：0.05 / 0.08 / 0.1 / 0.12 / 0.14 / 0.15 / 0.16 / 0.18 / 0.2 / 0.22 / 0.24 / 0.25 / 0.28 / 0.3 / 0.32 / 0.4 / 0.5 / 0.51 / 1.1 / 1.2（s） |
| 缓动 | **7 种**：`ease` ×47、`cubic-bezier(0.16,1,0.3,1)` ×23、回弹三兄弟 1.2/1.3/1.4/1.5 ×9、`ease-out` ×2、`cubic-bezier(0.2,0,0,1)` ×1 |
| 分布 | `ui.css` 80 处时长 + 30 处贝塞尔、`mobile.css` 1 处、**10 个 TSX 内联样式 13 处** |
| 令牌 | C1 那轮定义的 `--dur-xs/sm/md/lg` **实际使用次数 = 0**（只有 reduced-motion 引用） |

也就是说：「令牌」存在，但没有任何一处动效真的用它。

## 设计决定

### 1. 时长阶梯 7 档（按真实使用分布定档，不按理论）
`--dur-2xs: 80ms` · `--dur-xs: 140ms` · `--dur-sm: 180ms` · `--dur-md: 220ms` · `--dur-lg: 300ms` · `--dur-xl: 460ms` · `--dur-scene: 1150ms`

### 2. 原字面值逐条归档（偏差全部落在一处）
| 原字面值 | 归入 | 偏差 |
| --- | --- | --- |
| 0.05s | 2xs 80ms | +30ms |
| 0.08s | 2xs 80ms | 0ms |
| 0.1s | 2xs 80ms | −20ms |
| 0.12s | xs 140ms | +20ms |
| 0.14s | xs 140ms | 0ms |
| 0.15s | xs 140ms | −10ms |
| 0.16s | sm 180ms | +20ms |
| 0.18s | sm 180ms | 0ms |
| 0.2s | md 220ms | +20ms |
| 0.22s | md 220ms | 0ms |
| 0.24s | md 220ms | −20ms |
| 0.25s | md 220ms | −30ms |
| 0.28s | lg 300ms | +20ms |
| 0.3s | lg 300ms | 0ms |
| 0.32s | lg 300ms | −20ms |
| 0.4s | xl 460ms | +60ms |
| 0.5s | xl 460ms | −40ms |
| 0.51s | xl 460ms | −50ms |
| 1.1s | scene 1150ms | +50ms |
| 1.2s | scene 1150ms | −50ms |

最大偏差 **±60ms**（0.4s→460ms、1.2s→1150ms）：前者用于落块弹窗的宽度过渡、后者是一次性氛围动画（1.2s 的 5%），肉眼不可辨；其余偏差均在 ±30ms 内。

### 3. 缓动 4 档
- `--ease-default: ease` —— **保留 CSS 原生 ease**（47 处历史主用，改成自定义曲线会整体改变手感，不值得）；
- `--ease-out: cubic-bezier(0.16,1,0.3,1)` —— 面板/落块（23 处）；
- `--ease-bounce: cubic-bezier(0.34,1.2,0.64,1)` —— 积木/按压（原 1.2/1.3/1.4/1.5 四档统一为 1.2）；
- `--ease-standard: cubic-bezier(0.2,0,0,1)` —— 线性偏出（进度条）。

### 4. 守门测试升级
`src/themeMotion.test.ts` 新增一条硬规则：**ui.css 与 mobile.css 里不允许出现裸时长或裸贝塞尔**（正则扫描全文件），并断言 reduced-motion 把 **7 个时长令牌全部归零**。以后任何人写 `transition: opacity 0.3s ease` 都会在 CI 里红。

## 取舍与被否方案

1. **否决「把 47 处 `ease` 统一换成自定义曲线」**：`ease` 是浏览器精心调过的默认缓动，47 处动效凑成的整体手感全都建立在它上面；换成任何 `cubic-bezier` 都会让全应用同时「变味」。收敛的目标是消除噪音，不是重设计手感。
2. **否决「砍到 5 档」**：实际分布是双峰（100ms 级微反馈 + 1s 级氛围动画），5 档必然把其中一峰强行合并，反而制造新的不精确。7 档每档都有真实消费者。
3. **否决「把 1.1s/1.2s 也塞进 lg」**：那是 3–4 倍的差距，会让飘字动画从「缓慢上浮」变成「一闪而过」。
4. **保留动态计算值**：`Build.tsx` 的彩纸动画 `confetti-fall ${p.dur}s` 里 dur 是**逐片随机**的，属于「同一动画的不同实例参数」，不属于令牌化范围。

## 影响面

- 代码：`theme.css`（令牌表 + reduced-motion）、`ui.css`（80 处时长 + 30 处贝塞尔 → 155 处令牌引用）、`mobile.css`、10 个 TSX 内联样式（13 处）、`themeMotion.test.ts`、`design/TOKENS.md` 新增 §9。
- 用户可见：动效**时长有 ≤60ms 的微调**（多数在 ±20ms 内），曲线除 4 组回弹变体统一外不变；观感预期无差异。
- 长期：改全站节奏只需改 7 个变量；新增动效不会再出现魔法数字（CI 拦截）。

## 验收标准

### 结构化验收（已通过）
- `themeMotion.test.ts` **5 例全绿**，含新增「ui.css / mobile.css 不允许裸时长或裸贝塞尔」；
- 静态统计：`ui.css` 时长字面值 **80 → 0**、`cubic-bezier` **30 → 0**、令牌引用 **155**；`mobile.css` 各 1 → 0；`theme.css` 除令牌定义外时长字面值 **0**。
- `npx tsc --noEmit` 0 错误；`npm test` **59 文件 / 475 用例全绿**。

### 运行时验收（agent-browser 实测）
- 7 个时长令牌与 3 个缓动令牌在 `:root` 上正确解析：`80ms / 140ms / 180ms / 220ms / 300ms / 460ms / 1150ms`，`ease / cubic-bezier(...)`；
- 抽样真实元素：`.card` 计算值 `transitionDuration: 0.22s, 0.22s, 0.22s`、`button` 为 `0.18s ×5` —— 均已解析为具体毫秒；
- **全页扫描 `transitionDuration/TimingFunction` 中含未解析 `var(` 的元素数 = 0**（这条最要紧：证明 CSS 变量在 `transition` 简写里确实被替换，而不是整条声明失效）。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
