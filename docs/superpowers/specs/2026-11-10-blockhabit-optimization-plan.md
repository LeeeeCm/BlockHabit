# BlockHabit 全面优化方案（2026-11-10，第三轮）

- 日期：2026-11-10
- 范围：`src/` 全部模块、`src-tauri/`、仓库根、交付链路
- 设计依据：`design/` 设计中枢（公理 A1–A7 + TOKENS/ART/SURFACES/VOICE 四份基线）
- 输入：三路并行审计共 **89 条**（`design/records/D-20261110-003｜004｜005`）＋设计基线抽取发现的 3 条断链
- 本文合并去重后为 **46 条**，按 A–G 七批落地；每条均可独立交付、独立验证
- 与历史两轮的关系：`2026-09-30`（缺陷与同步重设计）、`2026-10-03`（体验评审快速修复）解决的是「有没有坏」；本轮解决的是「**能不能长期用、能不能交付出去**」

---

## 0. 本轮定位：从「能跑」到「能长期用、能发出去」

前两轮的成果是真实的：schema v2 墓碑合并、WebDAV 条件写、单实例、sprite 精灵缓存、统一弹窗 a11y、主题令牌回归测试、i18n 收口（90 → 1 处内联三元）、图鉴缩略图、系统通知插件，全部已落地并有测试保护（详见三份审计报告的「已实现不重复」表）。

本轮审计暴露的是**另一类问题**：功能都在，但（a）有 3 条「一次误判即全量数据丢失 / 永久白屏」的可靠性缺口；（b）产品的核心承诺（连击奖励块）在视觉上根本不存在；（c）每天用 10 秒、连用 200 天的应用却没有为「长期使用」做任何无障碍与减动效兜底；（d）90.5% 的安装包体积是字体；（e）没有 CI、没有错误边界、没有更新通道——**没有可以出错后兜底的地方**。

一句话结论：**BlockHabit 已经是一个好功能的产品，还不是一个可靠的产品。**

---

## 1. 基线快照（2026-11-10 实测）

| 维度 | 实测值 | 判定 |
| --- | --- | --- |
| 源码规模 | 106–113 文件 / **约 2.1–2.4 万行**（`src` + `src-tauri/src`） | 中等，健康 |
| 测试 | **39 文件 / 358 用例 / 23.1–24.1% 行占比**，`npx tsc --noEmit` **0 错误** | 单测文化良好；缺集成/像素级回归 |
| 最大文件 | `ui.css` 1280 / `iso.ts` 1025 / `BuildScene.tsx` 921 / `ShowcaseScene.tsx` 848 / `SettingsDialog.tsx` 760 | 5 个文件超或逼近 800 行约定 |
| 产物体积 | `dist` **9.80 MB / 429 文件**，其中字体 **8.87 MB（90.5%）** | 严重失衡（见 E1） |
| 安装包 | NSIS **11.47 MB** / MSI **12.54 MB** | 其中约 8.9 MB 是字体 |
| 内容存量 | 12 座建筑共 **1385 块**（plant 24 → castle 190） | 1 习惯≈2 块/天 → 约 693 天封顶（见 F2） |
| 无障碍 | `prefers-reduced-motion` **0 处**、`:focus-visible` **0 处**、热图 **546 个 tab 停留点** | 不达标（见 C 批） |
| 对比度 | amber/白 **1.85:1**、白字绿胶囊 **2.28:1**、fog 绿 **2.54:1**、墨黑+夜间光照积木右脸 **1.03:1** | 系统性不达标（见 C3/C4） |
| 可靠性兜底 | ErrorBoundary **0**、全局错误捕获 **0**、崩溃日志 **0**、CI **0** | 无兜底（见 A4/F5） |
| 交付 | 无自动更新、无签名、无 CHANGELOG/LICENSE | 未进入可发布状态（见 F6） |
| 文档一致性 | README 9 条特性 = 真 4 / 部分 5 / 假 0；细分 17 条 = 真 12 / 部分 3 / **假 2** | 2 条硬伤（7 天 bonus、热图色阶） |
| 设置项 | 12 个持久化字段**全部有消费点**（幽灵设置 0），但 **19 个交互控件 / 新建习惯最多 14 字段** | 功能蔓延（见 D4） |

> 取数方式：`npx tsc --noEmit`、`npm test`、`dist` 逐文件实测、`esbuild` 打包 `blueprints/index.ts` 实算块数、WCAG 公式实算对比度、`npm run dev` + CDP 驱动 Chromium 实测 DOM/焦点/滚动量/screenshot。以上均可在审计报告中复现。

---

## 2. 结论摘要（一页纸）

### 2.1 五个「必须马上修」（否则随时可能丢数据或永久白屏）

| # | 问题 | 后果 | 编号 | 工作量 |
| --- | --- | --- | --- | --- |
| 1 | 读档异常被当成「无存档」，首次交互即用空态覆盖真实存档 | **全量数据丢失**（不可恢复） | A1 | M |
| 2 | 保存无串行队列 + 固定 `.tmp` 名，rename 失败回退直写 | 并发下产生半截 JSON → 存档损坏 | A2 | S |
| 3 | 存档校验不校验蓝图 ID，未知 ID 触发 `getBlueprint` 抛错 | **白屏，且坏档被落盘 → 重启继续白屏（crash loop）** | A3 | S |
| 4 | 无 ErrorBoundary / 全局错误捕获 / 崩溃日志 | 任何渲染异常都会整树卸载；无法定位 | A4 | S |
| 5 | counter 习惯「达标→减一档→加回来」可无限刷块 | 秒级摧毁建造进度与语义 | B2 | S |

### 2.2 三个「战略缺口」（决定产品能不能走远）

