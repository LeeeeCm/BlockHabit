# BlockHabit 创新调研 B：年度回顾 · 内容扩展与定价 · 专注陪伴 · 编年史

> **文件性质**：外部调研报告（只分析，不改代码、不改设计记录）。
> **对应任务**：task-8「创新调研 B：年度回顾 / 内容包 / 专注陪伴 / 编年史」。
> **对应创新项**：A2 落成年鉴（年度回顾）、B1 内容二期（扩展蓝图包/DLC）、B2 桌面专注陪伴、B3 建筑即编年史（来源：`docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md` §3）。
> **研究日期 / 链接访问日期**：2026-11-10（下文所有 URL 未特别注明时，均为此日访问）。
> **写作口径**：中文；沿用 `design/VOICE.md` 术语（积木 / 蓝图 / 落成 / 连击 / 全勤 / 修复积木 / 展台 / 透视考古 / 手账长廊 / 拍立得 / 年鉴）；区分**官方宣称**、**可验证事实**、**本文判断**；抓不到的页面不推断，列入「未验证」。
> **与已有文档的分工**：已有 `2026-11-10-blockhabit-competitive-and-innovation.md`（15 竞品 + 10 条建议 + 定位矩阵）与 `2026-11-10-blockhabit-engagement-and-performance.md`（第四轮打开回路）。本文**不复述**那两份内容，只做四个专题的外部深挖，并把结论收敛到 A2/B1/B2/B3 的可执行启示。

---

## 0. 一页结论

### 0.1 四句话判断

1. **A2 落成年鉴该做，但要做成「本地生成的年度物证」，不是「社交分享活动」。** 年度回顾类功能的有效性，来自「把一年的行为压成一个可带走的身份化物件 + 固定的年度仪式」；它的传播力来自社交，而这恰好是 BlockHabit 明确不做的事。可借的是结构与工艺，不可借的是传播机制。
2. **B1 内容二期的关键不是「更多蓝图」，而是「内容包作为数据、可离线分发、旧客户端不坏数据」。** 独立游戏与内容型产品已经用真金白银证明：免费更新换口碑、低价 DLC 换续命、海量 DLC 换通胀反噬。BlockHabit 只有 12 座蓝图 1385 块，**内容是稀缺资产**，必须像发行游戏资料片一样管理版本与兼容。
3. **B2 桌面专注陪伴的正确定位是「奖励型陪伴」，不是「控制型专注」。** 可见倒计时、任务具象、结算奖励、低摩擦启动是有效机制；阻断、前台监控、屏幕读取、专注评分是另一条价值观路线，与 AESTHETIC §5 和本地优先直接冲突。
4. **B3 建筑即编年史是四项里最独特、也最容易伤人的一项。** 把记录变成回忆的产品（Day One、Apple Journal、Timehop）证明「回看」有价值；但回响（resurfacing）一旦不可控，就会变成情感风险（悲痛、羞耻、断签焦虑）与隐私风险。

### 0.2 五条关键发现（可直接转述给 Lead）

- **F1｜年度回顾的规模效应可验证，但留存数据不可验证。** Spotify 官方口径：Wrapped 2025 在约 24 小时内触达 2 亿「engaged users」，同比 +19%，2024 年达到同样规模用了约 62 小时（`Music Business Worldwide`, 2025-12-08；官方定义 engaged = 至少看过一张故事卡）。这是**官方宣称 + 媒体报道**，不是留存率；没有任何公开的「年度回顾提升留存 X%」数据可引用。来源：https://www.musicbusinessworldwide.com/spotify-wrapped-campaign-hit-200m-engaged-users-in-24-hours-a-19-yoy-increase/
- **F2｜本地优先是年度回顾的隐私最优解，已有官方先例。** Wikipedia 的 Year in Review 明确「阅读/保存数据只存在本机，回顾在设备上计算，不向服务器发送 pageview」，阅读历史可随时清除；2024 年 iOS 首版后官方观察到分享与捐赠意愿，2025 年扩到双端。来源：https://www.mediawiki.org/wiki/Wikimedia_Apps/Team/Wikipedia_Year_in_Review
- **F3｜内容定价存在两条已被验证的极端。** 免费更新路线：No Man's Sky 商店页明示「包含发售后全部大型更新」；低价 DLC 路线：Vampire Survivors 本体 $4.99、首个 DLC $0.99；通胀反例：The Sims 4 在 Steam 上有 115 条 DLC 条目，媒体统计「100+ DLC 可花掉约 $1,600」，2026 年又加入付费 mod 市场与虚拟币，遭玩家批评。来源见 §3。
- **F4｜专注陪伴的有效机制与「监控」可以完全解耦。** Pomofocus 只做可见倒计时与任务清单、免登录、桌面版明确提示「未签名，Windows 会警告」；Spirit City 用「收集精灵 + 布置房间 + lofi + 专注计时」卖 $11.99，Steam 英文评测 97% 好评（9,230 条）；Focus Bear 则把阻断、超聚焦检测、会议检测、手机 Zen 模式做成 $9.99/月订阅。前者是陪伴/奖励，后者是控制/监控。
- **F5｜旧客户端遇到未知内容，行业惯例是「拒绝降级 + 备份 + 明确警告」。** Minecraft 对「在更新版本保存过的世界」直接提示「不支持降级」，并警告损坏/丢失/崩溃；Anki 要求先在旧版执行「Downgrade & Quit」，否则旧版打不开集合。内容包必须自带版本契约，而不是指望旧客户端「猜」。来源见 §3.5。

### 0.3 四张「做什么 / 不做什么」速览

| 项 | 值得借 | 明确不借 |
|---|---|---|
| A2 落成年鉴 | 个人化总结、时间形状、对比去年、可导出物件、固定年度入口、阈值保证质量、本地计算 | 社交分享、公开榜单、算法评判、用「浪费了多少时间」制造羞耻 |
| B1 内容二期 | 免费更新换口碑、少量低价扩展、内容包数据化、版本/兼容契约、官网分发 + 校验和 | 海量 DLC、订阅制内容、游戏内货币、商店依赖、无版本内容包 |
| B2 桌面专注陪伴 | 可见倒计时、结算落块、低摩擦启动、摆件在场、不惩罚中断 | 阻断/监控/屏幕读取/应用统计、专注评分、真人视频陪伴、宠物养成 |
| B3 建筑即编年史 | 建筑作为容器、点击积木回到那天、可控回响、本地导出、空态诚实 | AI 编故事、强制推送回忆、把回忆做成社交动态、把稀疏数据填满 |

---

## 1. 研究方法、来源分级与判定口径

### 1.1 方法

1. 先读仓库事实：`README.md`、`design/AESTHETIC.md`、`design/VOICE.md`、已有竞品文档、相关设计记录（D-038 / D-048 / D-049 / D-050 / D-058），以及 `src/pages/Stats.tsx`、`src/components/{MonthlyPosterModal,PolaroidModal,Heatmap}.tsx`、`src/logic/{streak,showcase,blueprint}.ts`、`src/store/timerStore.ts`、`src/types.ts`。
2. 再查外部资料：优先官方页面 / 官方新闻稿 / 官方帮助中心 / 官方仓库；媒体与学术只作佐证；价格/评分/条目数用可复核接口（Steam AppDetails、iTunes Lookup 等）或官方定价页。
3. 最后把每条结论映射到 A2/B1/B2/B3，并标注成本、风险、与公理的关系。

### 1.2 来源标注约定

| 标记 | 含义 | 采信规则 |
|---|---|---|
| 〔官〕 | 产品/平台官方自有页面、新闻稿、帮助中心、官方仓库 | 作为「官方宣称」；涉及数字时注明是宣称 |
| 〔媒〕 | 可信媒体报道 | 作为「可验证事实」的二手证据；与官方冲突时以官方为准 |
| 〔学〕 | 学术索引/论文题录 | 只用于「存在该研究主题」，不引用未核验的结论数值 |
| 〔社〕 | 社区目录、开源仓库、论坛 | 只作模式参考，不当作质量背书 |
| 〔仓〕 | 本仓库代码/文档/记录 | 作为 BlockHabit 现状事实 |
| 〔判〕 | 本文判断 | 明确标注，不与事实混写 |

### 1.3 抓取失败与未验证清单（先声明，避免被当成结论）

- Strava 帮助中心「Year in Sport」条目：搜索索引可见德/法/泰语标题，但 2026-11-10 实际访问均 404（页面已下线或迁移）。**不引用其内容**，只把 Strava 的 2025 年度报告（官方新闻稿）作为事实来源。
- ScienceDirect 两篇 Study-with-Me 论文：Elsevier 人机验证拦截，摘要未取得。**只引用题录**（标题/期刊/年份），不引用「提升动机/降低压力」等结论。
- ACM 关于 body doubling 的论文：CAPTCHA 拦截。**只引用搜索索引可见的题录片段**，不引用实验结论。
- The Verge 2015 年 Facebook「On This Day」报道：正文抓取失败，只保留标题作为「媒体曾报道该功能引发痛苦回忆」的弱证据。
- TechRadar / GamesRadar：reader 代理域名被封，正文未抓取；不引用其细节。
- Apple Fitness 没有官方「年度回顾」产品页；Apple 侧只采信「活动奖章 + 趋势」的官方支持页与媒体对 2025 年 9 个限时挑战的整理。

### 1.4 术语与仓库现状锚点

