> 本文档由 design-scribe 于 2026-11-10 从代码事实抽取；修改设计必须先改这里再改代码。

# ART.md —— 积木与场景美术规范

**唯一渲染入口**：`src/render/iso.ts`（几何/着色/缓存）+ `BuildScene.tsx`（建造页）+ `ShowcaseScene.tsx`（展台）。图鉴缩略图、拍立得、月度画报都复用同一套 `drawCube`。**不允许出现第二套透视或第二套着色。**

## 1. 等距投影约定

- 公式（iso.ts:21–26）：`sx = (x − y) · tileW/2`，`sy = (x + y) · tileH/2 − z · blockH`；(sx, sy) 是**立方体顶面菱形中心**，不是左上角。
- 尺寸（iso.ts:55–57）：`DEFAULT_ISO_CONFIG = { tileW: 48, tileH: 24, blockH: 29 }`，`STUD_H = 5`。即 2:1 等距、单块屏幕投影 48×24、块身 29px（约 tileW×0.604，注释口径"宽:深:高 = 1:1:1.2"，iso.ts:54）。
- 旋转（iso.ts:29–49）：`rotateCoord(x,y,cx,cy,rot)` 只接受象限 0/1/2/3，绕蓝图 bbox 中心 `(cx,cy) = (round 中点)` 旋转（BuildScene.tsx:146–158）。建造页 ±90° 只重绘、**不重播**落块动画（BuildScene.tsx:692–695）。
- 画家算法排序键：**先 `rx+ry` 升序，再 `z` 升序**（BuildScene.tsx:161–173；展台同键 compareCubes，ShowcaseScene.tsx:49–55）。iso.ts:52 的 `depth()` 仅测试保留，实际排序不在 iso.ts。
- 视角：滚轮缩放 clamp **0.3–3**（BuildScene.tsx:805），双指 pinch **0.5–3.0**（461）；展台 wheel **0.4–2.5**（ShowcaseScene.tsx:792）、pinch **0.4–2.5**（586）；窗口 resize 跟随 `followResize` clamp **0.3–3**（iso.ts:82–85）。
- 自动取景（BuildScene.tsx:617–634）：`PAD = 48`，`scale = min((w−96)/模型的宽, (h−96)/模型的高, 2)`，`panY = h·0.56 − 中心y·scale`（**整体下沉约 6% 视口**，给"桌子"留出上方空气）。展台：`SHOWCASE_GRID_SIZE = 26`（logic/showcase.ts:3）、初始 `scale = min((w−48)/sceneW,(h−48)/sceneH,1.2)`（ShowcaseScene.tsx:451）。

## 2. 立方体三面着色模型（iso.ts:180–196，由 --block-* 派生）

| 面 / 部件 | 渐变起 | 渐变止 | 方向 |
|---|---|---|---|
| 顶面 `gTop` | `topA = top×1.00` | `topB = top×0.90` | 后缘 → 前缘（垂直） |
| 左面 `gLeft` | `leftA = left×1.00` | `leftB = left×50/65 ≈ 0.769` | 上 → 下 |
| 右面 `gRight` | `rightA = right×1.00` | `rightB = right×22/35 ≈ 0.629` | 上 → 下 |
| 凸点顶面 `studTop` | `topA×1.08` | — | 纯色 + 左上高光弧 |

- 明度关系**恒定**：顶面 > 左面 > 右面（四主题实测：纸白 #f4f4f4 / #c9c9c9 / #8a8a8a；墨黑 #424242 / #303030 / #1c1c1c）。换主题只换三面基色，**不得反转明暗**。
- 自定义配色（蓝图 `color` 字段、生境植被）走另一端 `deriveShadingForColor`（iso.ts:201–216）：顶 1.00/0.88、左 0.78/0.62、右 0.52/0.36、凸点 1.08。⚠️ 与主题配色（1.00/0.90、1.00/0.769、1.00/0.629）**不是同一套阶梯**，同一屏混用会看出两种打光。
- 明暗叠加顺序（iso.ts:507–543）：左面 → 右面 → **AO 压痕** → 顶面 → **顶面高光** → 交界线。

## 3. 圆角、倒角、凸点、描边