1. **核心承诺失效**：README/C 位宣传的「连击每满 7 天，下一块为点缀色奖励积木」**在全链路断链**——数据层不给块打标、渲染层五个入口都不传 `bonus`、`iso.ts` 的琥珀描边是死代码。用户看到的琥珀块其实是全勤块。→ **B1**（三方独立审计交叉验证）
2. **长期使用的身体**：一个每天用 10 秒、连用 200 天的应用，`prefers-reduced-motion` 0 处、键盘焦点不可见、对比度系统性不达标、热图 546 个 tab 停留点。这些不是「打磨」，是**能否长期陪伴**的前提。→ **C 批**
3. **交付链路缺失**：无 CI、无错误边界、无更新通道、无签名、90.5% 体积是字体。→ **A4 / E1 / F5 / F6**

### 2.3 数字目标（本轮结束后应达到）

| 指标 | 现状 | 目标 | 主要手段 |
| --- | --- | --- | --- |
| 安装包体积 | 11.47 MB (NSIS) | **≤ 4 MB** | E1 字体收敛（预计 −7.5 MB） |
| 单次「误判丢数据」风险 | 存在 3 条 | **0 条** | A1/A2/A3 + 导入预检 |
| 渲染异常兜底 | 无 | **ErrorBoundary + 本地崩溃日志** | A4 |
| 无障碍基线 | reduce 0 / focus 0 | **A5 全项落地**（减动效、焦点可见、对比度 AA、语义化） | C1–C4 |
| 键盘全流程 | 不可用 | **可用且可见** | C2/C5/C6/C7 |
| 核心奖励回路 | 断链 | **连击/全勤 bonus 可见可感知** | B1 |
| 交付 | 手工 | **CI 门禁 + 版本记录 + 更新通道** | F5/F6 |

---

## 3. 批次与路线图

| 批次 | 主题 | 条目 | 预估 | 依赖 |
| --- | --- | --- | --- | --- |
| **A** | 数据安全与可靠性（P0/P1） | 12 | 4–5 d | 无（立即开工） |
| **B** | 奖励回路与数据诚实 | 5 | 3–4 d | B1 需设计记录 + 人工确认视觉 |
| **C** | 无障碍与动效纪律 | 10 | 5–6 d | C8 复用 A1 的 loadFailed |
| **D** | 视觉纪律收口（设计中枢落地） | 10 | 4–6 d | D1/D2 需人类先做「点缀色决策」 |
| **E** | 体积、启动与性能 | 4 | 3–4 d | 独立 |
| **F** | 产品化与交付 | 11 | 10–14 d | F4 依赖 Rust HTTP；F6 依赖签名决策 |
| **G** | backlog / 明确不做 | — | — | — |

```
里程碑 M1（1 周）   A 全部 + B2            → 发 0.2.1 hotfix：不再丢数据、不再白屏 loop、不再刷块
里程碑 M2（2–3 周） B1/B3 + C 全部 + D1/D2 → 发 0.3.0：核心奖励可见 + 长期可用（无障碍）
里程碑 M3（4–5 周） E 全部 + C8/D10 + F1/F3/F5 → 发 0.4.0：体积 −75%、首启可用、有 CI
里程碑 M4（6–8 周） F4/F6/F2 + D4  → 发 0.5.0：多设备同步真可用、可更新、有 endgame
持续         G 与 D 的剩余项
```

---

## 4. 完整清单（46 条，去重合并后）

> 编号规则：批次字母 + 序号。`来源` 指对应审计报告条目（C=工程、U=体验、P=产品），完整证据、代码草图与验收方式见审计报告原文。

### 批次 A · 数据安全与可靠性（P0 优先，先做完再谈别的）

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| A1 | P0 | **读档失败被当成无存档 → 空态覆盖真实存档**。`LoadResult` 增加 `loadFailed` 三态，IO/权限/占用异常时挂起持久化并提示「已暂停自动保存」，设置页提供重读 | C1 | M |
| A2 | P0 | **保存串行化 + 唯一临时名**。引入 `saveChain` 队列；tmp 名带序号；rename 失败不再回退直写主档（改为保留 tmp 并报错） | C2 | S |
| A3 | P0 | **校验蓝图 ID 等外键**。`validateState/sanitizeState` 校验 `activeBlueprintId`/`builds.blueprintId`/`completedBlueprintIds` 属于 12 座已知蓝图，非法则拒绝或回落到 `plant`；`getBlueprint` 不再 throw 到渲染层 | P1·C1 / C6 | S |
| A4 | P1 | **ErrorBoundary + 全局错误捕获 + 本地崩溃日志**（`appDataDir/crash-*.log`，保留 5 份；UI 只显示「已记录，可导出诊断信息」） | P·C2 | S |
| A5 | P1 | **v1 旧档迁移可达性**。UI 导入改走 `prepareImport`（先迁移后校验）；v1 载入后立即 `rebuildBuilds` 收敛投影，避免首次撤销丢块/串蓝图 | C7 / C8 | M |
| A6 | P1 | **损坏静默重置要有提示**。载入损坏时保留 `corrupt-backup` 并在 UI 提示「存档损坏已备份，可用备份恢复」，不静默清空 | C9 | S |
| A7 | P2 | `importData` 后统一重建 builds 投影（不变量：builds = f(liveCheckIns, dayClaims)） | C25 | S |
| A8 | P2 | `rebuildBuilds` 按蓝图容量钳制；Build 页进度条 `min(1, n/total)` 防 >100% | C15 | S |
| A9 | P2 | `deleteHabit` 改为「归档优先/硬删需确认」，并清理 `reminderLog`、选择器缓存；同步侧记录硬删复活为已知限制 | C17 / C28 | S |
| A10 | P2 | 关机/注销不等待 async flush；迷你摆件窗口缺关闭拦截。补 `beforeunload`/系统事件 flush 与迷你模式确认 | C22 / C23 | S |
| A11 | P2 | 生产持久化路径（`tauriStorage`）零测试 → 补 mock `plugin-fs` 的单测（含 A1/A2 的回归） | C18 | M |
| A12 | P3 | 跨午夜 10 s 判定窗口；`useRepairBrick` 允许补到习惯创建日前。统一取 `day` 入参 + 创建日下限校验 | C29 / C31 | S |

