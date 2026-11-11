> 本文档由 design-scribe 于 2026-11-10 从代码事实抽取；修改设计必须先改这里再改代码。

# TOKENS.md —— 设计令牌基线

**取值来源**（唯一权威）：`src/theme.css`（四主题矩阵）、`src/components/ui.css`（控件档位）、`src/mobile.css`（移动端）、`src/render/iso.ts`（画布派生色）。
**铁律**：代码里出现的颜色/圆角/字号/间距必须是下表中的某一档。新增档位 = 先改本文件 → 再改代码。

## 1. 四主题矩阵（来源 theme.css:10–107）

| 令牌 | 纸白 :root | 墨黑 dark | 燕麦陶土 oat | 北欧雾灰 fog |
|---|---|---|---|---|
| `--bg` | #fafafa | #0a0a0a | #f7f4ee | #f1f4f8 |
| `--surface` | #ffffff | #171717 | #ffffff | #ffffff |
| `--ink` | #0a0a0a | #fafafa | #292524 | #1e293b |
| `--ink-2` | #6b6b6b | #9a9a9a | #78716c | #64748b |
| `--line` | #e8e8e8 | #2b2b2b | #e7e2d7 | #cbd5e1 |
| `--accent` | **#f5b301** | 继承 :root = **#f5b301**（未重声明） | #c25e3e | #0284c7 |
| `--accent-ink` | #0a0a0a | #0a0a0a | #ffffff | #ffffff |
| `--overlay` | rgba(0,0,0,.38) | rgba(0,0,0,.65) | rgba(41,37,36,.42) | rgba(30,41,59,.42) |
| `--danger` / `--danger-ink` | #e5484d / #ffffff | #ff6369 / #0a0a0a | #dc2626 / #ffffff | #ef4444 / #ffffff |
| `--progress-blue` | #3b82f6 | #4e9eff | #3b7a99 | #38bdf8 |
| `--progress-green` | #22c55e | #34d274 | #3a835b | #10b981 |
| `--block-top` | #f4f4f4 | #424242 | #fbf9f5 | #f8fafc |
| `--block-left` | #c9c9c9 | #303030 | #dfd8cc | #cbd5e1 |
| `--block-right` | #8a8a8a | #1c1c1c | #574f45 | #334155 |
| `--block-ghost` | #dcdcdc | #262626 | #dfd8cc | #cbd5e1 |

- 只有积木四面有回归测试（`src/theme.test.ts:17–23` 断言四主题全部定义 `--block-*`；缺一个就会让 canvas `addColorStop` 抛异常白屏）。
- ⚠️ **点缀色现状**：`--accent` 只有纸白/墨黑是琥珀；oat=#c25e3e、fog=#0284c7（theme.css:77、96）。与 `design/README.md` A1「唯一琥珀」存在张力，见 §7。

## 2. 圆角体系（theme.css:40–43）

`--r-sm: 10px` / `--r-md: 14px` / `--r-lg: 20px` / `--r-pill: 999px`

| 用途 | 档位 | 来源 |
|---|---|---|
| 底部 tab（桌面胶囊滑块） | `--r-md` | ui.css:81（active 黑底 + translateY(-1px)，ui.css:89–93） |
| 普通按钮 / 输入框 / .seg 容器 | `--r-sm` | ui.css:115、286、302 |
| 卡片 .card / .habit-card / .apple-group | `--r-md` | ui.css:433、462、337 |
| 弹窗 .dialog / .drop-modal | `--r-lg` | ui.css:175、781 |
| 胶囊按钮 .pill-action / .toast / 徽章 | `--r-pill` | ui.css:517、384、849 |
| BottomSheet 顶角 / 移动端 tab 项 | `--r-lg` / 14px | BottomSheet.tsx:124–125、BottomTabBar.tsx:134 |

硬编码例外（**不是新档位，禁止扩散**）：窗口按钮 9px（ui.css:44）、托盘卡片 16px（ui.css:620）、`.fab` 16px（死类，见 §8）、`.card-action` / `.seg button` 8px（ui.css:495、310）、时间步进器 6px（ui.css:1120）、提醒积木 5px（ui.css:1163）。

## 3. 字体体系（theme.css:1–8、34–36；main.tsx:8–15）