- 年度回顾在本报告里指：把过去一年的记录压缩成「可回看、可带走、可再读」的单一物件（图片/长图/HTML/PDF/铭牌），不等于「统计页」。
- BlockHabit 现状（〔仓〕）：12 座蓝图共 1385 块（`README.md`「已知限制」）；内容用完后不静默、明确告知（D-20261110-038）；无代码签名、无自动更新（D-20261110-048、`README.md`）；移动端冻结为实验（D-20261110-050）。
- 已有可复用能力（〔仓〕）：`CheckIn` 已含 `note / mood / actualMinutes / starred / placedBlockId / blueprintId / date / deletedAt`；`PlacedBlock` 含 `index / placedAt / bonus`；`AppState.schemaVersion = 2`；`PolaroidModal` 已有「正面照片 + 背面随笔时间线」；`MonthlyPosterModal` 已有 2K 画布、三种比例、主题取色；`Stats.tsx` 已有「积木历史回响」与手账 Markdown 导出；`timerStore` 只有内存态倒计时会话（不持久化）。

---

## 2. 专题一：年度回顾（Year in Review）——为什么有效、什么时候翻车

### 2.1 样本与机制总表

| 产品 | 形态 | 叙事结构 | 阈值/资格 | 分享与隐私边界 | 可核验性 |
|---|---|---|---|---|---|
| Spotify Wrapped | 逐屏故事卡 + 年度营销活动（2016 起） | 身份化 Top 5、听歌时长、曲风、年度单曲；2025 加入 Listening Age / Clubs / Top Albums / 实时多人对比 | 有播放记录即可；只统计 1 月 1 日至 11 月中 | 最后一屏邀请分享；默认公开传播；数据由平台掌握 | 〔官〕〔媒〕 |
| Strava Year in Sport | 年度趋势报告 + 站内年度体验 | 全球趋势（Gen Z、装备、城市榜单）+ 个人年度数据 | 有活动记录 | 活动默认在关注者可见；Heatmap 曾引发安全事件 | 〔官〕〔媒〕 |
| Apple Fitness 奖章 | 月度挑战 + 限时活动奖章（无年度个人回顾） | 单点成就、连续环、趋势对比（至少 6 个月数据） | 完成指定活动 | 奖章可分享；健康数据在设备/账户内 | 〔官〕〔媒〕 |
| GitHub（Skyline / Unwrapped / Octoverse） | 官方 3D 年度 Skyline + 第三方年度视频 + 平台年度报告 | 贡献热力转 3D 模型/视频；平台级统计 | Skyline 曾对公众开放，现「暂时熄灯」；第三方需 OAuth | 第三方可申请读取私有仓库权限 | 〔官〕〔社〕 |
| Reddit Recap | 站内个性化卡片 | 活跃社区、发帖/浏览、时间花费、「滚动了多少根香蕉」 | 有账号活动 | 站内通知，可分享卡片 | 〔官〕 |
| Letterboxd Year in Review | 个人总结（邮件/站内）+ 社区年度榜单 | 观影统计、最高评分、最常看演员/类型；Pro/Patron 全年可看统计 | **2025 年至少记录 10 部电影**才有个人总结 | 评分/点赞进入社区榜单；Close Friends 与 Draft 不计入统计 | 〔官〕 |
| Wikipedia Year in Review | 站内个性化回顾（2024 iOS 首发，2025 双端） | 阅读/编辑/捐赠数据；计划加入「阅读时长、最长连续、同比去年、前 X% 读者」等 | 有本机阅读历史 | **全部本机计算，不上传 pageview；阅读历史可清除** | 〔官〕 |

### 2.2 留存与分享：哪些数字可以引用，哪些不能

**可以引用（公开、可追溯）**

1. **Spotify 规模**：官方称 Wrapped 2025 约 24 小时触达 2 亿 engaged users，同比 +19%；2024 年达到 2 亿用了约 62 小时（〔媒〕MBW 2025-12-08，转述 Spotify 12 月 4 日发布）。这是参与规模，不是留存率。
2. **Spotify 社交声量**：2019 年 12 月 Wrapped 发布后，Twitter 上相关帖子超过 120 万条（〔官/媒〕Wikipedia 引述）。2018 年客服账号收到大量「数据不对/不公平」投诉（同上）。
3. **Strava 规模**：官方新闻稿称 Strava 有 1.8 亿+ 用户、覆盖 185+ 国家；2025 年度报告分析数十亿条活动 + 3 万+ 人问卷（〔官〕Strava Press，2025-12-02/03）。这是用户规模与研究方法，不是回顾功能的留存效果。
4. **Letterboxd 的资格阈值**：2025 年个人总结需要「2025 年至少记录 10 部电影」，于 2026-01-02（美国时间）通过邮件/站内发出，社区总结 2026-01-12 发布；Pro/Patron 全年可看统计（〔官〕Letterboxd FAQ，2025）。阈值本身是可验证的产品规则，可反推「避免给低活跃用户生成空洞回顾」。
5. **Wikipedia 的官方口径**：官方称 2024 年 iOS 首版让「分享阅读历史、编辑历史、捐赠历史的用户获得参与感，并激发了捐赠」；2025 年扩到 Android + iOS（〔官〕MediaWiki）。这是官方宣称，不是实验数据。

**不能引用（没有公开、可复核来源）**

- 「年度回顾提升留存 X%」「分享带来 Y% 新增」之类数字：本次检索没有找到任何平台公开的、可复核的留存/拉新数据。若后续文档需要这类数字，应标注「无公开数据」或做自家 A/B 实验。
- 「Spotify Wrapped 让 App Store 排名上升多少位」：只有「历史上与排名提升相关」的媒体表述（〔媒〕Indian Express 2025-12-04），没有官方数字。
- Strava / Apple / Reddit 的个人回顾参与率：均未公开。

**判断（〔判〕）**：年度回顾类的真正杠杆在「**年度仪式 + 可带走的身份化总结**」，不在「社交裂变」。对 BlockHabit 而言，能借的是「让人在年末愿意打开、愿意保存、愿意明年再打开」；不能借的是「让人发给朋友」。前者的证据链（官方规模、产品规则、本地隐私实践）足够支撑 A2；后者与 AESTHETIC §5 第一条冲突。

### 2.3 叙事结构解剖：七个可复用的部件

1. **身份化总结（Identity）**：把行为翻译成「你是谁」——Top 5 歌手、最常看的演员、阅读最多的话题。BlockHabit 对应物：**这一年你为哪座蓝图放下了多少块、最常打卡的时段、最长连击、最常写随笔的习惯**。
2. **时间形状（Shape of time）**：热图、月度分布、连续段、最长/最短月份。BlockHabit 已有 13 周灰阶热图（`Heatmap.tsx`）与连击逻辑（`streak.ts`），年度版只需扩到 12 个月与年度对比。
3. **单点时刻（Peak moment）**：某一天/某一周的最大值，配一句当时的内容。Wikipedia 计划中的「你读得最多的那一天，展示那天读了什么」正是这个结构（〔官〕Phabricator T410691）。
4. **对比去年（Year over year）**：同比增减是「成长感」的来源，也是最容易制造焦虑的地方。Spotify 用「比去年多听 X%」；BlockHabit 应优先用**绝对事实**（今年 312 块、去年 208 块），少用百分比排名。
5. **社区对照（Community）**：Letterboxd 的社区榜单、Strava 的全球趋势、Reddit 的社区数据。BlockHabit 不做社交，但可以做**「你自己的往年」对照**，或**「12 座蓝图的世界」**这种产品级叙事（不是用户间比较）。
6. **互动彩蛋（Play）**：Spotify 2025 的多人对比、Wikipedia 计划的「猜你的年度文章」「生成 2026 阅读清单」。BlockHabit 可做**「猜这座建筑用了多少天」**这类一次性小交互，但必须克制、不循环。
7. **可带走物（Artifact）**：图片/PDF/邮件/3D 模型。GitHub Skyline 甚至能生成 STL 去 3D 打印（〔官〕skyline.github.com 现「暂时熄灯」，但提供 `gh-skyline` CLI）；Letterboxd 用邮件送达；Day One 提供打印手账折扣（见 §5）。BlockHabit 的对应物是**年鉴卡/长图/PDF**，与现有 `PolaroidModal` / `MonthlyPosterModal` 同一工艺。

### 2.4 失败与反感案例（本专题最重要的部分）