### 批次 B · 奖励回路与数据诚实

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| B1 | P1 | **连击/全勤 bonus 全链路接回**（三方交叉）：① store 在单习惯打卡时按打卡后连击算 `awardBlock(streak)` 并写入新块 `bonus`；② `BuildScene/ShowcaseScene/BlockDropModal/BlueprintThumb/Polaroid/Poster` 六个绘制入口把 `bonus` 传进 `drawCube`；③ Today 在首/落成卡消费 `res.bonus` 给出「7 天连击」提示；④ `rebuildBuilds` 保留 `bonus` 字段 | C4 / U·bonus / scribe#1 | M |
| B2 | P1 | **counter 刷块漏洞**：掉块判定从「跨阈值事件」改为「当日该习惯是否已掉过块」，负增量只改数值不参与阈值计算 | C3 | S |
| B3 | P1 | **完成态语义统一**：`done` 一律走 `habitMetOnDay`；「已打卡但未达标」的文案/色不再说「已完成」；热图恢复「灰阶点亮 + 全完成日满亮」，绿色只保留进度条 | U5 / U26 / P·C7 | M |
| B4 | P2 | `checkInDay` 无条件庆祝 → 忽略 `reason`/`bonus` 的差异（失败给原因、bonus 给专属反馈） | C12 | S |
| B5 | P2 | 全勤块恒 `bonus:true` 稀释琥珀稀缺性 → 决策并记录（见 D1），区分「连击奖励」与「全勤奖励」的视觉等级 | P·C7 | S |

### 批次 C · 无障碍与动效纪律（「能长期陪伴」的前提）

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| C1 | P1 | **`prefers-reduced-motion` 全仓落地**：令牌层 `--dur-*` + 全局 `@media (prefers-reduced-motion: reduce)` 降级；canvas 侧读 `matchMedia` 走「瞬时落位 + 无粒子」分支（落块 1350 ms → 0） | U2 | M |
| C2 | P1 | **`:focus-visible` 焦点环**：全局令牌 `--focus-ring`（用 `--ink` 双环保证黑底可见），替换 UA 默认 outline；tab 顺序走查 | U3 | S |
| C3 | P1 | **对比度系统修复**：新增 `--accent-text` / `--success-text` / `--info-text` 三枚**文字专用**令牌（填充色不动），把文字/图标从 1.85–2.54:1 提到 ≥4.5:1；oat/fog 次级文字提到 ≥4.5 | U4 | M |
| C4 | P1 | **墨黑 + 夜间环境光积木右脸 1.03:1**：在环境光结果上加重叠对比度地板（保证右脸与 `--bg` ≥ 1.6:1），并加四主题 × 三时段的截图回归 | U1 | S |
| C5 | P2 | **热图键盘/触摸可用**：546 个 tab 停留点收敛为「周行 + 单元格按钮 + roving tabindex」，命中区 ≥ 24×24 | U12 | M |
| C6 | P2 | `useDialogA11y` 抢 autoFocus → 支持 `initialFocus` 显式优先（Ctrl+N 后焦点落在名称输入框） | U10 | S |
| C7 | P2 | 7 个桌面对话框无 `aria-label/labelledby`；移动端 BottomSheet 无焦点圈闭/恢复 | U9 / U11 | S |
| C8 | P1 | **hydration gating**：页面层读 `hydrated` 再渲染，消除暗色/燕麦主题首帧闪白与空态闪现；补启动加载态、筛选后空态、统计空态 | U8 / U18 | S |
| C9 | P2 | `HabitDialog` 关闭丢半填表单 → 关闭前「有改动则确认」，或草稿保留到会话结束 | U19 | S |
| C10 | P2 | 原生 `range`/`select` 未积木化、搜索框与下拉无标签 → 统一到 `.seg` / 积木风控件 + `label` 绑定 | U13 | S |