| 字族 | 载入方式 | 覆盖 | 降级链位置 |
|---|---|---|---|
| **Rubik** | `@fontsource/rubik` 400/500/600/700（main.tsx:8–11） | 拉丁 + 数字 | 第 1 位 |
| **阿里妈妈数黑体** | `@font-face` + @fontpkg woff2（theme.css:1–8），`font-weight: 600 700` | CJK：U+2E80–2EFF、3000–303F、3400–4DBF、4E00–9FFF、F900–FAFF、FF00–FFEF | 第 2 位 |
| **MiSans** | `misans` Regular/Medium/Semibold/Bold（main.tsx:12–15） | CJK 全字重 | 第 3 位 |

- 降级链原文：`--font-family / --font-body: 'Rubik','AlimamaShuHeiTi','MiSans',-apple-system,BlinkMacSystemFont,sans-serif`；`--font-display` 少一个 MiSans（theme.css:34–36）。
- **中文按字重路由**（无显式声明，靠 @font-face 的 600–700 区间实现）：`font-weight ≥600` → 数黑体；`400/500` → MiSans。**改字重等于改字族**，这是全仓库最容易踩的坑。
- 标题族：`h1,h2,h3,.brand,.big-num` 用 `--font-display` + 600 + letter-spacing .01em（theme.css:127–135）；en 收紧到 -0.025em（theme.css:141–149）；`.brand` 强制 Rubik 700 16.5px / -0.015em（ui.css:21–30）。
- ⚠️ `package.json` 仍声明 4 个**零引用**字族包（@fontsource/fredoka、@fontsource/plus-jakarta-sans、@fontsource/zcool-qingke-huangyou、@fontpkg/alimama-fang-yuan-ti-vf），不得据此认为系统里有这些字体。

## 4. 字号阶梯 / 字重（D7，2026-11-10 收口）

> 改前全站 **20 档**字号（正文就占 9/10/10.5/11/11.5/12/12.5/13/13.5/14/14.5 十一档），
> 改后 **8 档语义令牌**，ui.css / mobile.css / 19 个 TSX 的内联样式全部引用令牌。

| 令牌 | 值 | 语义 | 归并自 |
| --- | --- | --- | --- |
| `--fs-caption` | 11px | 说明、徽章、辅助信息 | 9 / 10 / 10.5 / 11 |
| `--fs-small` | 12px | 次要正文、列表副标题 | 11.5 / 12 |
| `--fs-body` | 13px | 正文默认 | 12.5 / 13 |
| `--fs-subhead` | 14px | 小标题、强调 | 13.5 / 14 / 14.5 |
| `--fs-title` | 16px | 面板标题、页面名 | 15 / 16 / 16.5 / 17 |
| `--fs-heading` | 18px | 区块标题 | 18 |
| `--fs-display` | 20px | 页面大标题、大数字 | 20 / 22 |
| `--fs-hero` | 24px | 首屏日期、落成仪式标题 | 24 / 26 |

**根字号 15px** 也已改为 `var(--fs-title)`（16px）—— 全文基准上移 1px，见记录里的逐页像素差异表。

- 字重只用 **400 / 500 / 600 / 700**；800+ 从未使用。
- 硬规则：新增文字只允许用这 8 个令牌；`themeTypography.test.ts` 会扫描 ui.css / mobile.css / 全部 .tsx 拦住裸字号。
## 5. 间距与尺寸节奏

- 页面级：今日 `padding: 24px 24px 80px; max-width: 720`（Today.tsx:193）；统计 `28px 24px 80px; max-width: 680`（Stats.tsx:160）；建造顶栏 `14px 20px`（Build.tsx:58）；展台顶栏 `14px 22px`（Showcase.tsx:54）；标题栏 `10px 12px 10px 20px`（ui.css:16）；桌面 tab 栏 `10px 14px 12px`（ui.css:67）。
- 移动端覆盖：今日 `14px 14px`、统计 `16px 14px`，底部统一 `calc(var(--tabbar-height) + max(20px, var(--sab)))`（mobile.css:41–48）。
- 卡片网格：`gap: 12px` 双列（ui.css:444），≤520px 单列（ui.css:447–451）；移动端强制 1 列 `gap:10px`（mobile.css:51–54）。卡片 `min-height:172px`、内距 `15px 15px 14px`（ui.css:456–457）。
- 间距实际高频：gap **6**(41) · **10**(24) · **8**(23) · 4 · 5 · 12 · 14 · 16 · 18。取偶数为直角间距，奇数额只允许 5px 徽章内距。
- 触控目标：**最小 44×44**，仅移动端生效（HabitRow.tsx:295–298、322、336、349、400、412、555–580、611–661；App.tsx:432 顶栏设置键）。
- 移动端 `--tabbar-height: 56px`（mobile.css:8）+ 安全区 `--sat/--sab/--sal/--sar`（mobile.css:4–7）；输入框强制 `font-size:16px` 防 iOS 聚焦缩放（mobile.css:80–90）。