| 案例 | 发生了什么 | 可验证来源 | 对 BlockHabit 的教训 |
|---|---|---|---|
| Spotify Wrapped 2024 | 被媒体与用户评为「boring, plain mess」；Spotify 自己在 2025 年发布会承认收到反弹；2025 年靠 Listening Age / Clubs / Top Albums 等更新挽回口碑 | 〔媒〕Mashable 2025-12-03 | 年度回顾会「用旧」；不能每年只换配色。BlockHabit 内容有限，更要靠**年度事实变化**（建筑、连击、随笔）而非模板翻新 |
| Listening Age（2025） | 新功能把听歌品味折算成「年龄」，社媒大量调侃与不适（「我的 Wrapped 年龄 62，我实际 44」） | 〔媒〕Mashable 2025-12-03 | 任何「算法给你贴标签」的设计都可能冒犯；BlockHabit 不做人格化评判，只陈述事实 |
| 数据错误投诉（2018） | 用户认为 Wrapped 结果「不对/不公平」，客服被大量投诉 | 〔官/媒〕Wikipedia（引 2018 报道） | 年度回顾必须可解释、可核对；每个数字要能点开看明细（Wikipedia 2026 计划也加了「info 图标链接到统计说明」） |
| 隐私与算法批评 | 媒体长期批评 Wrapped 是「免费广告」、数据隐私、算法塑造品味、平台对艺术家不公 | 〔媒〕Indian Express 2025-12-04；〔媒〕The Guardian 2019 引文（经 Wikipedia 转引） | 年度回顾一旦带「平台叙事」，就会被质疑动机。BlockHabit 的叙事必须是「你的数据、你的建筑」，不是「我们平台的成就」 |
| Strava Heatmap（2018 / 2026） | 2018 年全球热图暴露美军及盟友人员敏感位置；2026 年 3 月法国航母「戴高乐号」上的一次跑步上传后暴露位置；研究者指出「单条路线是好奇，重复路线是签名，足够签名就是地图」 | 〔媒〕RTÉ Brainstorm 2026-04-14 | 「聚合 + 展示」本身就是隐私事件；BlockHabit 若做年度地图/位置类回顾，默认必须本地、默认不公开；更稳妥是**不做地理位置** |
| Timehop | 2016 年 4.0 改版把时间线改成分页、删功能，iOS 收到 7,000+ 一星；2018 年 7 月 4 日约 2,100 万用户数据泄露（姓名/邮箱/电话/部分社交 token） | 〔官/媒〕Wikipedia（引 2016/2018 报道） | 「回忆类产品」同时是「高价值数据产品」；改版会伤老用户，泄露会伤品牌。BlockHabit 的优势是本地文件，别把回忆搬到云上 |
| Letterboxd 门槛 | 个人总结要求当年至少记录 10 部电影；新用户/低频用户被排除 | 〔官〕Letterboxd FAQ 2025 | 阈值保证质量，但要在产品里说清楚「为什么今年没有」；BlockHabit 应给**「还在积累」的诚实空态**，不伪造数据（AESTHETIC §5「不做假数据」） |
| Apple 限时奖章 | 2025 年共 9 个限时挑战，「一旦错过就没了」；月度挑战 + 特定节日挑战 | 〔媒〕Wareable 2025-12-19；〔官〕Apple Support | FOMO 是有效钩子，但 BlockHabit 的「仪式只演一次」是**当天的仪式**，不是「错过就永久失去」；年度回顾应可补看 |

### 2.5 对「本地优先、无社交」产品的可借鉴 / 不可借鉴

**可借鉴（判断，附依据）**

1. **本地计算 + 可清除的原始数据**：Wikipedia 模式是 BlockHabit 的天然形态——数据本来就在本机 JSON，年鉴不需要任何网络请求（〔官〕MediaWiki；〔仓〕`src/storage/`）。
2. **个人化 + 可带走**：Letterboxd 用邮件、GitHub 用 3D 模型、Day One 用打印手账；BlockHabit 用现有画布导出即可（〔官〕Letterboxd/GitHub/Day One；〔仓〕`PolaroidModal`、`MonthlyPosterModal`）。
3. **阈值与诚实空态**：低于最小块数/打卡数就不生成「伪年鉴」，只显示「还在积累」与已完成的部分（借鉴 Letterboxd，但反过来用：**不排除用户，只是不编造**）。
4. **固定年度入口 + 常驻入口并存**：年度回顾不能只在 12 月出现（错过就没了）；展台里每座建筑的「年鉴卡」应常驻可看（〔判〕）。
5. **可解释的数字**：每个统计项配一句口径说明（「块数=有效打卡次数」「连击按本地时区」），并允许点开明细（借鉴 Wikipedia 2026 计划；〔判〕）。

**不可借鉴**

1. **社交分享 / 公开榜单 / 好友对比**：与 AESTHETIC §5 第一条冲突；也把「为自己坚持」变成「为别人表演」。
2. **平台级叙事**：Wrapped 的「全球听歌趋势」对 BlockHabit 无处落地；不要造「全球建筑榜单」。
3. **算法评判**：不做「你的自律分数」「你击败了 87% 用户」；AESTHETIC §5 明确不做等级/排名。
4. **时间浪费羞辱**：Reddit Recap 的「你滚动了多少根香蕉」是娱乐，但用在习惯产品会变成羞耻；BlockHabit 的语调是「每一次打卡都算数」，不是「你浪费了多少天」。
5. **第三方 OAuth / 上传数据换取个性化**：GitHub Unwrapped 需要 OAuth（甚至可选私有仓库权限）；BlockHabit 不引入账号与授权（A7）。

### 2.6 A2 的「产品工艺」参考：Wikimedia 的年度回顾执行清单

Wikimedia 的 Phabricator 记录了 2025 → 2026 的复盘（〔官〕T410691），其中可直接搬到 BlockHabit 的工程/运营要点：

- 每年重置「已看过年度回顾」的标记，否则明年不弹（对应 BlockHabit 本地 `guideTips` 的同类问题）；
- 做一个「5 天漏斗检查」，提前发现展示 bug（对应 BlockHabit：年鉴生成后自检块数/日期/空数据）；
- 每个统计数字配「info 图标 → 口径说明」；
- 在设备上统计（on-device statistics），并承认「有的数据本机没存到」——例如 Android 上捐赠追踪不完美，于是允许用户自报捐赠者身份领取奖励（案例说明：**本地数据不完整时，诚实 + 用户自报，好过偷偷补数据**）；
- 社交传播由传播团队单独做；产品内不强制分享。
- 计划中的幻灯片清单（可作为 A2 内容池）：阅读时长/话题、活跃周数、最长连续、读得最多的一天、同比去年、前 X% 读者、猜年度文章、生成下一年清单（〔官〕同上）。

> 对 BlockHabit 的映射：年鉴内容池可先做 8–10 个「事实卡」，每卡都可由 `AppState` 直接算出，不引入新数据模型。

---

## 3. 专题二：内容扩展与定价——内容包、DLC、订阅，与「旧客户端兼容」

### 3.1 样本与定价结构（本次核查的可验证数据）

| 样本 | 内容/商业模式 | 可验证价格/数据 | 来源与判定 |
|---|---|---|---|
| The Sims 4 | 免费本体 + 海量付费扩展 + 付费 mod 市场（Moola 虚拟币） | Steam 上 **115 条 DLC 条目**；媒体称 100+ DLC 可花约 **$1,600**；2026 年 Marketplace 付费 mod 遭批评 | 〔官/媒〕Steam AppDetails（appid 1222670）；GameSpot via Yahoo 2026-03-20 |
| No Man's Sky | 买断 + **所有大型更新免费** | Steam 商店页明示「包含发售后全部大型更新：Foundation … COSMOS (7.0) and Forsaken」 | 〔官〕Steam 商店页（appid 275850） |
| Vampire Survivors | 低价买断 + **大量低价 DLC** | 本体 **$4.99**；Steam 上 **9 条 DLC**；首个 DLC **$0.99** | 〔官〕Steam AppDetails（1794680；首个 DLC appid 见接口） |
| Spirit City: Lofi Sessions | 买断 + 小额 DLC（支持者包/装饰） | 本体 **$11.99**；**6 条 DLC**；英文评测 97% 好评（9,230 条） | 〔官〕Steam AppDetails / 商店页（2113850） |
| Stardew Valley | 买断 + 长期免费更新 + 原声 DLC | 本体 **$14.99**；**1 条 DLC** | 〔官〕Steam AppDetails（413150） |
| Cult of the Lamb | 买断 + 免费更新 + 付费扩展 | 本体 **$24.99**；**7 条 DLC** | 〔官〕Steam AppDetails（1313140） |
| Forest | 免费下载 + **Forest Plus 订阅**；核心功能免费；订阅者获得更多树种/金币/扩展功能 | 2025 年转为该模式；核心免费；机制是「树会枯死」的损失厌恶 | 〔官/媒〕Wikipedia「Forest (application)」（引用官方与媒体） |
| Day One | 免费 Basic + **$49.99/年 Silver** + **$74.99/年 Gold**；Basic 已含端到端加密与 On This Day | 官方定价页；1 个月免费试用；打印手账折扣 | 〔官〕dayoneapp.com/plans |
| Focus Bear | **$9.99/月订阅** + 7 天试用，之后可留在免费 Essentials | 官方定价页；学生/困难折扣 | 〔官〕focusbear.io/pricing |
| Focusmate | 免费每周 3 次 + **Plus $8/月（年付）或 $12/月（月付）** | 官方定价页；官方称多数同类服务 $20–40/月 | 〔官〕focusmate.com/pricing |
| Obsidian | 免费本体 + **社区插件/主题**（10,200 插件 / 1,002 主题） | 官方社区目录；插件为第三方代码，官方明确警告风险 | 〔官/社〕obsidian.md/plugins；help.obsidian.md/community-plugins |
| Pomofocus | 免费在线计时器 + 桌面版直接下载 | 官方页明确提示「Windows 版未签名，可能出现不安全警告，需点 Details → Run anyway」 | 〔官〕pomofocus.io |

**结构读法（〔判〕）**

1. **免费更新是最强的口碑资产**：No Man's Sky 把「所有更新免费」写进商店页，这是买断制产品对抗订阅疲劳的叙事武器；代价是团队必须持续产出。
2. **低价 DLC 是「续命」而不是「发财」**：Vampire Survivors 用 $0.99–$2.99 的 DLC 维持热度；它的前提是本体极便宜、内容量极大、玩家口碑极好。
3. **海量 DLC 是内容通胀的教科书反例**：Sims 4 的 115 条 DLC 与 $1,600 总价，已经把「内容」变成「收费目录」；再叠加付费 mod 与虚拟币，直接触发反感。
4. **订阅制在习惯/专注类产品里普遍存在（Forest、Finch、Focus Bear、Day One），但它是「云服务 + 持续内容」的商业模式，不是「本地工具」的默认答案。** BlockHabit 若走订阅，必须先有云/服务，否则叙事不成立（且违反 A7）。
5. **社区内容可以零成本扩展生态，但有安全与质量风险**：Obsidian 10,200 个插件是生态奇迹，官方同时必须警告「第三方代码可能有害」。