### 批次 D · 视觉纪律收口（设计中枢的第一次真实执行）

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| D1 | P1 | **「唯一点缀色」决策 + 收口**（需人类拍板，产出设计记录）：A1 写「琥珀」，实际 oat=赤陶 `#c25e3e`、fog=蓝 `#0284c7`、墨黑未重声明，且 A1 所说的「已完成勾」走的是 `--progress-green`。建议方案：把 A1 改为「**唯一点缀色 = 该主题的 `--accent`；默认两主题为琥珀；已完成态用点缀色而非绿色**」，并把约 30 处越界（置顶/星标/chip/回声/导航红点/画报）分批归位 | U·C3 / P·U6 / scribe#2 | S（决策）+ M（改） |
| D2 | P1 | **装饰色越界**：6 座蓝图的彩色部件（28 处 hex）与生态植被硬编码绿，属 A1 之外的新色相。方案：装饰色收敛为「主题派生的 3 档低饱和色 + 植被用 `--block-left` 派生绿灰」，写进 `ART.md` | U6 | M |
| D3 | P2 | **动效令牌化**：现状 17 档时长 / 7 种缓动 / 三处各写一套 → `--dur-xs/sm/md/lg` + 3 条标准 curve，写进 `TOKENS.md`；与 C1 同批 | U·C1 | M |
| D4 | P2 | **设置面板信息架构**：1956 px 内容 / 543 px 视口（3.6 屏）、19 个控件。方案：分 4 组 + 组内折叠，首屏只留「主题/语言/提醒/同步」；把实验性开关收进「实验室」 | U14 / P·C8 | M |
| D5 | P3 | 残留硬编码色 4 处、死 CSS（`.day-check` / `.fab`）、死枚举 `soundMaterial:'mute'`、`setTimeout` 泄漏 | U·C4/C5/C6 | S |
| D6 | P3 | i18n 残留：1 处内联三元（`Today.tsx:196`）、8 个死键、`t.nav?.today ?? '今日'` 兜底 | U23 / scribe | S |
| D7 | P3 | 字号阶梯过密（正文实际 10.5/11/11.5/12/12.5/13/13.5 七档）→ 收敛为 5 档 | U24 | M |
| D8 | P2 | **蓝图名双源且 7/12 不一致**（`generators.ts` 的中文名从未被读取，真源是 i18n）→ 删除死数据；顺手校准 README 漂移 | P·C13 / scribe | S |
| D9 | P2 | emoji 图标残留（🧱）；全屏毛玻璃 6 档 `blur/saturate` 与 A4 相抵 → 收敛为 1 档并记录 | U17 / U20 | S |
| D10 | P1 | **建造页取景**：按「整蓝图 bbox」取景导致开荒期模型仅占画面 30–45% → 改为「已放置块 bbox + 蓝图轮廓淡显」的自适应取景（与 AESTHETIC「看得见的积累」一致） | U7 | S |

### 批次 E · 体积、启动与性能

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| E1 | P1 | **字体占安装包 90.5%**：① Rubik 换 `@fontsource-variable/rubik`（单文件覆盖 400–700，省 ~0.5 MB、48 → 1 文件）；② MiSans 四字重收敛到「Regular + Medium」并验证 600/700 已被阿里妈妈接管（省 ~3.9 MB）；③ 移除 24 个冗余 `.woff`；④ 删除 4 个零引用字族包（fredoka / plus-jakarta-sans / zcool-qingke-huangyou / alimama-fang-yuan-ti-vf）。目标 dist ≤ 3.5 MB | C11 / P·C11 / 实测 | M |
| E2 | P1 | **展台拖拽热路径**：每帧重建整块离屏底座（大 canvas 分配）+ `offsetBlocks` + 阴影/植被重画；`findModelUnderPointer` 每次移动重算 footprint（已有缓存未用）→ 底座离屏缓存 + 派生数据入 ref + 脏区重绘 | C10 / C13 / C14 | M |
| E3 | P2 | `spriteCache` 无内存上限/无 LRU（现 FIFO）、时段光照变化不失效 → 加容量上限 + 光照档位入键 | C16 | M |
| E4 | P2 | 超大文件债务（`iso.ts` 1025 / `BuildScene` 921 / `ShowcaseScene` 848 / `ui.css` 1280）→ 按「投影数学 / 绘制原语 / 场景状态机 / 事件绑定」拆分，先加模块边界再搬代码 | C34 / P·C10 | L |

### 批次 F · 产品化与交付

| 编号 | 严重度 | 标题与方案摘要 | 来源 | 工作量 |
| --- | --- | --- | --- | --- |
| F1 | P1 | **首次使用路径**：无引导（首屏只有空列表 + 新建按钮），看不到「那张会长大的桌子」；新建表单最多 14 字段；首块落块弹窗 3.6 s 自动关闭且不解释「积木去哪了」。方案：首启 3 步轻引导（这是你的桌子 → 建第一个习惯 → 看它落下）、表单默认折叠「选填」、首块专属文案 | U·P1 / P·U1 | M |
| F2 | P1 | **内容供给与 endgame**：12 座共 1385 块，1 习惯≈693 天封顶；全建成后 `nextChoice` 回绕、不再掉块且无任何提示。方案：① 明确「块不是天」的表达（进度显示块数，不暗示天数）；② 落成后进入「自由建造/重铸」模式（拆改已有建筑、无上限装饰件）；③ 公告后续内容节奏 | P·P2 / 实测 | M |
| F3 | P1 | **数据主权**：仅手动 Blob 导出；备份文件（keep 5）与 `corrupt-backup` **没有任何应用内恢复入口**；无「打开数据目录」。方案：备份列表 + 一键恢复 + 打开目录 + 每周自动快照 | P·P1 / U16 | M |
| F4 | P1 | **WebDAV 真可用**：三处 `fetch` 跑在 WebView，无 CORS 头的标准 WebDAV 必然失败；9·30 指定的 Rust HTTP 从未落地（`lib.rs` 只有 3 个命令）。方案：`tauri-plugin-http` 或自写命令代理，浏览器环境保留 fetch 并明确降级提示 | C5 / P·C3 | M |
| F5 | P2 | **CI 与工具链**：无 `.github`、无 lint/format、无 CHANGELOG/LICENSE。方案：GitHub Actions 跑 `tsc --noEmit` + `npm test` + `design:check`；加 ESLint(flat) + Prettier（仅新文件）；补 LICENSE/CHANGELOG | C21 / C34 / P·C9 | S |
| F6 | P1 | **更新与签名**：无 updater、无签名、无更新通道。方案：`tauri-plugin-updater` + 清单签名 + GitHub Releases 通道；签名证书单独决策 | P·C5 | M |
| F7 | P2 | **提醒链路**：只在进程存活时生效，autostart 默认关且无首启提示 → 首启提示「开机自启才能到点提醒」+ 设置页状态自检 | P·U3 | S |
| F8 | P2 | **修复砖三重稀缺**（每座 +1、库存上限 2、7 天窗口）使断签兜底形同虚设 → 改为「每月 2 块 + 连击里程碑奖励 1 块」的宽口径，并记录取舍 | P·U4 | S |
| F9 | P3 | 无产品度量（符合本地优先）→ 提供**纯本地**的诊断包导出（崩溃日志 + 数据体量 + 渲染帧率采样），不做远端上报 | P·C14 | S |
| F10 | P3 | 移动端能力齐备但无构建目标 → 明确取舍：要么 6 个月内出移动构建，要么把移动端标为「实验」并停止投入 | P·P4 | S（决策） |
| F11 | P2 | **文档校准**：README 17 条细分 claim 中 3 条部分、2 条假（7 天 bonus、热图色阶）；历史 spec 与实现漂移（接触阴影参数、三页 vs 四页 tab）→ 统一按 `design/VOICE.md` 与实测重写「特性」段，历史 spec 保持只读 | P·C13 / C26 | S |
---