## 6. 阴影 / 描边 / 模糊 / 透明度实档

- 阴影只用 3 类：**卡片 1px 级**（`0 1px 3px ink 4%` ui.css:434；`0 1.5px 5px ink 3.5%` ui.css:463）、**弹窗大阴影**（`0 24px 64px rgba(0,0,0,.2)` ui.css:179；drop-modal .22 ui.css:784）、**胶囊/悬浮**（`0 8px 28px rgba(0,0,0,.22)` ui.css:386；托盘 `0 2px 8px` ui.css:623；BottomSheet `0 -4px 24px rgba(0,0,0,.16)` BottomSheet.tsx:130）。**禁止 3 层以上叠加**（唯一双段：.dialog ui.css:179、卡片 hover ui.css:472–473）。
- 模糊（backdrop-filter）档位：**4 / 8 / 12 / 14 / 20 / 25 px**。4=BottomSheet 遮罩（BottomSheet.tsx:110）；8=画布浮层卡（Build.tsx:203、Showcase.tsx:115）；12=落块遮罩（ui.css:762）；14=主弹窗遮罩（ui.css:153，配 saturate(180%)）；20=移动端顶栏（App.tsx:414）；25=移动端底栏（BottomTabBar.tsx:101，配 saturate(190%)）。
- 描边：**1px = 分割线与卡片**（`--line`）；**1.5px = 交互控件轮廓**（.btn ui.css:112、输入框 282、ts-btn 1119）；画布内部三面交界 `ink@0.4 / 1px`、剪影 `ink@0.58 / 1.5px`（iso.ts:540–547）。
- 透明度档位（`color-mix` 百分比，实际在用）：2 / 2.5 / 3 / 3.5 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 12 / 14 / 18 / 25 / 35 / 45 / 55 %。语义基准：2–4% 极淡底、6–9% 交互态底、12–18% 选中底、35–55% 描边与遮罩。不要新增 22%、37% 这类无意义值。
- 遮罩双轨：`.overlay` 用 `var(--overlay)`（ui.css:152），`.drop-overlay` 用 `color-mix(in srgb, var(--ink) 35%, transparent)`（ui.css:761）。**新表面统一用 var(--overlay)**。

## 7. 点缀色纪律（`--accent` 全仓库使用点）

`design/README.md` A1 只允许三处：① 已完成勾 ② 今日新落积木高亮 ③ 连击/全勤奖励块。**代码现状 = 21 处 CSS + 43 处 TSX + 6 处渲染层**，逐类判定：

| 类别 | 代表位置 | 判定 |
|---|---|---|
| 今日新落积木高亮 | iso.ts:668（highlight 描边 2.4px）、BuildScene.tsx:308 | ✅ 合规（②） |
| 连击/全勤奖励块 | iso.ts:674（bonus 顶面描边 1.5px）、659 | ✅ 合规（③），但**渲染层从未传入 bonus**，见 ART.md §7 |
| 全勤卡（今日） | Today.tsx:294–295、305、320–322 | ✅ 合规（③ 的 UI 表达） |
| 透视考古发光块 | BuildScene.tsx:303（color: palette.accent） | ✅ 合规（② 的变体） |
| 已完成勾 | HabitRow.tsx:243–247 用的是 `--progress-green` | ❌ **①未按 A1 实现：勾是绿色不是琥珀** |
| 置顶 | HabitRow.tsx:321、ui.css:506–507、857 | ⛔ 越界 |
| 铭文星标 / 精选筛选 | ui.css:982–984、HabitRow.tsx:500、Stats.tsx:446–454、FoundationNoteDialog.tsx:128、BuildScene.tsx:881 | ⛔ 越界 |
| 心境 chip 选中 | ui.css:939–940、HabitRow.tsx:508、BuildScene.tsx:888、Stats.tsx:493 | ⛔ 越界 |
| 回声胶囊 | ui.css:1008–1009、Today.tsx:354、Stats.tsx:244 | ⛔ 越界 |
| 提醒相关 | ui.css:1124、1168、1214、1219、1257–1258 | ⛔ 越界（「临近截止」语义应走 danger） |
| 导航强调 | BottomTabBar.tsx:41（未完成红点）、64（进度%）、169（active 下划线） | ⛔ 越界（导航强调只应是黑白反转） |
| Toast / 空态 / 装饰 | ui.css:391、Today.tsx:415–419、Showcase.tsx:61/74、Build.tsx:109/123/216/313 | ⛔ 越界 |
| 统计 / 设置图标 | Stats.tsx:209、SettingsDialog.tsx:658–659 | ⛔ 越界 |
| 画布导出（拍立得/画报） | PolaroidModal.tsx:284（含 #f5b301 兜底）、MonthlyPosterModal.tsx:89/106/211/254 | ⛔ 越界 + 硬编码兜底 |
| 生境花砖 | iso.ts:899（top:'#f5b301'） | ⛔ 越界（且硬编码） |