### 3.2 五种内容供给模式的对比（面向 BlockHabit 的取舍）

| 模式 | 例子 | 收入结构 | 团队负担 | 用户感受 | 对 BlockHabit 的适配 |
|---|---|---|---|---|---|
| 免费更新（买断/捐赠） | No Man's Sky、Stardew Valley | 一次性/捐赠 | 高（要持续做） | 口碑最好，但会形成「应该免费」的预期 | 适配：小团队可持续的低频更新；但要有边界（否则无限军备竞赛） |
| 低价付费扩展包 | Vampire Survivors、Cult of the Lamb | 单价低、靠量 | 中 | 便宜、可接受；但内容必须真有料 | 谨慎：BlockHabit 的「内容=蓝图」，付费会改变「打卡奖励」的公平感 |
| 订阅 | Forest Plus、Finch、Focus Bear、Day One | 持续 | 高（服务+内容） | 对老用户不友好；易被「买断转订阅」反噬 | 不做（本轮）：违反 A7，且缺签名/更新/服务基建 |
| 季节/限时内容 | Apple 限时奖章、游戏节日活动 | 免费（促活） | 中 | 有仪式感，但制造 FOMO | 可改造：只做「年度回顾/落成纪念」这类**可补看**的仪式，不做错过即失去 |
| 社区内容/插件 | Obsidian、Anki、itch.io 直接下载 | 免费或作者自定价 | 低（平台只做分发） | 生态繁荣，但质量/安全参差 | 暂不做平台：BlockHabit 没有审核与签名能力；可先做「官方内容包 + 离线文件」 |

### 3.3 内容枯竭与通胀：BlockHabit 的真实处境

**已核实的仓库事实**（〔仓〕）：12 座蓝图共 1385 块；1 个习惯的日常用户约 2 块/天 → 约 690 天；3 个习惯约 4 块/天 → 约 347 天（已有竞品文档的审计估算，本文只引用不重复论证）；全建成后打卡仍记录但不掉块，产品会明确告知（D-20261110-038）。

**外部参照（〔判〕）**

1. **内容型产品的「枯竭」不是没内容，而是「新内容不再带来新体验」。** Sims 4 用 115 条 DLC 证明了「加量」会边际递减并反噬；Vampire Survivors 用低价 DLC 证明了「加质」可以维持口碑，但需要本体足够便宜、内容足够密。
2. **对 BlockHabit，蓝图不是 DLC 素材，是「时间的容器」。** 增加蓝图会改变「块数=天数」的直觉（AESTHETIC §2.3），所以**扩内容必须同时扩叙事**：不是「又一座建筑」，而是「这座建筑为什么值得一年」。
3. **通胀的三种表现**：奖励通胀（多打多送）、内容通胀（更多同质蓝图）、货币通胀（虚拟币/积分）。AESTHETIC §6 已明确只允许「宽容机制」，不允许「通胀机制」。因此 B1 的安全区是「少量、可解释、有主题」的扩展，而不是「月度上新」。
4. **枯竭的诚实处理本身就是品牌**：内容用完时明确告诉用户「已记录、但不再产生新积木」（已实现），比偷偷塞重复内容更体面；后续扩展应延续这种诚实（例如「第 13 座蓝图是纪念性扩建，不计入 1385 块」）。

### 3.4 无商店 / 无签名的小团队，如何分发离线内容包

**现实参照**

1. **Pomofocus 的桌面分发**：官网直接给 Windows zip，并明确写「未签名，Windows 会警告，点 Details → Run anyway」（〔官〕pomofocus.io）。这说明：无签名团队可以分发，但必须**把警告写在自己页面上**，而不是等用户以为中了病毒。
2. **Obsidian 的社区目录**：10,200 插件 / 1,002 主题，安装来自社区目录与 GitHub；官方同时警告第三方代码风险（〔官〕help.obsidian.md）。这说明：**内容（数据）与代码（插件）要分开**——数据包的风险远低于可执行插件。
3. **BlockHabit 现状**：无自动更新、安装包手动覆盖（〔仓〕README）；无签名（D-20261110-048）。因此内容分发的第一原则是：**内容包是数据，不是可执行文件**。

**建议的离线内容包形态（〔判〕，不需要新依赖）**

```
blueprint-pack/
  manifest.json        # packId / name / version / schemaVersion / minAppVersion / sha256 / files
  blueprints/*.json    # 蓝图定义（blocks 数组，沿用 BlockDef）
  i18n/zh.json,en.json # 名称与描述（对齐 VOICE 术语）
  preview/*.png        # 可选：展台缩略图
  README.txt           # 版本、来源、校验方法、卸载说明
```

- **只读导入**：应用读取 manifest → 校验 sha256 → 校验 `minAppVersion` → 转成内部 `Blueprint`；**绝不执行包内代码**。
- **可卸载/可回滚**：内容包记录 `packId`，卸载只删内容、不动用户数据；已在建的建筑保留原蓝图快照。
- **官网分发 + 校验和**：下载页给 `sha256`，README 给校验命令；不依赖商店。
- **不做签名就不做自动更新**：与 D-20261110-048 决议一致；内容包更新也走手动下载。

### 3.5 旧客户端遇到未知内容：游戏 DLC 兼容的四个教训

| 教训 | 证据 | 对内容包的要求 |
|---|---|---|
| **「新版本保存的数据，旧版本不能碰」是行业默认** | Minecraft：世界在更新版本保存后，旧版本加载会显示「World was saved in a newer version, loading this world could cause problems!」，且「Downgrading a world is not supported」；官方建议先备份，否则可能损坏/丢失/崩溃（〔官/社〕Minecraft Wiki） | 内容包必须带 `schemaVersion` + `minAppVersion`；旧客户端**拒绝写入**比「尽力解析」安全 |
| **降级需要显式动作与提示** | Anki：在旧版打开前，必须先在当前版本执行「Downgrade & Quit」，否则旧版本打开集合会报错（〔官〕Anki Docs） | BlockHabit 若未来升级 `schemaVersion`，应提供「导出为旧版兼容包」或「明确告知不可回退」 |
| **版本号是契约，不是装饰** | SemVer 2.0.0：MAJOR 不兼容、MINOR 向后兼容新增、PATCH 修复（〔官〕semver.org） | 内容包版本与 App 版本分开；`minAppVersion` 用 MINOR 级别约束 |
| **未知字段要保留，不能静默丢弃** | 游戏存档/集合的常见事故是「旧版本读入后重写，未知数据被抹掉」；Anki/Minecraft 都以拒绝/备份规避（同上） | 解析时保留未知字段（forward-compatible envelope）；同步/导出时原样带上；**未知蓝图只读占位**，不渲染、不删除 |

**BlockHabit 的具体建议（映射到现有类型）**

- `AppState.schemaVersion` 目前是 2（〔仓〕`src/types.ts`）。内容包新增 `contentPacks: { id, version, installedAt, blueprintIds }[]` 只是可选字段，旧客户端不认识也能保存（只要适配层保留未知字段）。
- 旧客户端遇到 `builds` 中未知 `blueprintId`：展台不渲染、建造页显示「此内容需要更新版本」、**绝不删除**；导出 JSON 原样保留。
- 内容包蓝图 ID 稳定且永不复用；卸载内容包不回收用户已建成的建筑（提供「保留为只读展品」）。
- 与 WebDAV 合并（〔仓〕`src/sync/merge.ts`）：未知内容按墓碑与 LWW 规则保留；冲突时以「不丢数据」优先。

---

## 4. 专题三：专注陪伴与「不监控」的边界

### 4.1 机制样本

| 产品 | 核心机制 | 是否监控/阻断 | 价格/分发 | 可验证来源 |
|---|---|---|---|---|
| Pomofocus | 可见倒计时、任务清单、番茄数、可视化报告；免登录、浏览器/桌面 | 否 | 免费；桌面版直接下载，**明确提示未签名** | 〔官〕pomofocus.io |
| Forest | 种树 + 离开应用树会枯死（损失厌恶）；完成的树进入森林时间线 | **半监控**：检测你是否离开应用，但不读取内容 | 免费 + Forest Plus 订阅；核心功能免费 | 〔官/媒〕Wikipedia |
| Focus Bear | 早晚例程引导、每 20 分钟休息、超聚焦检测、会议检测、手机 Zen 模式、网站/应用阻断、严格等级、问责伙伴 | **是**：阻断 + 检测 + 跨设备控制 | $9.99/月；7 天试用；学生折扣 | 〔官〕focusbear.io/features、/pricing |
| Focusmate | 与陌生人视频「body doubling」共学，预约时段 | 否（人际在场，非监控） | 免费 3 次/周；Plus $8/月（年付）/$12/月 | 〔官〕focusmate.com/pricing |
| Study with Me / Lofi Girl | 长时段直播「有人陪你学」；弹幕/聊天弱互动 | 否 | 免费（平台广告/赞助） | 〔官/媒〕Wikipedia「Lofi Girl」 |
| Spirit City: Lofi Sessions | 专注计时 + lofi + 收集精灵 + 布置房间 + 任务清单；桌面陪伴 | 否 | $11.99 + 6 条 DLC | 〔官〕Steam（2113850） |
| 桌宠类（如 Bongo Cat 等） | 角色对键鼠输入做反应，视觉陪伴 | 否（本地、装饰性） | 多为免费/低价 | 〔社〕Steam 商店标签（Desktop Companion） |