## 5. 重点条目详案（14 条；其余见审计报告原文）

### A1 读档失败被当成「无存档」→ 空态覆盖真实存档（P0）

- **证据**：`tauriStorage.ts:17–37` 的 `load()` catch 直接 `return { state: null }`；`appStore.ts:620–626` 收到 `null` 仅置 `hydrated: true`，随后 `693–700` 挂上全量订阅 → 任何一次状态变更（含跨天 UI 状态）都会把空态写回磁盘。localStorage 适配器同构（`adapter.ts:356–357`）。
- **方案**：`LoadResult` 增加 `loadFailed?: boolean; detail?: string`（与既有 `needsUpgrade` 同构）；`load()` 先 `exists` 再 `readTextFile` 并把两者分开 catch；`initPersistence` 在 `loadFailed` 时**不挂持久化订阅**，置 `saveError` + 非阻塞 toast「存档读取失败，已暂停自动保存」，设置页提供「重新读取」。
- **验收**：新增 `src/store/persistence.loadfail.test.ts`（mock adapter 返回 `loadFailed`，打卡后断言 `save` 调用 0 次）；`src/storage/tauriStorage.test.ts`（mock `plugin-fs` 让 `readTextFile` reject，断言 `loadFailed === true`）。
- **依赖**：先于 A2（同属持久化批次）；与 A11 测试基建同批。

### A2 保存串行化 + 唯一临时名（P0）

- **证据**：`tauriStorage.ts:47–56` 固定 `path + '.tmp'` 且 rename 失败回退 `writeTextFile(path, json)`（非原子）；`appStore.ts:651–679` 的 `lastSavePromise` 是覆盖赋值而非队列，而 `requestFlushNow()`（`132–134`）在每个关键 action 末尾同步调用 → 「打卡 A → 立刻打卡 B」「打卡 → 导入」「打卡 → 托盘退出 flush」都会在上笔未落地时启动下笔。
- **方案**：① tmp 名带自增序号 `` `${path}.${++seq}.tmp` ``；② 引入模块级 `saveChain: Promise<void>` 串行队列（`persistState` 内 `saveChain = saveChain.then(...)`）；③ `forceFlush()` 返回 `saveChain`，托盘退出握手天然等待全部在途写；④ rename 失败不再直写主档，改为保留 tmp + 报 `saveError`。
- **验收**：`persistence.queue.test.ts`（deferred 控制两次 save 的时序，断言第二次在第一次 resolve 后才调用）；`tauriStorage.test.ts` 断言两次 save 的 tmp 路径不同；手测快速连点 10 次打卡后强杀进程，重启存档可解析且包含全部打卡。

### A3 存档校验不校验蓝图 ID → 白屏 crash loop（P0）

- **证据**：`adapter.ts:127–128` 只校验 `activeBlueprintId` 是非空 string，`builds` 元素（`62–71`）不校验 `blueprintId` 是否属于已知蓝图；`blueprints/index.ts:60–63` 的 `getBlueprint` 直接 `throw`；`App.tsx:232`、`Today.tsx:61`、`Build.tsx:17` 每次渲染都调用 → 抛错整树卸载；更糟的是坏档已被 `requestFlushNow` 落盘 → **重启继续白屏**。
- **方案**：`validateState` 增加外键校验（`activeBlueprintId`/`completedBlueprintIds`/`builds[].blueprintId` ∈ 12 座），非法时 `validate` 整体拒绝、`sanitize` 丢弃非法元素并把 `activeBlueprintId` 回落到 `plant`；`getBlueprint` 增加 `fallback` 参数，渲染层永不再 throw。
- **验收**：`adapter.test.ts` 新增「未知 activeBlueprintId → validate 拒绝 / sanitize 回落 plant」；`App.test.tsx` 新增「builds 含未知蓝图时仍能渲染今日页」。

### B1 连击/全勤 bonus 全链路接回（P1，三方交叉验证）

- **证据（三处独立发现，缺一不可）**：
  1. **数据层**：单习惯打卡创建的积木恒 `bonus: false`（`appStore.ts:312`），`awardBlock` 只在 `checkInDay` 被调用（`467`）且结果仅作返回值（`519`），返回值无 UI 消费（`Today.tsx:327–336` 只读 `complete`）。
  2. **渲染层**：`BuildScene.tsx:301–309`、`ShowcaseScene.tsx:421–426`、`BlockDropModal`、`BlueprintThumb`、`PolaroidModal.tsx:165–170`、`MonthlyPosterModal.tsx:195–201` **六个入口全都不传 `bonus`** → `iso.ts:569/672–677` 的琥珀描边（`bonus` 分支）是死代码。
  3. **投影层**：`builds.ts:24` 的 `rebuildBuilds` 重建时不含 `bonus`，同步/导入后会抹掉标记。