硬编码琥珀盘点：`#f5b301` 仅 3 处（theme.css:16 令牌本体、iso.ts:899、PolaroidModal.tsx:284 兜底）；`#f59e0b` 仅 3 处（generators.ts:279 黄铜拨盘、374 焰色 = 建筑专属配色；spriteCache.test.ts:16 夹具）。**UI 层 0 处** —— 2026-09-30 方案 §4.3 已落地。

## 8. 令牌使用红黑榜

| 允许 | 禁止 |
|---|---|
| `var(--bg/surface/ink/ink-2/line/accent/accent-ink/overlay/danger/progress-*/block-*)` | 任何裸 hex / rgb() 写进 UI（画布与蓝图配色除外，见 ART.md） |
| 半透明派生 `color-mix(in srgb, var(--ink) N%, transparent)` | 新增第二套琥珀 / 绿 / 红 / 蓝 |
| 圆角只取 `--r-sm/md/lg/pill` | 自造 13px / 18px / 7px 圆角 |
| 字号取 §4 阶梯 | 12.8 / 17.5 / 11.2 这类中间值 |
| `--progress-green`=完成、`--progress-blue`=进行中、`--danger`=删除 | 用 `--accent` 表达状态、用绿色表达「成功按钮」 |
| 移动端触控 ≥44×44 | 40px 以下可点区域（.icon-btn 38px 仅限桌面） |
| 阴影 ≤2 层且来自 §6 | 卡片套卡片套阴影、用 box-shadow 伪造 3D |
| 深色主题用 `color-mix` + `--line` 分层 | 硬编码 `rgba(0,0,0,.x)` 阴影（深色下偏重，现存 12 处技术债） |

**已确认的死令牌 / 死规则（改设计时直接忽略，勿引用）**：`.day-check`（ui.css:659–698，无任何 JSX 引用）、`.fab`（ui.css:406–427，无引用）。

## 9. 动效令牌（D3，2026-11-10 收口）

> 改前：**17 个时长字面值 + 7 种缓动**散落在 ui.css / mobile.css / 10 个 TSX 内联样式里；改后全部走令牌，
> 由 `src/themeMotion.test.ts` 守住「不许再写裸值」。

### 时长阶梯（7 档）

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `--dur-2xs` | 80ms | 按压/点击的即时反馈 |
| `--dur-xs` | 140ms | 悬停、描边变色 |
| `--dur-sm` | 180ms | 小元素位移、按钮态切换 |
| `--dur-md` | 220ms | 卡片、面板展开收起 |
| `--dur-lg` | 300ms | 大面板进出、进度条 |
| `--dur-xl` | 460ms | 大块移动（长距离宽度过渡） |
| `--dur-scene` | 1150ms | 氛围类：飘字上浮、庆祝彩纸 |

映射原则：原字面值就近归档，最大偏移 **±60ms**（1.2s 的 5%，一次性动画），逐条映射见 `design/records/D-20261110-026-d3-motion-tokens.md`。

### 缓动（4 档）

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `--ease-default` | `ease` | 历史主用（47 处），保留 CSS 原生曲线，零观感变化 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 面板/落块：快出慢停（23 处） |
| `--ease-bounce` | `cubic-bezier(0.34, 1.2, 0.64, 1)` | 积木/按压：轻微回弹（原 1.2/1.3/1.4/1.5 四档统一为 1.2） |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 线性偏出（进度条） |

### 减少动态偏好

`prefers-reduced-motion: reduce` 下**全部 7 个时长令牌归零**，另有一层 `animation-duration / transition-duration: 0.01ms !important` 兜底。

### 硬规则

1. 新动效只允许写 `var(--dur-*)` / `var(--ease-*)`；
2. 迭代/填充关键字（`linear` / `ease-in` / `forwards` / `both` / `infinite`）不受限制；
3. 需要新档位时**先改令牌表再改代码**，不允许在组件里加魔法数字。