**Lofi Girl 的可验证事实**（〔官/媒〕Wikipedia）：2022 年 2 月频道达到 1000 万订阅；当时在播的直播自 2020-02-22 起持续运行、超 700 万点赞；2022-07-10 YouTube 因马来西亚唱片公司 FMC Music 的 DMCA 投诉下架两条直播（合计近 8 亿播放、各约 21,000 小时），两天后恢复直播；YouTube 其后确认投诉为「滥用」，投诉方频道被终止。**说明「陪伴型长直播」的力量与脆弱：价值来自持续在场，风险来自平台与版权。**

### 4.2 哪些机制有效（按证据强度分级）

| 机制 | 判断 | 证据强度 | BlockHabit 可用性 |
|---|---|---|---|
| 可见倒计时 / 明确剩余时间 | 降低「开始」的心理成本，提供进程感 | 强（Pomofocus/Focusmate/Forest 均以此为核心；Spirit City 亦内置计时） | 高：摆件/今日卡直接显示 |
| 任务具象 + 单次只做一件事 | 把「专注」变成可完成的小目标 | 中（产品普遍做法，缺少对照实验） | 高：现有习惯卡与 targetMinutes |
| 结算奖励（树/报告/落块） | 把「坚持」变成可见结果 | 中（Forest 的森林时间线、Pomofocus 的 visual reports、Spirit City 的收集） | 高：落块动画已是最好的结算 |
| 陪伴在场（人/角色/直播） | 降低孤独感、提供软性问责 | 中（Focusmate 官方与 body doubling 研究主题存在，但本次未取得实验结论） | 中：建筑/摆件可作为「在场物」，但不做拟人化 |
| 低摩擦启动（免登录、网页即用） | 减少启动阻力 | 强（Pomofocus 免登录；Focusmate 免费 3 次/周） | 高：BlockHabit 已有本地优先与模板 |
| 不惩罚中断 | 保护长期动机 | 中（Forest 的树死是反例；BlockHabit 的温和风化是差异化） | 高：已有 gentle decay + 修复积木 |
| 严格阻断/监控 | 短期有效，长期引发反感与隐私成本 | 中（Focus Bear 靠此收费；但需要系统权限） | **不做**：与 A7/AESTHETIC §5 冲突 |

**研究现状（〔学〕，只到题录层）**

- 《Virtual companionship or flesh and blood: The effects of study-with-me (SWM) videos on learners' intrinsic motivation, perceived pressure, and performance》——Computers & Education（ScienceDirect，2025；摘要被人机验证拦截，未核验结论）。
- 《Unpacking self-regulation and social interaction in "Study With Me" videos through large-scale analytics》——ScienceDirect（同上）。
- ACM 论文《Beyond Individual Accommodations: The Collaborative Practices of ADHD Students…》索引片段提到「real-time virtual body doubling facilitates remote co-presence through video-mediated body doubling sessions」（正文被 CAPTCHA 拦截）。
- **判定**：这些题录足以说明「陪伴/共学」是严肃研究主题，但**不足以支撑 BlockHabit 对外宣称「提升专注」**；B2 的产品文案不要引用心理学结论。

### 4.3 哪些机制滑向「监控 / 阻断」

1. **应用/网站阻断**（Focus Bear、Cold Turkey、Freedom 类）：需要系统权限或浏览器扩展，本质是替用户做决定；失败时用户会绕过，成功时用户会依赖。
2. **前台窗口/屏幕读取**：能判断「你是否在工作」，但也会读到密码、聊天、病历等敏感内容；这是 BlockHabit 明确不应触碰的权限面。
3. **应用使用统计/专注评分**：把行为折算成分数，会制造新的焦虑与「刷分」动机；与 AESTHETIC §5「不做等级/成就」冲突。
4. **跨设备控制/问责伙伴**：需要账号与云，天然违反 A7；且把「自我承诺」变成「他人监督」，与「只奖励不监控」相反。
5. **平台数据聚合**：Strava Heatmap 的教训说明，即使单条数据无害，聚合后也可能成为安全事件（〔媒〕RTÉ 2026-04-14）。BlockHabit 的数据是习惯与随笔，聚合风险虽低，但**默认不出本机**是唯一稳妥边界。

### 4.4 与 BlockHabit「只奖励不监控」的边界（B2 规格建议）

**允许（在现有架构内）**

- 用户主动开始一个 `kind === 'focus'` 习惯的倒计时（复用/扩展现有 `timerStore` 的内存会话；不持久化运行中会话，避免崩溃后「幽灵计时」）。
- 迷你摆件显示「正在为《蓝图》攒一块」+ 剩余时间；结束时落块动画**只播一次**（AESTHETIC §2.2「仪式只演一次」）。
- 到点通知/托盘提示，与现有提醒、晚间提醒去重；用户可关。
- 结束后的结算：专注分钟（`actualMinutes`）、块数、连击；数据来自用户主动打卡事实。

**禁止（红线）**

- 读取前台窗口标题、截屏、监听键鼠、统计其他应用使用时长；
- 网站/应用拦截、系统级「专注模式」控制；
- 生成「专注分」「效率评级」「本周击败多少人」；
- 把计时数据上传/同步到任何第三方（WebDAV 是用户自有，可另行讨论，但默认不新增字段）；
- 用「树会死」「连击清零」等惩罚制造焦虑（BlockHabit 已有温和风化，不要倒退）。

**与 AESTHETIC 的关系（〔判〕）**：B2 不新增颜色、不做新经济系统、不做拟人化角色；陪伴物就是**用户自己建的建筑**，这比宠物更符合「建筑是时间的形状」的隐喻。

---

## 5. 专题四：编年史 / 回忆产品——把记录变成可回看的叙事

### 5.1 样本与做法

| 产品 | 回忆机制 | 存储/隐私 | 可验证来源 |
|---|---|---|---|
| Day One | 日记 + **On This Day 回忆** + 连击 + 模板 + 打印手账；Basic 免费含端到端加密 | 云同步（Silver 起跨设备）；Basic 已含 E2EE；Strava 集成 | 〔官〕dayoneapp.com/plans |
| Apple Journal | 日记 + **设备端 Journaling Suggestions**（把 workout/媒体/照片/联系人等分组为建议） | 设备端处理；用户按类别开关；有限历史数据仅在本机使用 | 〔官〕Apple Legal「Journaling Suggestions & Privacy」 |
| Strava | 活动记录 + 年度报告 + 社交动态 | 账号云；活动默认对关注者可见；Heatmap 曾泄露敏感位置 | 〔官〕Strava Press；〔媒〕RTÉ 2026-04-14 |
| Timehop | 每日回忆、Then & Now、连接多平台 | 云；2018 年约 2,100 万用户数据泄露；2016 改版 7,000+ 一星 | 〔官/媒〕Wikipedia |
| Notion | 日记/日志模板市场（官方与社区作者） | 账号云；模板是内容包 | 〔官〕notion.com/templates/journal |
| Obsidian | 本地 Markdown 日记 + 社区插件（含 Day One 风格文件浏览器、Apple Notes/OneNote/Evernote/Notion 导入器） | **本地文件**；插件为第三方代码 | 〔官/社〕obsidian.md/plugins；help.obsidian.md |
| Wikipedia Year in Review | 阅读/编辑/捐赠的年度回顾 | **本机计算、不上传** | 〔官〕MediaWiki |

### 5.2 把记录变成「可回看叙事」的七个手法

1. **容器化**：以「建筑/项目/年份」为容器，而不是无尽时间流。Day One 用 journal/多日记本，Strava 用 activity，BlockHabit 的天然容器就是**建筑**（B3 的核心）。
2. **时间线 + 单点高亮**：PolaroidModal 背面已经在做「建造期间的随笔时间线」（〔仓〕），年鉴可沿用。
3. **回响（Resurfacing）**：On This Day / Timehop / Stats 的「积木历史回响」。有效，但必须**可控**（见 §5.3）。
4. **对比（Then & Now）**：Timehop 的 Then & Now、Spotify 的同比。BlockHabit 可做「去年今日的建筑 vs 现在」。
5. **精选（Curated）**：Day One 的 starred、Letterboxd 的高分；BlockHabit 已有 `CheckIn.starred` 与「只显示星标」筛选（〔仓〕`Stats.tsx`）。
6. **可带走物**：Day One 打印手账（Silver 25% off / Gold 35% off）、BlockHabit 的拍立得/画报。**「能打印」是回忆产品的信任凭证**。
7. **可检索**：Notion/Obsidian 的搜索；BlockHabit 已有手账长廊的搜索/筛选（〔仓〕），年鉴应能按习惯/心境过滤。

### 5.3 隐私与情感风险（必须写进设计）

- **本地优先是最好防线**：Apple Journal 的设备端处理、Wikipedia 的本机计算、Obsidian 的本地 Markdown，都说明「回忆不需要上传」。BlockHabit 的 JSON 本来就在本机，年鉴生成应保持零网络（〔仓〕`src/storage/tauriStorage.ts`）。
- **泄露的代价**：Timehop 2018 年约 2,100 万用户数据泄露（姓名/邮箱/电话/部分社交 token）（〔官/媒〕Wikipedia）。任何「云回忆」都必须先有加密、密钥管理与合规能力——BlockHabit 不应在缺这些能力时上云。
- **冒犯性回响**：Facebook 2015 年的「On This Day」被媒体报道「已经在勾起痛苦回忆」（〔媒〕The Verge 2015-04-02，正文未抓取，仅标题）；Timehop 也以「回忆」为核心。**回响必须可关闭、可跳过、可屏蔽某一天，且默认不推送。**
- **空态诚实**：没有随笔就显示「这天没有留下文字」，而不是自动生成「感悟」（AESTHETIC §5 不做假数据）。
- **AI 生成的边界**：Day One Gold 用 AI 做反思摘要（〔官〕plans）；BlockHabit 不做 AI 编故事——那会把「你的记录」变成「模型的话」，破坏数据诚实与本地优先。