- **方案**：① store 侧按「打卡后的新连击」调用 `awardBlock(streakAfter)` 决定 `bonus` 并写进新块；② 六个绘制入口统一把 `pb.bonus` 传进 `drawCube`；③ `rebuildBuilds` 保留 `bonus`（全勤块恒 true，单习惯块记录原值）；④ Today 在 bonus 时给专属文案（i18n 双语）。
- **验收**：`appStore.test.ts`「第 7 天打卡返回并写入 bonus」；`spriteCache.test.ts`/新增视觉断言「bonus 块调用带 bonus=true」（mock `drawCube` 断言参数）；手测四主题下该块呈琥珀顶面描边。**需先建设计记录并经人类确认视觉**。

### B2 counter 刷块漏洞（P1）

- **证据**：`appStore.ts:283–289` 用「跨阈值事件」判定 `reachedTarget = prevValue < targetValue && nextValue >= targetValue`；`HabitRow.tsx:179–185` 的减号把负增量送进同一 `checkIn`，而 `checkin.ts:65–67` 对 counter 跳过 `already` 拦截 → 「达标 → 减一档 → 加回来」每次都重新跨阈值。
- **方案**：改为「当日该习惯是否已掉过块」+ 正向增量参与阈值：
```ts
const awardedToday = todayCheckIns.some((c) => c.placedBlockId)
const shouldAwardBlock = !isCounter || (!awardedToday && stepDelta > 0 && prevValue < targetValue && nextValue >= targetValue)
```
- **验收**：`appStore.test.ts`「达标 → 递减 → 递增不再掉第二块」（断言 `builds.length` 只增 1）；顺带断言负增量不产生额外 `placedBlockId`。

### C1 `prefers-reduced-motion` 全仓落地（P1）

- **证据**：全仓 **0 处**（`grep -r prefers-reduced-motion src/` 为空）。实测 `reduce=true` 时 `.dialog` 仍 pop-in、canvas `DROP_MS=1350` 照播。这与 `design/README.md` A5「所有动画必须尊重 prefers-reduced-motion」直接冲突。
- **方案**：三件套——① **令牌层**：`--dur-xs/sm/md/lg`（与 D3 同批），全局 `@media (prefers-reduced-motion: reduce) { :root { --dur-xs: 0ms; ... } }`；② **CSS 层**：所有 `transition/animation` 走令牌，容器加 `@media` 兜底 `animation: none`；③ **canvas 层**：`iso.ts` 导出 `prefersReducedMotion()`，`BuildScene/ShowcaseScene` 命中时走「瞬时落位 + 无粒子 + 无压扁回弹」分支。
- **验收**：`matchMedia` mock 单测（reduced 时 `DROP_MS` 返回 0）；CDP `emulateMediaFeatures` 实测截图对比；手测四主题。

### C3 对比度系统修复（P1）

- **证据（WCAG 公式实算）**：琥珀 `#f5b301` 上的白字 **1.85:1**；白字绿胶囊 **2.28:1**；fog 绿 **2.54:1** / 蓝 **2.14:1**；oat/fog 次级文字 **4.31–4.37:1**；fog 完成按钮白字绿底 **2.54:1**。全部低于 AA（正文 4.5 / 大字 3.0）。
- **方案**：新增**文字专用**令牌 `--accent-text` / `--success-text` / `--info-text`（填充色与图标底色不动，保持品牌观感），把「长文本/小字号」场景切到 text 令牌；oat/fog 的 `--ink-2` 上调一档；用 `color-mix` 派生 hover/active 变体。写进 `TOKENS.md` 的「红黑榜」。
- **验收**：新增 `src/contrast.test.ts`（读 `theme.css` 原文实算四主题的关键组合，断言 ≥ 4.5 / 大字 ≥ 3.0）；四主题截图走查。

### D1 「唯一点缀色」决策 + 收口（P1，需人类拍板）

- **证据**：`design/README.md` A1 写「唯一点缀色琥珀 `#F5B301`」，但 `theme.css` 中 oat `--accent: #c25e3e`、fog `#0284c7`、墨黑未重声明；且 A1 明列的「已完成勾」实际用 `--progress-green`（`HabitRow.tsx:243–247`）；约 30 处越界使用点（置顶、星标、心境 chip、回声胶囊、导航红点、画报热力格等，逐条见 `TOKENS.md §7`）。
- **方案（推荐 B 案）**：把 A1 修订为「**唯一点缀色 = 当前主题的 `--accent`；默认纸白/墨黑为琥珀；语义色（完成/进行/危险）不得用于表达情绪或装饰**」，并明确「已完成态用点缀色，绿色只留在进度条」。配套：`--accent-text`（C3）、30 处越界分批归位、`TOKENS.md` 红黑榜更新。**这是设计公理变更，必须建记录并经人类批准后才可执行。**
- **验收**：`design/records/D-2026xxxx` 记录 `approved`；`grep` 越界点归零；四主题截图走查；`design:check` 通过。

### D10 建造页取景（P1）

- **证据**：取景按「整蓝图 bbox」计算，开荒期（3/190 块）模型仅占画面 30–45%，小窗更小。实测截图见 `.tmp-audit-ux/`。这直接违背 AESTHETIC「看得见的积累」——第一块积木应该很显眼。
- **方案**：取景改为「已放置块 bbox（含水平留白）」，同时以 8% 透明度淡显蓝图轮廓/幽灵块作为「下一步在哪」的引导；块数增加时先按 bbox 缩放、超过阈值后切回整蓝图取景，避免相机跳动（用 `lerp` 平滑）。
- **验收**：0/3/20/100/190 块五档截图对比；缩放/拖拽不抖动；`iso.test.ts` 补 `cameraForBlocks()` 纯函数用例。

### E1 字体体积收敛（P1，最高性价比）

