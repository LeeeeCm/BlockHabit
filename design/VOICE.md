> 本文档由 design-scribe 于 2026-11-10 从代码事实抽取；修改设计必须先改这里再改代码。

# VOICE.md —— 文案与语气规范

**唯一文案源**：`src/i18n/locales/zh.ts` / `en.ts`（schema 在 `src/i18n/types.ts`）。**任何用户可见文字都必须经 `const { t } = useI18n()` 取用**，画布绘制类例外必须写注释说明。

## 1. 语气基线

**中文（zh）**：第二人称「你」、短句、动词开头、可省主语；克制不说教，不喊口号，不堆感叹号（全库仅 12 处"！"，且只用于落成 / 领取 / 复制成功这类瞬时反馈）。允许一点口语（"抓紧开始"、"搞定"），禁止网络流行语与卖萌。情感落点永远是"积累 / 时间 / 具体动作"，不是"你很棒"。
- 正例：`还没有习惯。点右上角 + 创建第一个，每完成一个习惯即可为「名字」掉落一块积木。`（zh.ts:42–43）；`该开始「名字」了 🧱`（362）；`每一次打卡，都算数。`（325）
- 反例：`快来一起坚持吧！！`、`你今天真棒鸭~`、任何成就系统话术（等级 / 经验 / 打卡王）。

**英文（en）**：sentence case（句首大写，不用 Title Case）、祈使句、比中文更直接；不堆感叹号，不用俚语缩写（gonna / wanna）。
- 正例：`No habits yet. Click + in top-right to create your first one.`（en.ts:57–58）；`Every brick clicked builds something lasting.`（en.ts:342）
- 反例：`Let's Crush It Today!!!`、`You got this 💪`。

## 2. 中英术语对照（**改文案必须沿用，不得新造同义词**）

| 概念 | 中文 | 英文 | 证据 |
|---|---|---|---|
| 习惯 | 习惯 | Habit | zh.ts:44 / en.ts:59 |
| 打卡（动作） | 打卡 | Check-in | zh.ts:51 / en.ts:66 |
| 积木 | 积木 | Block / Brick | zh.ts:102 / en.ts:118 |
| 蓝图 / 建筑 | 蓝图 · 建筑 | Blueprint · Building | zh.ts:116 / en.ts:132 |
| 落成 | 落成 | Completed | zh.ts:106 / en.ts:122 |
| 连击 | 连击 · 连续 N 天 | Streak | zh.ts:179 / en.ts:165 |
| 全勤 | 全勤大满贯 | All-Clear | zh.ts:82 / en.ts:98 |
| 修复砖 | 修复积木 | Repair Block | zh.ts:145 / en.ts:161 |
| 展台 | 展台沙盘 | Showcase Island | zh.ts:133 / en.ts:149 |
| 透视考古 | 透视考古 | X-Ray | zh.ts:127 / en.ts:143 |
| 奠基铭言 | 奠基铭言 · 奠基石 | Dedication / Foundation Inscription | zh.ts:118 / en.ts:134 |
| 镌刻 | 镌刻成砖 | Engrave | zh.ts:417 / en.ts:433 |
| 随笔 / 心境 | 打卡随笔 · 心境 | Reflection / Mood | zh.ts:431 / en.ts:448 |
| 手账长廊 | 自律手账长廊 | Chronicle | zh.ts:429 / en.ts:446 |
| 画报 | 月度包豪斯自律画报 | Monthly Poster | zh.ts:444 / en.ts:461 |
| 拍立得 | 落成纪念相纸 | Polaroid | zh.ts:239 / en.ts:255 |
| 摆件 | 桌面灵动摆件 | Mini Desk Toy | zh.ts:35 / en.ts:50 |
| 温和风化 | 抗断卡韧性 · 温和风化 | Gentle Decay / Weathering | zh.ts:331–334 / en.ts:348–351 |
| 微生态彩蛋 | 建筑微生态彩蛋 | Micro-Ecosystem | zh.ts:335 / en.ts:352 |

## 3. 标点与数字格式

- **中文引号用「」**：所有插入名称处 `「名字」`（zh.ts:43、50、51、99、103…）。**书名号《》只用于建筑名**：`《名字》落成！`（116）、相纸题名（240）。英文用双引号 ` "名字" `（en.ts:65、119、132）。
- **数字与单位之间加半角空格**：`N 分钟`（20）、`p / t 块`（109）、`已归档 · c`（45）、`连续 d 天`（149）。英文单位紧贴：`hh` / `mm`（en.ts:197–198）、`m min`（35）。
- **中文冒号用全角「：」**（现状违规见 §5-⑥）。
- 日期：zh `m 月 d 日 周w`（19）；en `Sep 10, Wed`（月份缩写表 en.ts:3–16）。
- 数值：小时 `(min/60).toFixed(1)` + 「小时」/「h」；百分比 `pct%`；复数在 en 里**手写三元** `habit(count > 1 ? 's' : '')`（en.ts:392，(count > 1 ? 's' : '') 即 count>1 时加 s）。
- Emoji 是"语气标点"不是图标：只允许出现在 toast / 提醒标题 / 落成反馈这类**一次性情绪句**末尾（🎉 🧱 ✨ ⏳ 🏛️ 📋）。