### 5.4 对 B3（建筑即编年史）的具体形态建议

1. **入口**：建造页/展台点击任意积木 → 「这一天」卡片：日期、习惯、随笔、心境、专注分钟、是否全勤；数据由 `PlacedBlock.index ↔ builds` 与 `CheckIn.placedBlockId ↔ checkIns` 反查（〔仓〕`types.ts`）。
2. **容器**：落成时生成「落成编年史」：正面 3D 建筑（复用 `PolaroidModal` 正面）+ 背面时间线（已有）+ 落成日期/总块数/全勤天数/奠基铭言。
3. **年度回看**：展台常驻「年鉴」入口，按年份列出已落成建筑与年度事实；不依赖 12 月。
4. **回响控制**：默认不主动弹出；只在用户打开时展示；每条回响有「不再显示这一天」。
5. **性能**：190 块建筑的点击命中、年鉴长图渲染要有上限（复用 sprite 缓存与离屏画布，〔仓〕`render/`、`MonthlyPosterModal` 的做法）。
6. **导出**：PNG/PDF/JSON 三件套；文件名含年份与建筑名；不传云端。

---

## 6. 对 A2 / B1 / B2 / B3 的启示（每项 3–5 条）

> 每条格式：**做什么 → 为什么 → 成本 → 风险 → 公理/依据**。成本口径沿用竞品文档：S（1–2 天）、M（3–5 天）、L（一轮设计 + 实施）。

### 6.1 A2 落成年鉴（年度回顾）

**A2-1｜「个人年鉴」而不是「社交活动」：本地生成、可导出、零网络。**
- 做什么：从 `AppState` 直接计算年度事实（块数、落成建筑、全勤天数、最长连击、随笔数、专注分钟），用现有画布生成一张年鉴长图/多张卡；不新增账号、不上传。
- 为什么：Wikipedia 证明了「本机计算 + 可清除」的年度回顾可行（〔官〕MediaWiki）；Spotify/Letterboxd 的传播力来自社交，BlockHabit 只借结构与工艺。
- 成本：S–M。风险：导出通道在 Tauri/浏览器差异（已有拍立得/画报经验，需回归）。依据：AESTHETIC §5、A7。

**A2-2｜阈值 + 诚实空态：低于最小块数就显示「还在积累」。**
- 做什么：设定最小门槛（例如当年 ≥ 30 块或 ≥ 1 座落成建筑）；未达标时给「今年才刚开始」的引导，不生成假数据卡。
- 为什么：Letterboxd 用「≥10 部电影」保证总结质量（〔官〕FAQ）；AESTHETIC §5 明确不做假数据。
- 成本：S。风险：门槛过高会让新用户失望——文案要说明「明年就能看到完整年鉴」。

**A2-3｜固定年度入口 + 常驻年鉴卡双轨。**
- 做什么：每年 12 月/1 月在今日页给一次入口（不打断）；展台每座建筑常驻「年鉴卡」，错过也能补看。
- 为什么：Spotify/Letterboxd 都是「年度一次性事件」，但 BlockHabit 的资产是「建筑可长期回看」；Apple 限时奖章「错过就没了」（〔媒〕Wareable）不适合本地工具。
- 成本：S。风险：入口太多会稀释仪式感；默认只在年末出现一次。

**A2-4｜数字可解释、口径写清楚、i18n 全覆盖。**
- 做什么：每个指标配口径说明（块数=有效打卡；连击按本地时区；专注分钟只计 `actualMinutes`）；画布文案走 i18n，中英双版。
- 为什么：Wikipedia 2026 计划给每个统计加 info 图标（〔官〕Phabricator）；VOICE §5 已允许画布 i18n 例外但要求双版。
- 成本：S。风险：文案膨胀——用短句，不解释算法细节。

**A2-5｜年度执行清单：重置「已看」、漏斗自检、导出通道验证。**
- 做什么：在年鉴生成后自检「空数据/负值/跨年时区/块数与建筑不一致」；每年重置一次「已看过年鉴」标记；发布前跑一次导出真机验证。
- 为什么：Wikimedia 的 2025→2026 复盘明确把「5 天漏斗检查」「重置 seen 标记」「info 文档」列为必做（〔官〕T410691）。
- 成本：S。风险：自检脚本不要引入新依赖；用现有 vitest 写纯函数。

### 6.2 B1 内容二期（扩展蓝图包 / 离线内容包）

**B1-1｜内容包 = 数据不是代码：JSON + manifest + 校验和，官网离线分发。**
- 做什么：定义 `manifest.json`（packId/version/schemaVersion/minAppVersion/sha256/files），内容只含蓝图数据与 i18n；不执行任何包内代码；下载页给校验和。
- 为什么：Pomofocus 证明无签名团队可以分发，但要把警告写清楚（〔官〕）；Obsidian 证明「数据内容 vs 第三方代码」必须分开（〔官〕）。
- 成本：M。风险：manifest 解析的安全边界（拒绝路径穿越、拒绝超大文件）；需单测。

**B1-2｜版本契约：minAppVersion + 未知字段保留 + 旧客户端只读。**
- 做什么：旧客户端遇到未知内容包/未知蓝图时**不写、不删、只读占位**；导出/同步原样保留；内容包升级走「先备份、再导入」。
- 为什么：Minecraft「不支持降级」与 Anki「Downgrade & Quit」的行业惯例（〔官/社〕）；SemVer 的 MAJOR/MINOR 契约（〔官〕semver.org）。
- 成本：M。风险：同步合并复杂化；先只做本地，不碰 WebDAV 语义。

**B1-3｜内容节奏：少量、主题化、年度级，而不是月度 DLC。**
- 做什么：以「年度扩展」为单位（例如一组 3 座建筑 + 一条叙事线），优先免费/捐赠；若要收费，用一次性内容包（本地文件），不做订阅。
- 为什么：No Man's Sky 的「全部更新免费」换口碑（〔官〕Steam）；Sims 4 的 115 条 DLC/$1,600 是通胀反例（〔官/媒〕）；VS 的 $0.99 DLC 说明低价可行但需要极强本体口碑（〔官〕）。
- 成本：L（美术/内容为主）。风险：改变「块数=天数」直觉；需要设计记录与人工批准（AGENTS §1）。

**B1-4｜内容 ID 与内容包生命周期：永不复用、可卸载、不回收建筑。**
- 做什么：蓝图 ID 全局唯一；卸载内容包时，已建成建筑保留为只读展品；未建成的蓝图从「待建」列表移除但不破坏 `builds`。
- 为什么：游戏 DLC 的兼容事故多来自「内容被删但存档仍在」；BlockHabit 的 `builds` 是用户资产，不能因内容包变动受损（〔仓〕`types.ts`）。
- 成本：S–M。风险：展台展示只读建筑需要占位与提示；i18n 文案要说明原因。

**B1-5｜分发信任：官方页面写清「未签名警告 + 校验和 + 回滚方式」。**
- 做什么：内容包下载页与 README 写清楚 Windows SmartScreen 可能警告、如何校验 sha256、如何卸载/回滚；与 D-20261110-048「无签名不接 updater」保持一致。
- 为什么：Pomofocus 的官网直接把「未签名」写在下载区（〔官〕）；不写只会让用户以为中毒。
- 成本：S。风险：文案不要承诺「绝对安全」；只承诺「不执行代码 + 校验和」。

### 6.3 B2 桌面专注陪伴

**B2-1｜只做「用户主动开始」的可见倒计时 + 结算落块。**
- 做什么：`kind === 'focus'` 习惯点击开始 → 摆件/卡片显示倒计时 → 到点确认 → 落块一次；`timerStore` 扩展为可查询的会话（仍内存态）。
- 为什么：Pomofocus 的可见倒计时是低摩擦核心（〔官〕）；BlockHabit 已有的落块动画本身就是最好的结算奖励（〔仓〕`render/`）。
- 成本：M。风险：与提醒/晚间提醒重叠；性能（摆件长期计时）。

**B2-2｜陪伴物就是建筑，不做宠物/真人/拟人化。**
- 做什么：摆件展示正在建造的建筑，配一句「正在为《蓝图》攒一块」；不引入新角色、不引入音视频。
- 为什么：AESTHETIC §5 不做养成宠物/社交；Spirit City 证明「收集 + 房间 + 计时」可行但那是游戏化装饰，BlockHabit 的差异化是「真实积累物」（〔官〕Steam）。
- 成本：S。风险：摆件信息过载——只显示 1 个数字 + 1 句文案。

**B2-3｜不惩罚中断、不做专注分、不做应用监控。**
- 做什么：用户取消/中断只记录事实（可继续），不扣连击、不弹羞耻文案；不做后台应用统计/窗口读取/屏幕截图。
- 为什么：Forest 的树死是损失厌恶的极端（〔官/媒〕Wikipedia）；BlockHabit 的温和风化 + 修复积木是更长期的答案（〔仓〕`streak.ts`、D-20261110-027/049）。
- 成本：S（主要是纪律与文案）。风险：产品压力下容易「加一点监控」——写进设计记录的红线。

**B2-4｜通知与性能预算：一次提醒、只播一次、可关。**
- 做什么：开始/结束各一条通知；落块动画只播一次；摆件低频重绘（复用 sprite 缓存）；应用退出后不承诺计时（README 已说明提醒依赖进程）。
- 为什么：AESTHETIC §2.2「仪式只演一次」；现有性能预算（D-20261110-057）要复核。
- 成本：S–M。风险：长时间计时导致电量/CPU；需实测。