- **证据（实测）**：`dist` **9.80 MB / 429 文件**，其中字体 **8.87 MB = 90.5%**。构成：MiSans 四字重（Regular/Medium/Semibold/Bold）× 每字重 ~93 个 unicode-range 分片 = **7.72 MB**；Rubik 四字重 × 6 子集 × **两种格式（woff2 + woff）= 0.58 MB / 48 文件**；阿里妈妈数黑体单文件 0.57 MB。`package.json` 另声明 4 个**零引用**字族包。
- **方案**：① Rubik → `@fontsource-variable/rubik`（单变量文件覆盖 400–700）；② MiSans 收敛为 Regular + Medium（`--font-body` 中 600/700 的 CJK 会被阿里妈妈接管，需先用 CDP `document.fonts`/网络面板证实 Bold/Semibold 零加载再删）；③ 移除 24 个 `.woff`（WebView2/Chromium 只吃 woff2）；④ 删 4 个零引用字族包；⑤ 在 `TOKENS.md` 记录「中文字重路由」这一隐式机制，避免后人改字重时静默换字族。
- **验收**：`dist` ≤ **3.5 MB**；NSIS 安装包 ≤ **4 MB**；四主题截图逐像素 diff（字体渲染不得变化）；`document.fonts` 加载清单里无被删字重。

### F1 首次使用路径（P1）

- **证据**：首次启动只有空列表 + 新建按钮（无 onboarding 组件，`grep onboard|引导` 仅命中提醒模块）；新建习惯表单最多 **14 个字段**；首块落块弹窗 **3.6 s 自动关闭**且不解释「积木去哪了」。用户第一天的核心体验是「填一个长表单 → 看一个小窗口闪一下」。
- **方案**：① 三步轻引导（「这是你的桌子」展示空白地基与蓝图轮廓 → 「建第一个习惯」只问名称与频率 → 「看它落下」自动切建造页并落第一块）；② 表单「必填 3 项」+「高级」折叠；③ 首块走专属文案与更长停留（可点「继续」而非自动消失）。
- **验收**：`?demo-castle` 之外的「全新存档」路径手测；新增 `Onboarding.test.tsx`（仅首次显示、可跳过、写入 localStorage 标记）；截图对比。

### F3 数据主权（P1）

- **证据**：仅 `SettingsDialog` 的手动 Blob 导出；`backup(state)` 已实现（keep 5）与 `corrupt-backup` 都已写盘，但**没有任何应用内恢复入口**；无「打开数据目录」。换机/重装等于全失。
- **方案**：设置页「数据」组增加——当前数据规模（习惯 N / 打卡 M / 建筑 K）、备份列表（时间 + 大小 + 恢复）、「打开数据目录」（`opener` 插件已有）、「导出诊断包」（F9）。恢复走 `prepareImport` 全流程 + 二次确认。
- **验收**：备份→改数据→恢复，数据与备份一致；`SettingsDialog.test.tsx` 覆盖恢复分支；`design:check` 不受影响。

### F4 WebDAV 真可用（P1）

- **证据**：`webdav.ts:99/130/178` 三处 `fetch` 跑在 WebView；`lib.rs:96` 的 `invoke_handler` 只有 `update_tray / tray_menu / confirm_quit`，`Cargo.toml` 无 http 依赖。标准 WebDAV 服务器（nginx-dav、Nextcloud）多数不带 CORS 头 → 同步必然失败。这是 9·30 方案「批次三 Rust HTTP」的前置依赖，至今悬空。
- **方案**：接入 `tauri-plugin-http`（或自写命令代理 `webdav_request`），把 `webdav.ts` 的请求层抽象为 `HttpTransport`（`browser` / `tauri` 两种实现），保留 ETag/条件写/重试逻辑；浏览器环境降级为 fetch 并在设置页标注「浏览器预览不支持跨域同步」。
- **验收**：本地 `nginx-dav` docker 双设备 E2E（已有 `webdav.e2e.test.ts` 骨架）；无 CORS 头服务器下同步成功；`cargo check` 通过。

---

## 6. 明确不做（合并三份审计的「不建议做」+ 历史取舍）

| # | 不做的事 | 理由 |
| --- | --- | --- |
| 1 | **重写 Canvas 渲染为 WebGL/Pixi** | 现有等距 + sprite 缓存已能达 60fps；重写会把「美术资产」变成「着色器资产」，风险远大于收益。性能问题按 E2/E3 局部解决 |
| 2 | **引入 UI 组件库 / Tailwind** | `components/ + ui.css` 就是设计系统，换库等于换视觉语法（AGENTS.md 硬约束） |
| 3 | **加社交/排行榜/成就系统/虚拟货币** | `AESTHETIC.md §5` 明确不做；奖励只允许「积木、建筑、铭文」 |
| 4 | **把数据搬到云端做账号体系** | 违背 A7 本地优先；同步继续走「可选 WebDAV」路线 |
| 5 | **给 WebDAV 密码上 keyring（本轮）** | 需引入 `stronghold`/系统 keyring 依赖与迁移，收益小于 A/F 批次的优先级；在 README 与设置页明示风险即可 |
| 6 | **墓碑 GC 严格化（操作日志版本化合并）** | 现有 90 天 GC 的最坏后果是「离线超 90 天的设备复活一次删除」，概率极低；严格化需引入操作日志，成本过高 |
| 7 | **i18n 加第三种语言** | 当前 zh/en 类型对齐机制健康；第三语言应先有真实用户需求 |
| 8 | **给所有内部模块补到 90% 覆盖率** | 覆盖率不是目标；优先补「持久化 / 同步 / 渲染入口」这些高危路径（A11、A5、B1） |
| 9 | **把 30 处 accent 越界一次性全改** | 会被 review 成一个大 diff；按 D1 决策后分批（每批带设计记录） |
| 10 | **移动端立即出构建** | 需先决策定位（F10）；本轮只保证移动布局不回归 |