## 4. i18n 结构（改文案前必读）

1. **schema 唯一**：`types.ts` 的 `TranslationSchema` 是唯一定义；zh/en 均以 `: TranslationSchema` 声明（zh.ts:3、en.ts:18）→ **少一个 key 即编译报错**，这就是双语对齐机制，不要绕过。
2. **key 分组 = 界面区域**：`common / a11y / nav / titlebar / today / blockDrop / build / showcase / stats / habitDialog / gallery / polaroid / settings / mini / reminder / microMood / reflections / poster / tray / blueprints`。新增文案先找归属组，不建 `misc`。
3. **带参文案一律函数式**：`(name) => 模板字符串`，不做手工拼接（zh.ts:49–51）；嵌套对象允许（`today.fullCard.*`、`settings.webdav.*`）。
4. **蓝图名**走 `blueprints: Record<string,string>` + `getBlueprintName(id, lang)`（i18n/index.ts:19–22），**不要用** `Blueprint.name` 字段（见 §5-③）。
5. 读取：`useI18n()` 返回 `{ lang, t }`（i18n/index.ts:12–16）；语言变更由 `document.documentElement.lang` 驱动（App.tsx:302–304），en 下全局收紧字距（theme.css:137–149）。

## 5. 违规点清单（grep 实测，2026-11-10）

| # | 类型 | 位置 | 数量 | 处置 |
|---|---|---|---|---|
| ① | `lang === 'zh'` 内联三元 | `Today.tsx:196`（首屏日期，**违规**：已有 `t.common.dateHeader` 却不用）；`MonthlyPosterModal.tsx:209`（画布例外，已有注释）；`SettingsDialog.tsx:165 / 168`（语言选择按钮，**合规**） | **4** 处（历史 90 → 现 4，目标 <15 已达成） | 仅 Today.tsx:196 需收口 |
| ② | 硬编码中文兜底 | `BottomTabBar.tsx:26 / 50 / 76 / 81`（`t.nav?.today ?? '今日'` 等 4 处） | **4** 处 | 删掉 `?.` 与兜底（t 永不为空） |
| ③ | 硬编码中文数据 | `logic/blueprints/generators.ts:111/140/161/174/209/224/248/270/299/332/364/401` 的 `b.build(id, '中文名', cx, cy)` | **12** 处 | 该 `name` 字段**从未被任何代码读取**（grep `bp.name` = 0），且与 i18n 名称 **7/12 不一致**（'桌上仙人掌' vs '绿意盆栽'、'白岬灯塔' vs '蔚蓝灯塔'、'黑白工厂' vs '红砖工坊' …）→ 删除或注明"仅调试用" |
| ④ | 裸英文兜底 | `App.tsx:71` `?? 'Habit'`；`App.tsx:424` `?? 'BlockHabit'` | **2** 处 | 'Habit' 改走 t；'BlockHabit' 是品牌名可留 |
| ⑤ | 画布内硬编码英文 | `PolaroidModal.tsx:211` 'BlockHabit'、`234` 'BLOCKHABIT ARCHITECTURAL LOG'、`336` 'BLOCKHABIT CHRONICLE'；`MonthlyPosterModal.tsx:107` `MONTH_EN`（中文界面也印 JAN） | **4** 处 | 品牌水印可留；其余两条应进 i18n 或按语言分支 |
| ⑥ | 中文文案里的半角冒号 | `zh.ts:145` `修复积木: c / 2`、`276` `上次同步: `、`403` `待办: c 项` | **3** 处 | 统一改为全角「：」（正面例子见 zh.ts:114、124） |
| ⑦ | Emoji 越界风险 | zh / en 各 **11** 行含 emoji | 22 行 | 保留一次性情绪句；**不得**在标题、按钮、设置项里新增 emoji |
| ⑧ | 占位符 `'—'` | `BuildScene.tsx:519 / 762`、`Stats.tsx` 等 | 多处 | 合规（缺失值占位），统一全角破折号 |

**一句话验收**：`grep -rn "lang === 'zh'" src/` 只剩 3 处（1 画布例外 + 2 语言按钮）；非 i18n 文件里的中文只剩「注释 + 上表 ③ 的历史数据」。