**B2-5｜证据克制：不引用心理学研究做营销。**
- 做什么：对外只说「可见倒计时 + 结算奖励 + 不监控」；不说「提升专注力 X%」。
- 为什么：本次 Study-with-Me/body doubling 研究摘要均未取得（〔学〕题录），不能编结论；VOICE 也禁止喊口号。
- 成本：S。风险：无。

### 6.4 B3 建筑即编年史

**B3-1｜以建筑为容器的「这一天」：点击积木回到当天。**
- 做什么：复用 `BrickInspectPopover` 的命中能力，弹出日期/习惯/随笔/心境/专注分钟/全勤；数据从 `PlacedBlock` + `CheckIn` 反查。
- 为什么：Day One 用「日记本」、Strava 用 activity 做容器；BlockHabit 的建筑天然是「日期 + 事件 + 位置」三元组（〔仓〕`types.ts`）。
- 成本：M。风险：190 块点击命中与查询性能；需缓存索引。

**B3-2｜回响可控：默认不弹、可关闭、可屏蔽某天。**
- 做什么：不在启动时强制弹回忆；用户打开「年鉴/手账」时才展示；每条回响可「以后不再显示这一天」。
- 为什么：Timehop 的每日回忆 + 2018 泄露、Facebook「On This Day」的痛苦回忆报道（〔媒〕The Verge 2015，标题证据）；回响是双刃剑。
- 成本：S。风险：屏蔽状态要落盘（本地设置），同步时可忽略。

**B3-3｜落成编年史：复用拍立得/画报工艺，不新增视觉语言。**
- 做什么：落成时生成「落成编年史」卡（正面建筑、背面时间线 + 总块数 + 全勤 + 奠基铭言）；复用 `PolaroidModal` / `MonthlyPosterModal` 的配色与版式。
- 为什么：现有两套画布已覆盖 2K、比例、主题取色（〔仓〕）；AESTHETIC §5 不做新视觉语言。
- 成本：S–M。风险：画布文案 i18n；导出验证。

**B3-4｜本地优先 + 导出三件套：PNG / PDF / JSON，零上传。**
- 做什么：年鉴与编年史只写本地；导出含年份、建筑名、生成时间；不新增网络请求。
- 为什么：Apple Journal 设备端、Wikipedia 本机计算、Obsidian 本地文件（〔官〕）；BlockHabit 的信任来自「数据是我的」。
- 成本：S。风险：不引入 PDF 依赖（AGENTS 不新增依赖）→ 先用 PNG/长图 + JSON，PDF 另议。

**B3-5｜空态与稀疏数据诚实：没有就显示没有。**
- 做什么：没有随笔显示「这天没有留下文字」；没有专注分钟不显示 0 分；没有全勤不显示 0 天。
- 为什么：AESTHETIC §5 / A6「数据诚实」；Day One 的 AI 摘要（Gold）是另一种路线，BlockHabit 不做 AI 编故事（〔官〕plans）。
- 成本：S。风险：空态过多显得空——用「建筑还在长」的引导替代。

---

## 7. 风险清单

| # | 风险 | 触发条件 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | 年度回顾变「数据审判」 | 使用排名、百分比、年龄/人格标签 | 用户焦虑、反感、口碑反噬（Spotify 2024/Listening Age 前例） | 只陈述事实、可关闭、口径可解释 |
| R2 | 社交化滑坡 | 为传播加分享/排行榜/好友 | 直接违反 AESTHETIC §5 / A7 | 明确只做本地导出图片 |
| R3 | 内容包破坏数据 | 旧客户端写未知内容、静默丢字段 | 用户建筑/记录损坏（Minecraft/Anki 前例） | 版本契约、拒绝写入、备份、未知字段保留 |
| R4 | 内容通胀 | 月度上新、海量 DLC、货币化 | 稀释「块=时间」的稀缺性（Sims 4 前例） | 年度级、少量、主题化；不做货币 |
| R5 | 订阅化 | 为内容收费引入订阅 | 与本地优先叙事冲突（Forest 2025 前例） | 本轮不做订阅；先签名/更新/备份 |
| R6 | 监控滑移 | 「专注」功能加窗口读取/应用统计 | 隐私红线、权限争议、信任崩塌 | 写进设计记录：只允许倒计时 |
| R7 | 陪伴拟人化 | 加宠物/角色/AI 伙伴 | 分散建筑焦点、违背「不做养成」 | 陪伴物=建筑；不新增角色 |
| R8 | 回响冒犯 | 自动推送旧随笔/旧照片 | 情感伤害（悼念、分手、失败） | 默认不推送、可屏蔽、只在用户打开时展示 |
| R9 | 年鉴性能 | 大建筑、多年份、长图 | 卡顿/崩溃（190 块热路径） | 离屏画布、缓存、分页/分卡 |
| R10 | 无签名分发 | 内容包/安装包手动下载 | SmartScreen 警告、首装流失 | 页面写清警告 + 校验和 + 回滚 |
| R11 | 时区/跨年边界 | 12 月 31 日/1 月 1 日、跨时区 | 年鉴统计错位 | 统一本地日期键（现有 `dateKey`）与口径说明 |
| R12 | 画布 i18n 漏翻 | 年鉴/编年史画布文案 | 英文用户看到中文 | 文案进 i18n，画布双版，验收 grep |
| R13 | 假数据/演示数据 | 为了「好看」补空数据 | 违反 A6，破坏信任 | 空态诚实；不做模板化生成 |
| R14 | 第三方内容安全 | 内容包含脚本/路径穿越 | 本地执行风险 | 只允许数据、白名单字段、校验和 |

---

## 8. 明确不建议做什么（对齐 AESTHETIC §5 与本报告证据）

1. **不做社交 / 好友 / 排行榜 / 社区分享 / 公开年度榜单**（AESTHETIC §5 第一条；Spotify/Letterboxd 的传播力不可移植）。
2. **不做账号体系 / 云回忆 / 第三方 OAuth**（GitHub Unwrapped 模式需要授权；Timehop 泄露是反面教材）。
3. **不做订阅制 / 内容商店 / 游戏内货币 / 海量 DLC**（Sims 4 通胀反例；Forest 2025 订阅化争议；A7）。
4. **不做监控 / 阻断 / 屏幕读取 / 应用使用统计 / 专注评分**（Focus Bear 是控制型路线；AESTHETIC §5、A7）。
5. **不做养成宠物 / 拟人化 AI 伙伴 / 真人视频陪伴**（AESTHETIC §5；现有建筑已足够作为陪伴物）。
6. **不做「错过就永久失去」的限时年鉴**（Apple 奖章 FOMO 不适合本地工具；年鉴应可补看）。
7. **不做 AI 生成回忆 / 自动编故事 / 算法人格标签**（Day One Gold 是另一条产品路线；A6 数据诚实）。
8. **不做无版本的内容包 / 未知内容静默丢弃 / 旧客户端重写新数据**（Minecraft/Anki/SemVer 教训）。
9. **不做「多打多送块」「连续 200 天双倍」等通胀机制**（AESTHETIC §6；D-20261110-049 已用分环而非新颜色解决奖励层级）。
10. **不做必须联网的年度回顾 / 遥测 / 上传分析**（A7；Wikipedia 的本机计算是正确姿势）。

---

## 9. 来源清单（访问日期均为 2026-11-10）

### 9.1 年度回顾 / 分享与隐私

- Spotify Wrapped 2025 规模（MBW，2025-12-08）：https://www.musicbusinessworldwide.com/spotify-wrapped-campaign-hit-200m-engaged-users-in-24-hours-a-19-yoy-increase/ 〔媒〕
- Spotify Wrapped 2024 口碑与 2025 更新（Mashable，2025-12-03）：https://mashable.com/article/spotify-wrapped-internet-reactions-2025-vs-2024 〔媒〕
- Spotify Wrapped 流行与批评（Indian Express，2025-12-04）：https://indianexpress.com/article/explained/explained-culture/dizzying-popularity-of-spotify-wrapped-and-why-it-has-set-off-criticism-10401018/lite/ 〔媒〕
- Spotify Wrapped 结构与历史（Wikipedia，含 2018 投诉、2019 声量、Guardian 引文）：https://en.wikipedia.org/wiki/Spotify_Wrapped 〔官/媒汇编〕
- Strava 第 12 份 Year in Sport 趋势报告（Strava Press，2025-12-02）：https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025 〔官〕
- Strava Heatmap 与位置安全（RTÉ Brainstorm，2026-04-14）：https://www.rte.ie/brainstorm/2026/0414/1566131-apps-privacy-security-location-monitoring-secrets/ 〔媒〕
- Apple Watch 活动奖章与 2025 限时挑战（Wareable，2025-12-19）：https://www.wareable.com/apple/how-to-view-earn-apple-watch-awards-challenges-badges-achievements 〔媒〕
- Apple 活动圆环与趋势（Apple Support）：https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos 〔官〕
- GitHub Skyline（官方页，现「暂时熄灯」；含 `gh-skyline` CLI）：https://skyline.github.com/ 〔官〕
- GitHub Unwrapped（第三方年度视频；可选读取私有活动）：https://githubunwrapped.com/ 〔社〕
- Reddit Recap 官方说明：https://redditforcommunity.com/reddit-recap 〔官〕
- Letterboxd 2025 Year in Review FAQ（≥10 部、1 月 2 日邮件、社区 1 月 12 日、隐私模式不计入统计、导出/导入 CSV）：https://letterboxd.com/journal/2025-letterboxd-year-in-review-faq/ 〔官〕
- Wikipedia Year in Review 项目页（本机计算、不上传 pageview、2024/2025 迭代、捐赠参与）：https://www.mediawiki.org/wiki/Wikimedia_Apps/Team/Wikipedia_Year_in_Review 〔官〕
- Wikimedia 2025→2026 复盘（5 天漏斗、重置 seen、info 图标、自报捐赠）：https://phabricator.wikimedia.org/T410691 〔官〕
- Wikimedia 2026 Epic（计划中的幻灯片/互动清单）：https://phabricator.wikimedia.org/T427425 〔官〕