---

## 7. 执行纪律（与设计中枢联动，**不可跳过**）

1. **每一处用户可见的改动 = 一条 `design/records/` 记录**（`proposed` → 人工 `approved` → 实现 → `implemented`）。视觉类条目（B1、B3、C2、C3、C4、D1–D10、E1、F1）**没有记录不能开工**。
2. **公理级变更**（D1 修订 A1）必须先写记录并在 `design/APPROVALS.md` 之外单独 review——公理变更不走删除流程，但要人类批准。
3. **令牌先于代码**：所有新颜色/圆角/时长/字号先进 `design/TOKENS.md`，再进 `theme.css`。禁止在组件里发明数值。
4. **不改测试让 CI 变绿**；不删设计记录；不用 `git reset --hard` 清理未提交成果（AGENTS.md §2）。
5. **提交切分**：每批次一个分支，条目级小步提交（`fix:` / `perf:` / `feat:` / `refactor:` / `chore:` / `docs:`）；A 批次建议按 A1→A2→A3 独立提交，便于回滚定位。

## 8. 验收与度量

### 8.1 每批次门禁（缺一不可）

```bash
npx tsc --noEmit        # 0 错误
npm test                # 全绿（含 src/designLedger.test.ts 台账守门）
npm run design:check    # 台账一致 + 无未审批删除
npm run tauri build     # 产物可出（至少 M3 之后每次发布前）
```

### 8.2 各批次专项验收

| 批次 | 专项验收 |
| --- | --- |
| A | 三个 P0 各有回归用例；手测「拔盘/占文件/坏档/断电」四类故障不丢数据 |
| B | bonus 在第 7 天可见（四主题截图）；counter 刷块用例；完成态语义与热图口径一致 |
| C | `emulateMediaFeatures(reduce)` 截图；键盘全流程（Tab/Esc/Shift+Tab/方向键）；`contrast.test.ts`；`document.activeElement` 断言 |
| D | 四主题 × zh/en 截图走查；`grep` 越界点归零；`TOKENS.md` 与代码一致 |
| E | `dist` ≤ 3.5 MB、安装包 ≤ 4 MB；字体渲染逐像素 diff 无变化；展台拖拽帧率 ≥ 55fps（中端核显） |
| F | 全新存档首启走查（录屏）；备份恢复演练；无 CORS 服务器同步成功；CI 绿 |

### 8.3 需要长期跟踪的指标（写在 `design/` 之后可回填）

| 指标 | 采集方式 | 目标 |
| --- | --- | --- |
| 安装包 / dist 体积 | 构建产物实测 | ≤ 4 MB / ≤ 3.5 MB |
| 首屏可交互时间（冷启动） | CDP `performance` 采样 | ≤ 1.2 s（字体收敛后应显著改善） |
| 建造页/展台帧率 | `requestAnimationFrame` 采样 60 帧均值 | ≥ 55 fps |
| 存档写入失败率 | `saveError` 计数（本地） | 0 |
| 崩溃/白屏次数 | A4 的本地崩溃日志 | 0（每次发生必须建缺陷记录） |
| 第 N 块进度分布 | 导出档统计（用户自愿提供诊断包） | 判断 F2 内容供给是否真的成为瓶颈 |

---

## 9. 附录

### 9.1 三份审计报告（89 条原始条目，含完整证据与代码草图）

| 记录 | 文件 | 条目 | 分布 |
| --- | --- | --- | --- |
| D-20261110-003 | `design/records/D-20261110-003-audit-code.md` | 34 | P0×2 / P1×9 / P2×15 / P3×8 |
| D-20261110-004 | `design/records/D-20261110-004-audit-ux.md` | 33 | P1×9 / P2×15 / P3×9（含 15 张浏览器实测截图，存 `.tmp-audit-ux/`） |
| D-20261110-005 | `design/records/D-20261110-005-audit-product.md` | 22 | P0×1 / P1×6 / P2×11 / P3×4 |

### 9.2 89 条 → 46 条的合并规则

合并的是**同一根因**，不是同一标题：

| 合并结果 | 来自 | 为什么合并 |
| --- | --- | --- |
| **B1** bonus 断链 | 工程 C4 + 体验（渲染断链）+ 产品 C4 | 三路独立发现同一条链的三个断点，分开修三次才会真正修好 |
| **A3** 校验缺外键 | 产品 C1 + 工程 C6 | 同一处 `validateState` 缺口，一个说白屏一个说抛错 |
| **E1** 字体体积 | 工程 C11 + 产品 C11 + Lead 实测 | 同一份 dist 证据 |
| **D1** accent 决策 | 体验 C3 + 产品 U6 + 基线 scribe#2 | 同一份公理冲突，需要一次人类决策而不是三次修补 |
| **F1** 首次体验 | 体验「首次启动无引导」+ 产品 U1 | 同一条首日路径 |
| **F5** 工具链 | 工程 C21 + C34 + 产品 C9 | 同一批工程化缺口 |
| **F2** 内容供给 | 产品 P2 + Lead 实算 1385 块 | 需把「感觉快建完了」变成可计算的事实 |

未被合并的细项（约 20 条 P2/P3）保留在审计报告中，按批次顺手处理，不单独排期。

### 9.3 修订历史

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1 | 2026-11-10 | 首版：合并三路审计 + 设计基线，A–G 七批 |

> 本方案为**建议稿**（`design/records/D-20261110-006`，状态 `proposed`）。人类审核确认后，逐批在 `design/records/` 建档并按 §7 执行。