- 剪影圆角（iso.ts:480–481、590–591）：`cornerR = min(3, tileW·0.0625) = 3px`，逐顶点半径 `[0, r, r, 0, r, r]` —— **顶角 T 与底角 B 保持尖角**，左右四个角倒 3px。用 `roundedPoly`（arcTo）绘制，避免 2D 圆弧伪影。
- 顶部凸点（iso.ts:337–383、551）：`rx = tileW×0.25 = 12`，`ry = rx × (tileH/tileW) = 6`，高度 `STUD_H = 5`，位置 = 顶面菱形中心；侧裙左半用 `leftA`、右半用 `rightA`（以 cx 竖向 clip），描边 `ink@0.4 / 1px`；顶面用 `studTop`；**左上高光弧**：椭圆 0.68r、角度 1.05π→1.6π、`rgba(255,255,255,0.6) / 1.2px`。上方有块时 `noStuds: true`（BuildScene.tsx:304），省掉凸点避免穿模。
- 描边策略（"1px 细线"在 3D 里的落地）：剪影外轮廓 `ink@0.58 / 1.5px`（iso.ts:545–548）；三面交界 `ink@0.4 / 1px`（534–542）；**不做外发光、不做投影滤镜**。
- 装饰块：`window` = 左面点缀色平行四边形，圆角 1.5px（iso.ts:729–744）；`gate` = 右面 `ink@0.55` 平行四边形（745–760）。除此之外**不得新增装饰件**（无旗帜/无独立物件，generators.ts:3–6）。

**装饰色的边界（D2 决议，D-20261110-048）**：蓝图里的少量彩色部件（陶土红墙、绿植、木色构件）是**刻意保留的实物隐喻**——积木是「可以拿起来的实物」，玩具砖本来就有颜色。它们不是点缀色，也不承担奖励信号；因此**不做主题化收敛**。约束只有两条：①不得新增渐变/阴影/发光；②不得让装饰色的数量或饱和度继续增长（新增蓝图的彩色块比例需在记录里说明）。

## 4. 光照与环境光（iso.ts:953–1023）

`getTimePeriod()` 时段：**6–10 dawn / 10–16 noon / 16–19 dusk / 其余 night**（956–961）。

| 时段 | top | left | right | ghost |
|---|---|---|---|---|
| dawn 晨曦 | ×1.14 | ×1.08 | ×0.90 | — |
| noon 正午 | ×1.00（恒等） | ×1.00 | ×1.00 | — |
| dusk 黄昏 | ×1.10 | ×0.84 | ×0.68 | ×0.90 |
| night 夜幕 | ×0.90 | ×0.68 | ×0.55 | ×0.75 |

- 开关：`settings.enableAmbientLighting !== false` 默认开（BuildScene.tsx:230，Settings 勾选 "时段感知昼夜光照"，zh.ts:327–330）。关闭时恒按 noon 标准光。
- 缓存：`paletteFromDocument()` 记忆化，key = `主题名 + (时段 | 'std')`（iso.ts:1002–1023）。**注意**：缓存不含"跨时段"监听——页面不重绘就不会跨过 10/16/19 点着色，切主题是唯一必然失效点。
- 重力视差（可选）：陀螺仪偏移 clamp ±5px（BuildScene.tsx:826–840），EMA 0.8/0.2；遵循减弱动态设置。

## 5. 地面、阴影、地基、幽灵

- **接触阴影**（iso.ts:827–872）：取已放置块脚印 bbox 内缩 `inset = 1.05`，四角投影求中心，用 `scale(1, halfH/halfW)` 压扁成等距椭圆（**不是旋转 ±30°**），径向渐变 `ink@0.12 → ink@0.05 (65%) → 0`，halfW ≥ 8、halfH ≥ 4。建造页只对**已放置块**求脚印（BuildScene.tsx:259–263），展台对每座模型整脚印（ShowcaseScene.tsx:303–312）。
- **地基虚线**（iso.ts:795–824）：包围盒 `margin = 1.0 格`；透视圆角梯度 `bottom 0.95 > side 0.70 > top 0.50`（近大远小的严格等距弧）；填充 `rgba(128,128,128,0.05)`（**硬编码灰，未令牌化**）；虚线 `setLineDash([8,6])`，描边 `--block-ghost / 1.4px`，round cap/join；整体下移 `blockH`。
- **展台沙盘**（ShowcaseScene.tsx:112–164、202–260）：26×26 网格、`slabH = 12` 厚度、顶角半径 1.7 / 侧 2.1 / 底 2.6；顶面 `palette.top`、裙边 `palette.left`、外轮廓 `ink / 1.5px`、内部网格 `ink@0.08 / 0.8px`、底影 `ink@0.06`（下移 6px）。底座整体离屏缓存，key 见 §8。
- **幽灵块**：`globalAlpha 0.15` + `--block-ghost` 填充/1px 描边（iso.ts:594–605）。用于拖拽非法落位（ShowcaseScene.tsx:425）。
- **X-Ray 透视考古**（BuildScene.tsx:298–308）：无随笔块 → 全幽灵化；有随笔块 → 用 `palette.accent` 作块色 + `highlight` 2.4px 描边发光。页内开关 + 默认态来自 `settings.enableXRayInspection`（Build.tsx:30–31）。

## 6. 落块动画曲线（真实数值，BuildScene.tsx:40–111）