### 9.2 内容扩展 / 定价 / 兼容

- Steam AppDetails API（价格/DLC 数；本次核查 appid）：https://store.steampowered.com/api/appdetails?appids=1222670（Sims 4）、413150（Stardew）、1794680（Vampire Survivors）、2113850（Spirit City）、1313140（Cult of the Lamb）、275850（No Man's Sky） 〔官〕
- No Man's Sky 商店页「包含发售后全部大型更新」：https://store.steampowered.com/app/275850/ 〔官〕
- The Sims 4 内容通胀与付费 mod 批评（GameSpot via Yahoo，2026-03-20）：https://tech.yahoo.com/gaming/articles/sims-4s-maker-marketplace-insult-204000377.html 〔媒〕
- Forest 商业模式（2025 免费下载 + Forest Plus；核心免费）：https://en.wikipedia.org/wiki/Forest_(application) 〔官/媒汇编〕
- Pomofocus 桌面版未签名提示：https://pomofocus.io/ 〔官〕
- Obsidian 社区插件（10,200 插件 / 1,002 主题；第三方代码警告）：https://obsidian.md/plugins 与 https://help.obsidian.md/Extending+Obsidian/Community+plugins 〔官〕
- Minecraft Wiki：世界降级警告与「不支持降级」：https://minecraft.wiki/w/Tutorial:Downgrading_a_world 〔社/官〕
- Anki 文档：旧版打开前需「Downgrade & Quit」：https://docs.ankiweb.net/releases/changes/changes/intro 〔官〕
- Semantic Versioning 2.0.0：https://semver.org/ 〔官〕

### 9.3 专注陪伴 / 不监控

- Pomofocus 功能与定价：https://pomofocus.io/ 〔官〕
- Focus Bear 功能（例程、休息、超聚焦/会议检测、阻断、严格等级）：https://www.focusbear.io/features 〔官〕
- Focus Bear 定价（$9.99/月、7 天试用、免费 Essentials）：https://www.focusbear.io/pricing 〔官〕
- Focusmate 定价（免费 3 次/周；Plus $8 年付 / $12 月付）：https://www.focusmate.com/pricing 〔官〕
- Lofi Girl（1000 万订阅、2022 DMCA 下架与恢复、直播时长/播放）：https://en.wikipedia.org/wiki/Lofi_Girl 〔官/媒汇编〕
- Spirit City: Lofi Sessions（$11.99、6 DLC、评测数据、桌面陪伴标签）：https://store.steampowered.com/app/2113850/Spirit_City_Lofi_Sessions/ 〔官〕
- Study with me 与内在动机/压力/表现（题录，摘要未取得）：https://www.sciencedirect.com/science/article/abs/pii/S0360131525000119 〔学〕
- Study With Me 大规模分析（题录，摘要未取得）：https://www.sciencedirect.com/science/article/abs/pii/S0360131525002568 〔学〕
- Body doubling / ADHD 协作实践（题录片段；正文 CAPTCHA）：https://dl.acm.org/doi/10.1145/3663547.3746324 〔学〕

### 9.4 编年史 / 回忆 / 日记

- Day One 定价与功能（Basic 免费含 E2EE/On This Day；Silver $49.99/年；Gold $74.99/年；AI 摘要；打印折扣）：https://dayoneapp.com/plans/ 〔官〕
- Apple Journaling Suggestions 与隐私（设备端处理、类别开关、有限历史数据）：https://www.apple.com/uk/legal/privacy/data/en/journaling-suggestions/ 〔官〕
- Timehop（每日回忆、2016 改版 7,000+ 一星、2018 约 2,100 万用户泄露）：https://en.wikipedia.org/wiki/Timehop 〔官/媒汇编〕
- Facebook「On This Day」痛苦回忆（The Verge，2015-04-02；正文未抓取）：https://www.theverge.com/2015/4/2/8315897/facebook-on-this-day-nostalgia-app-bringing-back-painful-memories 〔媒〕
- Notion 日记模板（模板市场）：https://www.notion.com/templates/journal 〔官〕

### 9.5 仓库内依据（〔仓〕，2026-11-10 工作区）

- `README.md`（12 座蓝图 1385 块、无自动更新、平台范围、本地优先）。
- `design/AESTHETIC.md`（§2 三个隐喻、§5 不做清单、§6 张力）。
- `design/VOICE.md`（术语表、语气、画布 i18n 例外）。
- `docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md`（15 竞品与 10 条建议；本文不重复）。
- `docs/superpowers/specs/2026-11-10-blockhabit-engagement-and-performance.md`（第四轮打开回路）。
- `design/records/D-20261110-038-f2-endgame-messaging.md`（内容终局诚实表达）。
- `design/records/D-20261110-048-decisions-and-f4-http.md`（无签名不接 updater、公理决议）。
- `design/records/D-20261110-049-b5-bonus-tiers.md`（奖励分环而非新颜色）。
- `design/records/D-20261110-050-platform-scope-and-prettier.md`（移动端冻结）。
- `src/types.ts`（`CheckIn`/`PlacedBlock`/`DayClaim`/`AppState.schemaVersion=2`/`foundationNotes`）。
- `src/pages/Stats.tsx`（指标/手账长廊、积木历史回响、Markdown 导出、修复积木）。
- `src/components/MonthlyPosterModal.tsx`（2K 画布、三种比例、主题取色）。
- `src/components/PolaroidModal.tsx`（正面 3D 照片 + 背面随笔时间线）。
- `src/components/Heatmap.tsx`（13 周灰阶、全勤满亮、roving tabindex）。
- `src/logic/streak.ts`（当前/最长连击、温和风化、连续领块天数）。
- `src/logic/showcase.ts`（26×26 展台、AABB 摆放）。
- `src/logic/blueprint.ts`（顺序解锁、每 7 天 bonus、nextSlot）。
- `src/store/timerStore.ts`（内存态倒计时会话，不持久化）。
- `src/storage/adapter.ts` / `src/storage/tauriStorage.ts`（schema v2 校验/净化、原子写）。
- `src/sync/merge.ts`（WebDAV 墓碑合并）。

### 9.6 已尝试但抓取失败（不作为事实来源）

- Strava 帮助中心「Year in Sport」多语言条目（2026-11-10 均 404）。
- ScienceDirect / ACM 摘要（人机验证/CAPTCHA）。
- The Verge、TechRadar、GamesRadar 正文（反爬/代理域名封锁）。
- Apple 官方「Activity 奖章」专门页面（仅取得活动圆环/趋势支持页，奖章列表以媒体整理为准）。

---

## 10. 附录

### 10.1 与已有竞品文档的分工（避免重复）

- 已有文档回答「市场上谁在做什么、BlockHabit 的位置在哪、10 条建议的优先级」；本文回答「四个创新项的外部证据、设计工艺、兼容与隐私约束、可执行清单」。
- 本文不重复 15 竞品的价格/评分总表；只在新角度补充：年度回顾的叙事与失败案例、内容包的定价结构与兼容、专注陪伴的监控边界、回忆产品的隐私与情感风险。
- 本文的 A2/B1/B2/B3 启示与已有文档 §3 的 A2/B1/B2/B3 是「同一方向的深挖」，不是替代；实施前仍需按 AGENTS §1 写设计记录并人工批准。

### 10.2 可复现核查命令（研究复算用，不改仓库）

```bash
# 1) 仓库事实：蓝图数量与块数（只读）
grep -c "make.*Blueprint" src/logic/blueprints/index.ts
grep -n "1385" README.md
# 2) Steam DLC 数量（示例）
curl -s "https://store.steampowered.com/api/appdetails?appids=1222670&cc=us" | head -c 200
# 3) 年度回顾/内容包相关设计记录检索
grep -rn "年鉴\|回顾\|内容包\|DLC" docs design | head -50
```

### 10.3 未验证项汇总（后续若有人引用，必须重新核查）

1. 「年度回顾提升留存/拉新 X%」：无公开数据。
2. Strava 个人 Year in Sport 的具体规则（阈值、分享范围）：英文帮助页已下线，未取得。
3. Study-with-me / body doubling 的实验结论：只有题录，未取得摘要。
4. Apple 2025 限时奖章完整清单：只有媒体整理，未取得官方汇总页。
5. The Sims 4 「$1,600」为媒体统计，非 EA 官方定价汇总；以 Steam 115 条 DLC 条目为可复核锚点。
6. Notion 模板的免费/付费比例：未统计。
7. Facebook「On This Day」具体案例：仅标题级证据。

### 10.4 一句话收尾

> **年度回顾负责「把时间变成物证」，内容包负责「让物证有下一章」，专注陪伴负责「让下一章在今天发生」，编年史负责「让每一章都能被翻回去」。四件事的共同前提只有一个：数据是用户的、内容是诚实的、边界是不监控。**

---

*本文档为产品调研输入，不替代设计记录，也不构成实施批准。任何涉及视觉/文案/数据模型的改动，按 AGENTS.md §1 先写 `design/records/` 记录，再由人类审核。*