| 参数 | 值 | 说明 |
|---|---|---|
| `DROP_MS` | **1350ms** | 单块掉落总时长（慢落 + 果冻） |
| `DROP_FALL_FRAC` | **0.42** | 前 42% 下落，之后回弹 |
| 下落曲线/高度 | `easeInCubic`，**7 块高度** | `z: 7 → 0` |
| `jelly(t)` | `w = −0.34·cos(3πt)·(1−t)`；`hop = 0.55·max(0,sin(2πt))·(1−t)` | `sx = 1 − 0.85w`、`sy = 1 + w`（压 Y 胀 X，守体积）；伴随一次小跳 |
| `BLOCK_T` | **640ms** | 级联单块时长（更快更硬） |
| `CASCADE_FALL_FRAC` | **0.53** | 级联下落占比，高度 **4.5 块** |
| `LAYER_STAGGER` | **0** | 同层完全同时下落 |
| `LAYER_OVERLAP` | **0.55** | 下层回弹进行到 55% 时上层开始落 |

- 缩放锚点：以**静止底边**为锚点 `translate(sx, sy + tileH/2 + blockH − zOff·blockH)` 再 `scale`（BuildScene.tsx:338–342），保证"压扁时底边不动、只向上缩"。
- 音效配对：落地 `playJellySound()`（BlockDropModal.tsx:59）、级联/放置 `playSnapSound()`、落成 `playCelebrationSound()`。
- CSS 侧动效档位（供 UI 复用，勿自造）：遮罩淡入 0.2s `cubic-bezier(.16,1,.3,1)`（ui.css:159）；弹窗 pop-in 0.22s scale .94→1（241–250）；drop-modal 0.24s `cubic-bezier(.34,1.2,.64,1)`（788）；关闭 0.22s→scale .95（794–797）；按压 `scale(.95)/0.08s`（366–373）；提醒积木 0.5s `cubic-bezier(.34,1.3,.64,1)`，延迟 0.05/0.28/0.51s（1184–1186）。

## 7. bonus 积木、粒子、落成仪式、微生态

- **bonus（连击奖励块）**：`drawCube({bonus:true})` 会在顶面描 `--accent / 1.5px` 边（iso.ts:672–677）。数据层已就位（store 全勤块 `bonus:true` appStore.ts:491；连击 7 天 `isStreakBonus` appStore.ts:467/519），但**所有调用点都没传 bonus**（BuildScene.tsx:301–309 faceOpts 无此键；ShowcaseScene.tsx:421–426、PolaroidModal.tsx:165–170、MonthlyPosterModal.tsx:195–201、BlueprintThumb 均无）。⇒ **奖励块目前外观与普通块完全一致，这是断线，不是设计取舍。**
- 落成仪式（Build.tsx:250–299、311–344）：全屏 `color-mix(var(--bg) 82%)`；标题 26px / letter-spacing .04em；副标 14px ink-2；四按钮（奠基铭言 / 纪念相纸 / 下一个目标 / 关闭）；粒子 **36 片**，色板 `[--ink, --ink-2, --line, --accent]` 循环，尺寸 5–12px，时长 1.4–2.6s，随机 rotate + 下落 110vh / 340° 收尾。
- 微生态植被（logic/eco.ts:9–15 + iso.ts:877–952）：阶段 **1 天萌芽 / 7 天小径 / 21 天树 / 100 天花园**；迷你积木 `{tileW:16, tileH:8, blockH:7}`；三套调色板 —— 绿 `#8fce8f/#57a457/#2f7d3a`（ink rgba(24,58,32,.55)）、石 `#d6d3d1/#a8a29e/#78716c`、花 `#f5b301/#d99e00/#b58500`；`back` 层画在积木前（两侧探出）、`front` 层画在积木后（站在建筑前）；要求 `blocks.length ≥ 2`，位置固定在 margin 环带（距积木中心 ≥1.4 格）。开关 `settings.enableEcoProps` 默认开（BuildScene.tsx:132）。

## 8. 精灵缓存 spriteCache（iso.ts:395–451）

- 键 = `(color ‖ "top_left_right") + type + noStuds + tileW + tileH + blockH + dpr + ink + accent + top + left + right`（iso.ts:411）。**任一项变 → 新键**；上限 `MAX_SPRITE_CACHE = 512`，超出删最旧键。
- dpr 量化：`clamp(round(transformScale×4)/4, 1, 4)`（iso.ts:622），所以 view.scale>1 放大时刻度会变、烘焙密度跟着变；导出画布显式传 `spriteScale: 2`（PolaroidModal.tsx:166、MonthlyPosterModal.tsx:200）。
- 精灵画布尺寸 = `ceil(tileW + 8) × ceil(tileH + blockH + STUD_H + 8)`（pad 4），锚点 `(w + 4, h + STUD_H + 4)`。
- **显式失效只有一处**：主题切换 `clearCubeSpriteCache()`（App.tsx:298–301）。改这三件事时必须补清缓存：① `--block-*` / `--ink` / `--accent` 取值；② `DEFAULT_ISO_CONFIG` 或 `STUD_H`；③ `deriveShading` 的乘数表。忘记清的后果是"改了不生效、重启才变"。
- 其他缓存：图鉴缩略图/展台底座离屏层 key `w×h|dpr|scale|panX|panY|gyro|ambient|ink|top|left`（ShowcaseScene.tsx:280）；调色板缓存 `theme|period`（iso.ts:1005）。

## 9. 美术改动检查清单（改积木/场景必须先跑通这 8 条）

1. **四主题 × 四积木面**：`--block-top/left/right/ghost` 全部非空且可解析（theme.test.ts 已覆盖；漏一个 = canvas 抛异常白屏，2026-10-03 事故）。
2. **明暗不反转**：顶 > 左 > 右；墨黑主题右脸（#1c1c1c）与背景（#0a0a0a）仍要能看出分离。
3. **凸点不穿模**：上方有块时 `noStuds` 生效；凸点高光弧仍在左上。
4. **描边不变粗**：剪影 1.5px / 交界 1px；新增描边一律用 `ink` 透明度派生，禁止第二色相。
5. **时序**：单块 1350ms、级联 640ms、层重叠 0.55 —— 改任一值必须同步复核 `planCascade` 与 `BlockDropModal` 的 3.6s 自动关闭（BlockDropModal.tsx:64–66）。
6. **缩放锚点**：压扁回弹必须以底边为锚（否则"积木陷进桌面"）。
7. **接触阴影跟随已放置块**，不是蓝图全集（开荒期阴影比建筑大数圈的回归项）。
8. **精灵缓存失效**：改了颜色/几何/明度表 → 确认主题切换与 resize 后正确重烘焙。
9. **截图对比四主题**：纸白/墨黑/燕麦陶土/北欧雾灰各一张建造页 + 一张落块弹窗。
10. **未知量与文档对齐**：本条若与本文不符，先改本文再改代码；文档与实现的已知偏差见 §5（接触阴影 ±30° 与 margin 0.4 是旧设计稿描述，代码已是椭圆 + inset 1.05）。

---

## 10. 蓝图材质色（D-20261111-067）

蓝图颜色是**实物材质隐喻**，不是奖励信号，也不随主题/时段变化（环境光只改变明暗，不改变色相）。

固定材质调色板（全部为仓库既有色值，不新增色相；机器可读契约见 `src/logic/blueprints/palette.ts`）：

| 家族 | 色值 | 语义 |
| --- | --- | --- |
| 石/灰 | `#94a3b8` `#64748b` `#475569` `#334155` | 石基、墙体、板岩、金属 |
| 浅色 | `#f8fafc` `#f1f5f9` `#e2e8f0` `#cbd5e1` `#a89f91` | 白墙、玻璃、亚麻、浅石 |
| 木/土 | `#78350f` `#854d0e` `#b4533c` `#9c432f` `#c69c6d` `#4a2c1d` | 木构、砖、陶土、沙岩、咖啡 |
| 暖光 | `#f59e0b` `#e9c46a` `#d97706` | 黄铜、灯、钟面、金杏 |
| 冷光 | `#0284c7` `#1e293b` | 玻璃/镜头/眼睛、深墨 |
| 生命 | `#4f776a` | 鼠尾草绿：植物、铜绿、树冠 |
| 信号 | `#e11d48` `#ef4444` | 灯塔条纹、火箭翼、红点（极小面积） |

规则：
1. 每座蓝图在 `BLUEPRINT_COLOR_PLAN` 声明角色 → 色值；测试验证每个角色都实际出现、每座 ≥3 色、跨 ≥2 材质家族。
2. **所有块都有材质色**；**非中性强调色**（木/土、暖光、冷光、生命、信号五族）占比 ≥ 8%（按座微调，见 `minAccentRatio`），不再使用「彩色块 15%–70%」旧口径；石/浅色大户（城堡、钟楼等）靠屋顶/门窗/灯具保证识别度。
3. 信号红只做识别性小面积；**火箭红翼、灯塔条纹是主体识别色例外**，允许 15%–20%，禁止继续扩大。
4. 窗户/门用材质色（暖光/木色），不统一刷成主题点缀色；主题 `--accent` 仍只用于奖励与交互。
5. 新蓝图只能从本表取色；要新增色相必须先新增记录并由人类批准。
6. 既有 12 座的坐标/块数/顺序不得因配色而变；扩展包允许为树冠/灯柱增加少量有支撑块。
