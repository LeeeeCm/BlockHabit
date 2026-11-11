# BlockHabit 创新调研 A：桌面常驻 / WebDAV / 数据档案的市面证据

> **性质**：外部证据调研（只取证与判断，不做设计决策、不改代码）。
> **任务**：共享任务板 task-7。**上游**：2026-11-10-blockhabit-competitive-and-innovation.md（15 竞品 + 10 建议）；本文不重复竞品总表，只深挖 A1 / A3 / A4 与「桌面常驻的注意力伦理」。
> **下游**：设计方案由 2026-11-10-blockhabit-innovation-deep-dive.md 承接；本文不构成实施批准。
> **口径**：优先官方商店页 / 官方帮助中心 / 官方设计文档 / 官方仓库 issue；逐条标注「官方宣称 / 可验证事实 / 我的判断」。
> **访问日期**：链接全部于 **2026-11-10** 访问；价格与评分是时点数据，复用需重核。
> **术语**：沿用 design/VOICE.md（积木 / 蓝图 / 落成 / 连击 / 全勤 / 修复积木 / 展台 / 摆件）。

---

## 0. 一页结论

1. **桌面常驻已有成熟的「不打扰」范式：自动让位 + 按应用规则 + 帧率预算 + 显性退出。**
   Wallpaper Engine 官方文档写明默认在游戏时自动暂停，并可对任意 exe 设「运行即停止并释放内存」〔[WE game](https://help.wallpaperengine.io/en/performance/game.html) / [WE rules](https://help.wallpaperengine.io/en/functionality/applicationrules.html)，2026-11-10〕。
2. **「摆在桌面上的物件」在 Windows 没有系统级先例。**
   Windows 小组件是覆盖桌面的悬浮面板（Widgets Board）〔[Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/widgets/)，2026-11-10〕；macOS 才是正面先例（Sonoma 起小组件可放桌面任意位置）〔[Wiki Sonoma](https://en.wikipedia.org/wiki/MacOS_Sonoma)，2026-11-10〕。
3. **尺寸分档是平台惯例，不是 BlockHabit 的发明。**
   Apple HIG 尺寸家族为 Small / Medium / Large / Extra large / Extra large portrait〔[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/widgets)，2026-11-10〕；Finch widget 也提供小/中/大三档〔[Finch 帮助](https://help.finchcare.com/hc/en-us/articles/39758423780621-The-Finch-Widget)，2026-11-10〕。
4. **WebDAV 的真实缺口是「定位失败原因」，不是「连不上」。**
   Joplin 有显式 Check synchronisation configuration 按钮（且被版本升级改坏过）；Remotely Save 的连通性检查把四类原因压成一句话〔[Joplin #14030](https://github.com/laurent22/joplin/issues/14030) / [RS #1128](https://github.com/remotely-save/remotely-save/issues/1128)，2026-11-10〕。
5. **档案包的行业最小公约数是「一个包裹 + 一份人话说明」。**
   Spotify 给 ZIP 并在包内附 Read Me First〔[Spotify](https://support.spotify.com/us/article/data-rights-and-privacy-settings/)，2026-11-10〕；Obsidian 反证「文件夹即数据库」同样成立〔[Obsidian](https://obsidian.md/help/data-storage)，2026-11-10〕。
6. **三条判断（我的判断）**：
   A1 的验收重点是**退出路径 + 让位机制**，不是三档尺寸；
   A3 的重点是**分步自检 + 应用专用密码引导 + 凭据诚实**；
   A4 的重点是**能被自己回读**（round-trip）。

---

## 1. 桌面常驻形态（A1 证据基础）

### 1.1 七个样本

| # | 产品 | 平台 | 形态 | 尺寸 / 位置 | 留存机制 | 价格 |
|---|---|---|---|---|---|---|
| 1 | **NekoTrak** | Win/Steam | 桌宠猫 + 应用与网站时间追踪 + 专注计时 + 悬浮时钟 | 窗口尺寸未公开（**未验证**） | 养成 + 金币解锁猫 + 多猫互访 + Steam Cloud | **$3.99 买断** |
| 2 | **Finch** widget | iOS/Android | 主屏/锁屏小组件，露出宠物活动 | iOS 小/中/大；Android 需手动拖边 | 宠物养成 + 情绪签到 + 朋友 | 免费 + **$9.99/月 或 $69.99/年** |
| 3 | **Shimeji-ee** | Win（fork 到 macOS/Linux） | 桌面游走桌宠，行为由 XML 定义 | 无窗口，叠在桌面 | 角色包生态 + 素材自定义 | **免费开源** |
| 4 | **Desktop Goose** | Win/macOS | 抢鼠标、拖泥、弹记事本的鹅 | 无窗口，全屏漫游 | 梗传播 + 模组 | **自定价** |
| 5 | **Wallpaper Engine** | Win/Steam | 动态壁纸（桌面最底层常驻渲染） | 逐显示器可设不同壁纸 | Workshop 生态 | **$4.99 买断** |
| 6 | **macOS 桌面小组件** | macOS Sonoma+ | 系统小组件放在桌面任意位置 | 系统尺寸家族（含 extra large） | 系统级：随专注模式管理 | 随系统免费 |
| 7 | **Windows 小组件** | Win 11 | **悬浮 Widgets Board 面板** | 面板网格，非桌面物件 | 系统推荐流 + 应用小组件 | 随系统免费 |

> **读法**：能长期待在眼前的形态只有四种——壁纸层、桌面叠层角色、系统小组件、悬浮小窗（BlockHabit 现有摆件）。Windows 官方小组件恰好不是常驻桌面，所以「桌面上的物件」在 Windows 是空位（我的判断）。

### 1.2 逐条证据

**NekoTrak —— 陪伴与监控绑在同一张买断票上**

- 可验证事实：发售 2026-10-10、**$3.99**、仅 Windows；类型 Casual/Indie/Simulation，标签含 Utilities、Desktop Companion；评价「Very Positive (164) — 98% 好评」〔[Steam](https://store.steampowered.com/app/5249210/NekoTrak/) / [API](https://store.steampowered.com/api/appdetails?appids=5249210&cc=us)，2026-11-10〕。
- 可验证事实：含 Steam Cloud、成就、联机；无障碍分类含可调文字、颜色替代、纯鼠标可玩、无计时输入、随时存档〔同上〕。
- 官方描述：「It tracks app and website time and shares your activity, music, and tasks on Steam and Discord.」〔同上〕
- 官方宣称（EULA §3.1）：「designed to operate locally … does not operate a user-account server, advertising network, analytics SDK … We do not routinely receive or upload your activity database, task history, focus history, pet data, or settings」，并自加限定「This statement does not mean that all information always remains on your device.」〔[EULA](https://store.steampowered.com/eula/5249210_eula_0)，更新 2026-10-10〕
- 我的判断：它证明「桌宠 + 积累 + 买断」有人付费；隐私面来自**被动监控**，只能靠 EULA 承诺平衡。BlockHabit 只记录主动打卡，隐私面天然更小——这是可以说、也该说的差异。

**Finch widget —— 尺寸分档 + 官方承认刷新滞后**

- 可验证事实：widget「shows you what your Finch is currently up to without opening the app」；iOS 可选小/中/大，Android 需自行拖边〔[Finch 帮助](https://help.finchcare.com/hc/en-us/articles/39758423780621-The-Finch-Widget)，更新 2026-11-07〕。
- 可验证事实（Important to Know）：「The widget may be a little behind what's happening in the app」——**官方自认会滞后**〔同上〕。
- 可验证事实：Finch Plus **$9.99/月 或 $69.99/年**〔[定价](https://help.finchcare.com/hc/en-us/articles/38755205001869-Finch-Plus-Pricing)，更新 2026-10-06〕；美区 App Store **4.94723 / 773,882 评分 / 免费**，开发商 Finch Care PBC，版本 3.73.236〔[iTunes Lookup](https://itunes.apple.com/lookup?id=1528595748&country=us)，2026-11-10〕。
- App Store 评论（iTunes RSS 美区最近评论，**定性证据、非全量**）：断签无补救被 1 星差评（LOST MY STREAK, NO MISTAKE BUTTON）；「mute sound effects without muting the meditation bell … very disruptive」；「while it nudges you it doesn't push you」被当成优点；「nothing to do … tap and say that you did it」抱怨内容薄。
- 我的判断：widget 是**观察窗**（看），BlockHabit 摆件是**操作台**（打卡）。观察窗可以很小；操作台有**最小可点击尺寸**下限，这决定三档不能等比缩。

**Shimeji-ee —— 行为脚本 + 素材生态 = 最长寿的桌宠形态**

- 可验证事实：「Shimeji are little desktop companions that run around your computer screen … Shimeji requires Java and runs only on Windows.」项目源于一个「seemingly abandoned」前身〔[官网](https://kilkakon.com/shimeji/)，2026-11-10〕。
- 可验证事实（fork README）：「freely wanders and plays around the screen … its actions are defined through XML and its animations/images can be customized」；改动清单含「Proper DPI scaling」，运行时从 JRE 6 升到 JDK 25〔[README](https://raw.githubusercontent.com/DalekCraft2/Shimeji-Desktop/master/README.md)，2026-11-10〕。
- 我的判断：桌宠寿命来自「行为可脚本化 + 素材可替换」，不是功能多。BlockHabit 的等价物是蓝图与积木几何，不需要脚本，但需要尺寸与 DPI 的确定性。

**Desktop Goose —— 免费梗传播，第一问是「怎么关掉」**

- 可验证事实：itch.io 标「Name your own price」，Win/macOS，**4.8/5（1,987 评分）**，Windows 包 4.1 MB〔[itch.io](https://samperson.itch.io/desktop-goose)，2026-11-10〕。
- 可验证事实：0.3 更新才加入「NEW CONFIG TOGGLES … **silence the audio**」与模组 API；config.goos 可调 aggression〔同上〕。
- 可验证事实（评论区）：最高频问题「how to remove this temporarily ? T^T」，回答「hold esc」〔同上〕。
- 我的判断：常驻玩具最诚实的教训——用户第一个想问的不是「怎么玩」而是「怎么让它消失」。退出/暂停必须显性。

**Wallpaper Engine —— 桌面常驻的「让位」范式**

- 可验证事实：发售 2018-11-16、**$4.99**；英文评价 235,276 条（97%），近 30 天 6,872 条（96%）；API recommendations.total = 955,366〔[Steam](https://store.steampowered.com/app/431960/Wallpaper_Engine/) / [API](https://store.steampowered.com/api/appdetails?appids=431960&cc=us)，2026-11-10〕。
- 可验证事实：「By default, Wallpaper Engine pauses itself while you are in-game」，可把 Other application fullscreen 设为 **Stop (free memory)**〔[WE game](https://help.wallpaperengine.io/en/performance/game.html)，2026-11-10〕；Application Rules 支持 Condition = Is running / Is playing audio，Behavior = Stop (free memory) / Keep running〔[WE rules](https://help.wallpaperengine.io/en/functionality/applicationrules.html)，2026-11-10〕。
- 可验证事实：存在故障条目「Playlist Causes focus loss / minimizes games」——桌面常驻渲染可能导致焦点丢失，被官方承认为已知问题类别〔[WE focusloss](https://help.wallpaperengine.io/en/general/focusloss.html)；**正文未完整抓取，仅确认条目存在**，2026-11-10〕。
- 可验证事实：GPU 页标题即「High GPU usage misconception」，解释任务管理器占用不准，建议降帧率、关 MSAA、多屏接同一显卡〔[WE gpu](https://help.wallpaperengine.io/en/performance/gpu.html)，2026-11-10〕。
- 我的判断：成熟形态 = 自动让位 + 按应用规则 + 帧率预算；BlockHabit 摆件是 Canvas 持续渲染，同样适用。

**macOS 桌面小组件 —— 唯一「摆在桌面上」的系统先例**

- 可验证事实（二手转述）：Sonoma（2023-06-05 发布，2023-09-26 正式版）写明「Widgets have been revamped. They are no longer constrained to the Notification Center—instead they can be placed anywhere on the desktop」〔[Wiki: macOS Sonoma](https://en.wikipedia.org/wiki/MacOS_Sonoma)，2026-11-10；Apple Newsroom 本次返回 404，故用二手来源并标注〕。
- 可验证事实（Apple 官方设计文档）：「On the desktop and Notification Center of their Mac」；尺寸家族「Small / Medium / Large / Extra large / Extra large portrait」，且「may include one or more interaction elements」〔[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/widgets)，2026-11-10〕。
- **未验证**：support.apple.com/en-us/108996 标题可确认（Add and customize widgets on Mac），正文因页面体积被截断；macOS 侧「实时活动」的桌面形态未找到可抓取官方页，不展开。

**Windows 小组件 —— 面板，不是桌面物件**

- 可验证事实（微软设计文档）：「displayed in a grid in the **Widgets Board: a flyout plane that overlays the Windows desktop**」；入口为任务栏图标、**Win+W**、左缘滑动〔[Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/widgets/)，2026-11-10〕。
- 可验证事实：同页强调「Widgets are not meant to replace apps and websites」；支持页提供「**Open on hover**」开关，可关掉「悬停任务栏即弹出」〔[MS 支持](https://support.microsoft.com/en-us/windows/experience/personalization/stay-up-to-date-with-widgets-in-windows)，2026-11-10〕。
- 我的判断：Windows 把小组件放进需主动唤起的面板，是系统级减打扰取舍；悬停即开这种默认更易误触，所以给了开关。置顶摆件比它更「在场」，更需要自己的让位策略。

### 1.3 三条横读

1. **陪伴的留存来自关系，不来自功能**：NekoTrak 靠养成/收集/联机，Finch 靠宠物/签到，Shimeji 靠角色包。BlockHabit 的建筑是**不会撒娇的物件**，留存只能靠「今天多了一块」的可见增量（我的判断）。
2. **价格带窄而清晰**：桌面小工具买断集中在 **$3.99–$4.99**；移动陪伴型走订阅（$9.99/月）。样本仅三个，不作统计结论（我的判断）。
3. **越「在场」的产品，越要自己决定何时退场**：Goose 评论区第一问是关掉；WE 用默认暂停 + 应用规则；Windows 干脆挪进面板（我的判断）。

### 1.4 官方宣称 vs 可验证事实

| 声明 | 判定 |
|---|---|
| NekoTrak 本地运行、不上传活动库、无分析 SDK〔EULA §3.1〕 | **官方宣称**（自带限定语） |
| NekoTrak $3.99 / 2026-10-10 / 仅 Windows / 164 条评价 98% 好评〔Steam 页 + API〕 | **可验证事实**（时点数据） |
| Finch widget 三档尺寸、可能滞后〔Finch 帮助〕 | **可验证事实**（官方文档明写） |
| Finch 4.95 分 / 77 万+ 评分〔iTunes Lookup〕 | **可验证事实**（4.94723 / 773,882） |
| Finch Plus $9.99/月、$69.99/年〔帮助中心〕 | **可验证事实** |
| Desktop Goose 4.8/5、1,987 评分、自定价〔itch.io〕 | **可验证事实** |
| Wallpaper Engine 235,276 条英文评价 97% 好评、默认游戏时暂停〔Steam + 官方帮助〕 | **可验证事实** |
| macOS Sonoma 起小组件可放桌面〔Wikipedia 转述〕 | **二手可验证**（官方页 404） |
| Windows 小组件是覆盖桌面的悬浮板〔Learn + 支持页〕 | **可验证事实** |

### 1.5 失败模式清单

| 失败模式 | 证据（2026-11-10） | 对 BlockHabit 的含义 |
|---|---|---|
| 不知道怎么关掉 | Goose 评论「how to remove this temporarily ?」〔itch.io〕 | 摆件必须有显性关闭/暂停 |
| 断签无补救 | Finch 1 星「LOST MY STREAK NO MISTAKE BUTTON」〔App Store〕 | [修复积木] 是优势，但要让人找得到 |
| 音效打扰、无法粒度控制 | Finch 评论要求「单独静音音效」〔同上〕 | 落块音效需单独静音且默认更轻 |
| 内容不够玩 | Finch 评论「nothing to do … tap and say that you did it」〔同上〕 | 需要「下一座」的可见承诺 |
| 摆放/朝向受限 | Finch 评论（iPad 横屏需取下支架）〔同上〕 | 窄窗/竖屏必须仍可用 |
| DPI 缩放长期失修 | Shimeji fork「Proper DPI scaling」〔README〕 | 三档尺寸必须跨 DPI 验收 |
| 抢焦点 / 让游戏最小化 | WE 故障条目「Playlist Causes focus loss」〔WEE〕 | 置顶窗口不得抢焦点 |
| GPU 占用争议 | WE「High GPU usage misconception」〔WEE〕 | 限帧 + 离屏暂停 + 省电档 |

### 1.6 证据缺口

- **NekoTrak 单条差评未取得**：Steam 社区评价页与 appreviews 接口本次返回登录页/首页，只能引用商店汇总 → **未验证**具体抱怨点。
- **NekoTrak 窗口尺寸与置顶行为未验证**；**Finch / WE 的隐私争议未核实**，不写；**Desktop Goose 是否联网/遥测未验证**。

---

## 2. WebDAV 配置 UX（A3 证据基础）

### 2.1 BlockHabit 现状（代码事实）

| 维度 | 现状 | 依据 |
|---|---|---|
| 配置字段 | endpoint / username / password / enabled / autoSyncIntervalMinutes / lastSync* | src/sync/types.ts |
| 凭据存储 | **localStorage 明文 JSON**（键 blockhabit_webdav_config），输入防抖 800ms 落盘 | src/sync/useSync.ts |
| 错误码 | auth / network / conflict / no-collection / http / cors + no-endpoint / parse / incompatible | src/sync/webdav.ts、useSync.ts |
| 自检 | **没有「测试连接」**；只有 syncNow（会真的拉取+合并+上传） | 同上 |
| URL 规范化 | 自动补 https://、自动拼 blockhabit-data.json、支持直接给 .json、逐段 encode | src/sync/webdav.ts |
| 认证与并发 | Basic Auth（UTF-8→base64）；ETag If-Match 条件写；412 重拉重并；409 先 MKCOL | 同上 |
| 原生通道 | 桌面端走 tauri-plugin-http 绕 CORS，浏览器预览回落 fetch | src/platform/http.ts（D-048） |
| 文案一致性 | cors 文案仍写「桌面端直连通道还在开发中」，与 D-048 已落地冲突 | src/i18n/locales/zh.ts |

> 最后一行为**可验证代码事实**：README 与 D-048 已声明原生 HTTP 落地，设置页错误文案未同步——零成本可修。

### 2.2 五家做法对照

| 产品 | 服务商预设 | URL / 前置条件引导 | 应用专用密码 | 连接自检 | 失败提示 | 凭据存储 |
|---|---|---|---|---|---|---|
| **Joplin** | 已知可用清单（12 服务） | 给出两种 URL，要求先建 Joplin 目录 | 未强调 | **有**，成功文案明确 | 链到专门排错文档 | 版本信息含 Keychain Supported |
| **Nextcloud** | — | 直给 remote.php/dav/files/USERNAME/，并指出 Files 设置可查 | **官方建议第三方客户端用 app password**，称性能显著提升 | — | Known issues（自签证书、use_locks） | 服务端可单独撤销 |
| **rclone** | **vendor 枚举** | 交互式逐步问 | 密码显示为 ENCRYPTED，另有 obscure | 配置期即校验 | 按 provider 能力差异提示 | 配置文件内混淆 |
| **Remotely Save** | 支持列表含 NextCloud/InfiniCloud/Synology | 文档列服务名 | 未强制 | **有** Check Connectivity | **四类原因压成一句**（反面） | data.json 明文，官方要求自行保护 |
| **Synology** | — | Package Center 装 WebDAV Server，端口可自定义 | 未强调 | — | 前置条件清单 | 服务端账号 |

### 2.3 逐条证据

**Joplin：把「同步目标」做成产品，把自检做成按钮**

- 官方文档：Nextcloud 为独立目标，URL 形如 …/remote.php/webdav/Joplin 或 …/remote.php/dav/files/USERNAME/Joplin，并强调「**make sure to create the "Joplin" directory in Nextcloud**」〔[Joplin Nextcloud](https://joplinapp.org/help/apps/sync/nextcloud/)，2026-11-10〕。
- 官方文档给出「known to work」清单：DriveHQ、Fastmail、HiDrive、InfiniCLOUD、Mailbox.org、Nextcloud、ownCloud、Seafile Stack、Synology WebDAV Server、WebDAV Nav、Zimbra、Infomaniak kDrive〔[Joplin WebDAV](https://joplinapp.org/help/apps/sync/webdav/)，2026-11-10〕。
- 可验证事实：设置里有「Check synchronisation configuration」，成功文案「Success! Synchronisation configuration appears to be correct.」〔[PR #14031](https://github.com/laurent22/joplin/pull/14031)，2026-11-10〕；该按钮在 3.5.9 因同步目标新增必填项报「object.apiKey is not a function」〔[#14030](https://github.com/laurent22/joplin/issues/14030)，2026-11-10〕。
- 我的判断：值得抄两点——**目标即预设**、**自检要有正向成功文案**；同时它示范反面：**自检代码会随同步层重构而腐化，必须进回归测试**。

**Nextcloud：应用专用密码是官方推荐动作，不是高级选项**

- 官方原文：「When using a third-party WebDAV client … you should use an **application password** … In addition to improved security, **this increases performance significantly**.」创建路径：头像 → Personal settings → Security → 最底部；可单独撤销而不改主密码〔[Nextcloud](https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html)，2026-11-10〕。
- 官方 URL 引导：标准形态 https://example.com/nextcloud/remote.php/dav/files/USERNAME/，且「You can find the WebDAV URL in **Files settings under WebDAV**」——**服务端自带 URL 展示位**〔同上〕。
- 官方 Known issues：自签证书出警告（需配 CA）；「Resource temporarily unavailable」需 use_locks 0〔同上〕。
- 我的判断：**2FA 用户用主密码必然 401**，而 401 会被读成「密码错了」。预设卡片必须直接给「去生成应用专用密码」的路径。

**rclone：vendor 预设的意义是「开启能力」，不只是省打字**

- 官方文档：交互式 config 问「Name of the WebDAV site/service/software you are using」，枚举 fastmail / nextcloud / owncloud / sharepoint / sharepoint-ntlm / rclone / other，并说明「If you know what kind of system you are connecting to then rclone can enable extra features」〔[rclone](https://rclone.org/webdav/)，2026-11-10〕。
- 可验证事实：plain WebDAV 不支持修改时间与 hash；Fastmail / ownCloud / Nextcloud 支持 mtime 与 SHA1/MD5〔同上〕。配置摘要里密码显示为「pass: *** ENCRYPTED ***」〔同上〕；**obscure 可逆性未验证**（该页正文未完整抓取）。
- 我的判断：BlockHabit 的预设也该携带**能力声明**（是否支持 ETag/If-Match、是否需先建目录、默认端口），比填 URL 有用。

**Remotely Save：把四类原因合并成一句话的反面样本**

- README 支持列表写作「Webdav (NextCloud / InfiniCloud / Synology webdav server / ...)」〔[README](https://raw.githubusercontent.com/remotely-save/remotely-save/master/README.md)，2026-11-10〕。
- 官方警告（原文）：「You should protect your **data.json** … contains sensitive information … usually **NOT** a good idea to check the file into version control. By default, the plugin tries to create a .gitignore」——**凭据随配置明文落在 vault**，官方只能建议用户自保〔同上〕。
- 用户引述的界面文案：Check Connectivity 失败时提示「The Webdav server cannot be reached (possible to be any of address/username/password/authtype errors)」〔[#1128](https://github.com/remotely-save/remotely-save/issues/1128)，2026-11-10〕；该 issue 结论是 Infomaniak kDrive 开 2FA 后必须改用 app-specific password〔同上〕。
- 仍 open：#987「webdav **special characters in login credentials** cause 401」，workaround 是生成不含特殊字符的专用密码〔[#987](https://github.com/remotely-save/remotely-save/issues/987)，2026-11-10〕；#1158 iOS 自建 CA/自签证书导致连接失败〔[#1158](https://github.com/remotely-save/remotely-save/issues/1158)，2026-11-10〕。
- 我的判断：它把「地址错/用户错/密码错/认证类型错」合并，等于把诊断丢回用户；而它的 issue 库恰好把真实失败类别列全了——**这就是 A3 分步提示的现成分类表**。

**Synology：预设若只给域名，用户仍会卡在端口**

- 官方步骤：需 administrators 组账号 → Package Center 安装 **WebDAV Server** → 勾选 Enable HTTP/HTTPS → **端口可自定义** → 建议 HTTPS〔[Synology KB](https://kb.synology.com/en-global/DSM/tutorial/How_to_access_files_on_Synology_NAS_with_WebDAV)，2026-11-10〕；文档中出现 5006（HTTPS）相关示例〔同上〕。
- 我的判断：群晖预设必须写成「https://域名或IP:端口/共享文件夹名」，并提示「端口在 DSM 的 WebDAV Server 里查看」。

### 2.4 失败案例 → BlockHabit 错误码映射

| 真实失败 | 证据 | 现有错误码 | 覆盖情况 |
|---|---|---|---|
| 2FA 后用主密码 → 401 | RS #1128 | auth | 覆盖，但**文案未提 2FA/应用密码** |
| 密码含特殊字符 → 401 | RS #987（open） | auth | **未覆盖**（应提示改用不含特殊字符的专用密码） |
| 自建 CA / 自签证书 | RS #1158（open） | network / cors | **未区分证书错误** |
| 目录不存在 → 上传失败 | Joplin 文档要求先建目录 | no-collection | 覆盖（含 PROPFIND 二次确认） |
| 桌面端 CORS 文案过期 | zh.ts vs D-048 | cors | **文案与实现不一致** |

### 2.5 六条读数

1. **预设的价值在「带能力与前置条件」**：Nextcloud 要目录、Synology 要端口与文件夹、Joplin 要 Joplin 目录（我的判断，基于三份官方文档）。
2. **应用专用密码是 2FA 时代的必需品**：官方推荐 + 真实 401 案例（可验证事实）。
3. **自检必须是独立按钮、不能触发合并**：现在点「立即同步」就会真合并，失败时分不清「连不上」还是「合并出错」（代码事实 + 判断）。
4. **提示要分行，不要分句**：RS 一句话四原因 vs BlockHabit 已有 8 个错误码——基础更好，缺的是「码 → 下一步动作」的映射（判断）。
5. **凭据存储必须诚实**：BlockHabit 明文 localStorage、RS 明文 data.json、Joplin 版本信息有 Keychain Supported 降级行（可验证事实 + 判断）。
6. **自检代码本身会腐化**：Joplin #14030 是现成反例（可验证事实）。

---

## 3. 数据导出 / 档案包（A4 证据基础）

### 3.1 BlockHabit 现状（代码事实）

| 能力 | 现状 | 依据 |
|---|---|---|
| 导出/导入 | 设置页导出 JSON / 导入 JSON（覆盖导入） | SettingsDialog、storage/adapter |
| 自动留档 | 覆盖导入前自动备份，自动备份保留 5 份 | src/storage/backups.ts |
| 手动快照 | 单独保留 5 份（MANUAL_KEEP=5），ISO 时间戳文件名 + parseStamp 解析 | 同上 |
| 损坏兜底 | blockhabit.json.corrupt-backup | 同上 |
| 打开数据目录 | 系统文件管理器打开 appDataDir | 同上 |
| 诊断包 | 崩溃日志/数据体量/帧率采样，仅本机生成 | zh.ts diagnostics* |
| **缺** | 无压缩包、无 README、无校验和、无建筑 PNG 打包 | 代码事实 |

### 3.2 五个惯例样本

| 样本 | 载体 | 包内结构 | 人话说明 | 校验/幂等 | 回读 |
|---|---|---|---|---|---|
| **Spotify** | ZIP | 多个 JSON，按数据类型分文件 | **Read Me First** + Understanding My Data | 未提 | 不支持导入 |
| **Strava** | 单条文件 + 账户归档 | FIT / TCX / GPX + bulk archive | 帮助页解释三种格式差异 | 未提 | 靠第三方工具 |
| **Apple Health** | ZIP（export.zip） | export.xml 为主 + 心电图 CSV 等 | —（官方页正文未取到） | 第三方按 SHA-256 幂等 | 第三方工具可读 |
| **Obsidian** | **文件夹** | .md 纯文本 + .obsidian 配置目录 | 文档解释目录与隐藏文件夹 | Git 可管 | 天然可回读 |
| **GDPR Art.20** | 法律要求 | 「结构化、通用、机器可读」 | 法律语言 | — | 有义务提供 |

### 3.3 逐条证据

**Spotify：ZIP + Read Me First 是消费级导出的标杆**

- 官方原文：「You can get a **ZIP file** with a copy of your personal data by using the automated Download your data tool on your Account Privacy page」「you will receive several files, each containing a different type of personal data. For a description … please see the **Read Me First** file delivered together with your data」〔[Spotify 支持](https://support.spotify.com/us/article/data-rights-and-privacy-settings/)，2026-11-10〕。
- 我的判断：它把「机器可读」与「人可读」分成两层——数据文件给程序，Read Me First 给人。BlockHabit 档案包应照此分层。

**Strava：先给单条原始格式，再给整账户归档**

- 官方原文：单条活动可 Export Original（多为 FIT）、TCX（含心率/踏频/功率，仅 GPS 活动）、GPX（无 GPS 会得空文件）；「Bulk Export — As of May 25th, 2018, Strava provides the option to export an **archive of your account**.」〔[Strava 帮助](https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data)，更新 2026-09-14，2026-11-10 访问〕
- 我的判断：「多格式并存 + 说清各格式缺什么」值得抄——BlockHabit 若同时给 JSON 与 PNG，必须写明「JSON 是唯一可回读的权威，PNG 只是给人看的」。

**Apple Health：官方正文未取到，只给第三方结构描述（明确标注）**

- **未验证（官方）**：Apple 支持页 108779 可抓取正文为「管理健康数据」，不含导出步骤；iPhone 使用指南相关页被页面体积截断。
- 第三方实现文档（非 Apple 官方，仅结构参考）：Health → 头像 → 最底部「Export All Health Data」→ export.zip；包内 apple_health_export/export.xml 为主记录流，另含运动路线、临床记录、心电图 CSV；10 年 iCloud 账户约 800 MB，解析端按 1.5 GB 封顶；导入端用上传文件 SHA-256 做幂等〔[healthlog 文档](https://raw.githubusercontent.com/mbombeck/healthlog/25770912ce5f081e34ce90d8df67d77f38c7e7a9/docs/integrations/apple-health.md)，2026-11-10〕。
- 可验证事实（Apple 官方）：健康数据在 iCloud 加密存储与传输，端到端加密需 iOS 12+ 与双重认证；数据按「手动录入 > iPhone/iPad/Watch > 第三方 App 与蓝牙设备」优先级合并〔[Apple 108779](https://support.apple.com/en-us/108779)，2026-11-10〕。
- 我的判断：Apple 的例子说明档案包可以很大、很碎，但仍是诚实做法；BlockHabit 体量小几个数量级，没理由不做。

**Obsidian：文件夹即数据库，纯文本即可回读**

- 官方原文：「Obsidian stores your notes as **Markdown-formatted plain text files** in a vault. A vault is a **folder on your local file system**」；配置在 .obsidian 隐藏目录（含 workspace.json），提醒 Git 用户加 .gitignore；vault 可放任意位置，可用 Sync/Dropbox/iCloud/OneDrive/Git 同步〔[Obsidian](https://obsidian.md/help/data-storage)，2026-11-10〕。
- 我的判断：这条最贴合 BlockHabit——**「数据目录就是产品」**比「导出功能」更强。档案包若与数据目录同构，回读就免费成立。

**GDPR Art.20：可携带性是法定语言，不是营销词**

- 官方文本：数据主体有权以「**structured, commonly used and machine-readable format**」接收个人数据，并有权不受阻碍地传输给另一控制者〔[gdpr-info](https://gdpr-info.eu/art-20-gdpr/)，2026-11-10〕。
- 我的判断：BlockHabit 无账号无服务器，法律义务不直接适用；这句话可作「本地优先」的外部背书，但**不应宣称自己符合 GDPR**。

### 3.4 ZIP 还是文件夹

| 维度 | 文件夹 | ZIP | 判断 |
|---|---|---|---|
| 依赖 | 无（Tauri fs 已有） | 需压缩库（AGENTS 禁止新增依赖）或调系统能力 | **文件夹是当前唯一合规路径** |
| 可读性 | 双击即看，README 在眼前 | 需解压 | 文件夹更好 |
| 传输 | 多文件易丢/混垃圾 | 单文件好传 | ZIP 更好 |
| 回读 | 与数据目录同构，直接可导 | 需解压 | 文件夹更好 |
| 失败路径 | 可能留半成品（需临时目录再改名） | 一次成型 | ZIP 更稳 |

> **我的判断**：以「文件夹 + 可选单文件打包」为 A4 形态；文件夹是权威产物，ZIP 是便利副本。二选一则选文件夹（零依赖、可回读、与 Obsidian 范式一致）。

### 3.5 校验和与可读性

- 行业事实：rclone 提供完整校验工具链（check / hashsum / md5sum / sha1sum），官方对 check 的描述即「Checks the files in the source and destination match」〔[rclone check](https://rclone.org/commands/rclone_check/)，2026-11-10〕。
- 我的判断：**主流消费级导出（Spotify、Strava、Apple Health）在公开帮助页均未承诺发布校验和**——校验和是给技术用户的加分项，不是行业标配。BlockHabit 应提供 SHA256SUMS 文件而非强制校验步骤。
- 可读性三条判据（我的判断）：① 顶层必须有 README；② 文件名按时间排序且含语义词；③ README 必须写「如何把这个包导回来」。

### 3.6 读数

1. **包裹 + 说明 + 回读**是不可拆的最小件；缺回读的导出只是备份（我的判断）。
2. **体量决定形态**：Apple Health 几百 MB 必须 ZIP；BlockHabit 的 JSON 只有几十 KB 到数 MB，文件夹够用（判断，大档未实测）。
3. **可读性优先于压缩率**：Obsidian 纯文本范式证明「人能直接读懂」本身就是产品承诺（可验证事实 + 判断）。
4. **法律语言可提供叙事，不能当合规声明**（我的判断）。

---

## 4. 桌面常驻的注意力伦理

### 4.1 让位：默认不打扰比提供开关更有效

- 可验证事实：WE 默认在游戏时暂停，可设为 Stop (free memory) 彻底卸载壁纸；Condition 支持 Is running 与 Is playing audio〔[WE game](https://help.wallpaperengine.io/en/performance/game.html) / [WE rules](https://help.wallpaperengine.io/en/functionality/applicationrules.html)，2026-11-10〕。
- 可验证事实：Windows 小组件的「Open on hover」默认行为可关〔[MS 支持](https://support.microsoft.com/en-us/windows/experience/personalization/stay-up-to-date-with-widgets-in-windows)，2026-11-10〕。
- 我的判断：让位应当是**默认值**而非高级设置。用户不会去设置里找「如何不被打扰」，只会直接卸载。

### 4.2 可关闭：退出路径要显性到「不需要解释」

- 可验证事实：Goose 评论区最高频问题是「how to remove this temporarily ?」，答案「hold esc」；静音能力到 0.3 才补〔[itch.io](https://samperson.itch.io/desktop-goose)，2026-11-10〕。
- 我的判断：常驻物至少三条退出路径——窗口内按钮、快捷键、托盘菜单，且**关闭要记住状态**（BlockHabit 的 toggleMini 已在手动退出时写回 enableMiniWidget=false，行为正确，A1 需保留并说明）。

### 4.3 尺寸、声音、动效：把「存在感」做成可调档

- 可验证事实：Apple HIG 尺寸家族 5 档（含 extra large 与 extra large portrait），widget 会按上下文适配外观与渲染模式〔[Apple HIG](https://developer.apple.com/design/human-interface-guidelines/widgets)，2026-11-10〕；Finch widget 提供小/中/大三档并提醒可能滞后〔[Finch 帮助](https://help.finchcare.com/hc/en-us/articles/39758423780621-The-Finch-Widget)，2026-11-10〕。
- 可验证事实（用户诉求）：Finch 5 星评论要求「单独静音音效而保留冥想铃」；另一条把「nudges you but doesn't push you」当优点〔App Store 评论，2026-11-10〕。
- 我的判断：存在感应由**像素尺寸档 / 声音档 / 动效档**三档组成且彼此独立。只做尺寸不做声音，等于只解决一半打扰。

### 4.4 抱怨类型（跨产品归纳）

| 类型 | 表现 | 证据 |
|---|---|---|
| 不知道如何退出 | 「怎么临时关掉」 | Goose 评论 |
| 抢焦点/影响游戏 | 焦点丢失、游戏最小化 | WE 故障条目 |
| 音效打扰 | 音量不一致、无法单独静音 | Finch 评论 |
| 断签焦虑且无补救 | 丢连击、无补救按钮 | Finch 1 星评论 |
| 性能占用 | GPU 占用高 | WE「High GPU usage misconception」 |
| 摆放/朝向受限 | 横屏被挡住、需取下设备 | Finch 评论 |

### 4.5 五条原则（供 A1 验收引用，我的判断）

1. **默认安静**：摆件默认不发声、不动效循环（与 AESTHETIC §2.2「仪式只演一次」同源）。
2. **让位优先**：全屏/专注/游戏时暂停渲染；恢复时补一帧而不是补动画。
3. **退出显性**：按钮 + 快捷键 + 托盘三处可达，状态记忆。
4. **三档独立**：尺寸、声音、动效各自可调，不做「一刀切静音」。
5. **诚实告知**：置顶会让它出现在任何窗口前——这句话要写进首次进入摆件的说明里。

---

## 5. 对 BlockHabit 的启示

> 每条含：做什么 / 依据 / 成本 / 风险；成本口径沿用上游：S（1–2 天）、M（3–5 天）、L（一轮设计+实施）。设计值以 deep-dive 方案与设计记录为准。

### 5.1 A1 桌面摆件（三档尺寸 + 置顶）

**A1-1 三档是「信息密度档」，不是等比缩放。**
做什么：最小档只放建筑与一块进度；中档加蓝图名与「块数/总数」；大档才放今日待办胶囊。
依据：Apple HIG 尺寸家族 + Finch 小中大三档（可验证事实）；观察窗 vs 操作台的区别（判断）。成本 S。
风险：小档若放不下快捷打卡会削弱「操作台」定位——需明确「小档=看，大档=打卡」。

**A1-2 置顶默认关，进入时一次性告知「它会盖在任何窗口前」。**
做什么：复用现有 GuideTip 做一次性说明，不新增常驻提示；文案克制。
依据：Goose 评论区第一问是「怎么关掉」；Windows 悬停即开需开关（可验证事实）。成本 S。
风险：说明若说教，违反 VOICE 基线。

**A1-3 让位最小实现：前台全屏/游戏时暂停 Canvas 动画，只留静态最后一帧。**
依据：WE 默认暂停 + 应用规则（可验证事实）。成本 S–M。
风险：Tauri 侧全屏检测需要额外能力；若成本过高，降级为「失焦即降帧」这一低风险近似。

**A1-4 三档尺寸的验收必须覆盖 DPI 与多显示器。**
做什么：100%/125%/150% 缩放 × 单双屏 × Alt+F4/托盘唤起 的回归矩阵。
依据：Shimeji fork 才修 DPI；BlockHabit 迷你窗历史上出过尺寸锁死（可验证事实）。成本 S（以测试为主）。
风险：漏测会变成长期债。

**A1-5 尺寸与位置偏好进 AppSettings，与 enableMiniWidget 同组。**
依据：现有 settings 已有该字段与存储校验（代码事实）。成本 S。
风险：新增字段要过 adapter schema 净化与迁移测试。

### 5.2 A3 WebDAV 预设 + 连接自检

**A3-1 预设只给「URL 形态 + 端口/目录前置条件 + 能力声明」，绝不预填凭据。**
依据：Joplin 先建目录、Synology 端口可改、rclone vendor 携带能力（可验证事实）。成本 S。
风险：预设 URL 随服务商改版失效——文案必须写「以服务商文档为准」且允许用户改。

**A3-2 应用专用密码写进预设卡片的第一步。**
依据：Nextcloud 官方建议且称提升性能；RS #1128 的 2FA 案例（可验证事实）。成本 S。
风险：用户仍可能填主密码 → 401 文案需点名「开了两步验证请用应用专用密码」。

**A3-3「测试连接」必须是独立动作，且不触发合并/上传。**
做什么：PROPFIND 目录 → GET 现有数据文件（404 视为正常）→ 判定目录可写 → 逐项返回。
依据：Joplin Check 按钮；BlockHabit 现无自检而 syncNow 会真合并（可验证事实）。成本 S（http.ts 已就绪）。
风险：探针文件需清理，否则污染用户目录。

**A3-4 自检与错误映射必须有自己的 vitest 用例。**
覆盖：401（含 2FA 提示）、403、404 目录缺失、412 冲突、证书错误、CORS（浏览器预览）。
依据：Joplin #14030 自检按钮被版本升级改坏（可验证事实）。成本 S。
风险：mock httpFetch 与真实行为漂移，至少留一条集成用例。

**A3-5 凭据存储要诚实交代，并给「不保存密码」选项。**
做什么：短期在设置页写一行说明 + 「本次会话不保存」勾选；长期评估系统凭据库（需新依赖，走人工批准）。
依据：BlockHabit 明文存 localStorage、RS 明文 data.json 只能靠 gitignore、Joplin 版本信息有 Keychain Supported 降级行（可验证事实）。成本 S（短期）/ L（长期）。
风险：明文存储被用户发现会直接损伤「数据主权」叙事——**优先级高于任何 UI 美化**。

**A3-6 先修过期文案。** 依据：zh.ts 的 cors 文案与 D-048 冲突（代码事实）。成本 S（分钟级），风险无。

### 5.3 A4 一键档案包

**A4-1 结构照抄「包裹 + 说明 + 回读」：blockhabit.json + 建筑 PNG + README.txt + SHA256SUMS。**
依据：Spotify ZIP+Read Me First、Obsidian 文件夹、Strava 多格式说明（可验证事实）。成本 S–M。
风险：PNG 需在非 UI 环境构造渲染器，历史上有导出通道待验证项。

**A4-2 文件夹是权威产物，ZIP 是可选便利副本。**
依据：AGENTS 禁止新增依赖；Obsidian 证明文件夹范式成立（可验证事实）。成本 S / M。
风险：用系统能力压缩的可行性**未验证**，不要写进承诺。

**A4-3 README 必须含「如何导回」与「哪些可读、哪些可恢复」。**
依据：Strava 明说各格式缺什么、Spotify 用 Read Me First 解释数据（可验证事实）。成本 S。
风险：档案包可能给未来的自己看，建议中英并写（AGENTS 硬约束 4）。

**A4-4 校验和提供但不强制，README 给一行命令。**
依据：rclone check/hashsum 工具链；主流消费级导出未承诺校验和（可验证事实 + 判断）。成本 S。
风险：Windows 用户不熟 certutil，命令要写全。

**A4-5 档案包命名与备份文件名同构。**
依据：backups.ts 已有 blockhabit-backup-ISO 时间戳与 parseStamp（代码事实）。成本 S。
风险：目录名避开 Windows 非法字符（冒号）。

### 5.4 优先级

| 优先级 | 条目 | 收益 | 成本 | 依赖 |
|---|---|---|---|---|
| 1 | A3-6 修过期文案 | 中（信任） | S | 无 |
| 2 | A3-3 + A3-1 自检与预设 | 高 | S | 无 |
| 3 | A1-2 + A1-1 置顶告知与三档 | 高 | S–M | 窗口行为回归 |
| 4 | A4-1 + A4-3 档案包与 README | 高（信任） | S–M | 导出通道真机验证 |
| 5 | A1-3 让位/降帧 | 中高（性能与不打扰） | S–M | 前台检测能力评估 |
| 6 | A3-5 凭据存储 | 高（安全） | S（短期）/L（长期） | 依赖审批 |

---

## 6. 风险清单

| # | 风险 | 触发条件 | 影响 | 缓解 | 证据 |
|---|---|---|---|---|---|
| R1 | 置顶摆件被视为打扰而卸载 | 新手不知如何退出 | 首周流失 | 三路径退出 + 首次告知 + 默认静音 | Goose 评论第一问 |
| R2 | 三档尺寸引发布局/DPI 回归 | 125%/150% 缩放、双屏 | 窗口卡死小尺寸 | 回归矩阵 + 复用 D-019 修复 | Shimeji「Proper DPI scaling」 |
| R3 | 预设 URL 失效 | 服务商改版/自定义端口 | 自检全失败 | 写明「以服务商文档为准」+ 可改 | Synology 端口可自定义 |
| R4 | 2FA 用户被误判为密码错 | 未用应用专用密码 | 以为产品坏了 | 401 文案点名 2FA 与专用密码 | Nextcloud 官方建议 / RS #1128 |
| R5 | 密码含特殊字符 → 401 | 用户自设密码 | 难排查 | 提示生成不含特殊字符的专用密码 | RS #987 |
| R6 | 自检按钮随重构腐化 | 同步层升级 | 自检失效且误导 | 自检进 vitest 回归 | Joplin #14030 |
| R7 | 明文凭据被发现 | 任意时刻 | 损伤「数据主权」叙事 | 诚实说明 + 不保存选项 + 长期凭据库 | localStorage 事实 |
| R8 | 档案包在 Tauri 侧写盘失败 | 导出通道未真机验证 | 导出看似成功实则空 | 导出后回读校验 + 真机验收 | 仓库审计「待验证」§1 |
| R9 | 档案包体积失控 | PNG 全量导出 | 耗时/磁盘不足 | 体积预估 + 进度反馈 + 可选只导 JSON | Apple Health 800MB（第三方） |
| R10 | 预设写死第三方 URL | 引入未验证的服务商地址 | 用户按错地址 | 只放已验证形态，其余标未验证 | 本文 §1.6 / §2.3 |
| R11 | 照搬 Windows 小组件交互 | 把摆件做成面板 | 失去「桌面展示架」定位 | 明确物件 ≠ 面板 | Microsoft Learn |
| R12 | 只做尺寸不做让位 | 只交付三档 | 性能与打扰抱怨并存 | 让位与尺寸同期验收 | WE 暂停/规则范式 |

---

## 7. 来源索引

> 全部链接已于 **2026-11-10** 访问；正文内联链接即完整清单，此处只按主题归组便于复核。

- **桌面常驻 / 小组件**：NekoTrak 商店页 / AppDetails API / EULA；Finch Widget 帮助、Plus 定价、iTunes Lookup 与评论 RSS；Shimeji 官网与 fork README；Desktop Goose itch.io；Wallpaper Engine 商店页 / API / 官方帮助四页（游戏暂停、应用规则、焦点丢失、GPU）；Apple HIG Widgets；Wikipedia macOS Sonoma；Microsoft Learn Widgets 与微软支持页；Apple 支持 108779。
- **WebDAV / 凭据**：Joplin 的 Nextcloud 与 WebDAV 文档、issue #14030、PR #14031；Nextcloud 用户手册 WebDAV；rclone WebDAV 与 check 文档；Remotely Save README 与 issue #1128 / #987 / #1158；Synology KB WebDAV 教程。
- **数据导出 / 档案**：Spotify 数据权利帮助页；Strava 导出帮助页；Obsidian 数据存储与 vault 文档；gdpr-info Art.20；Apple Health 导出结构（第三方 healthlog 文档）。
- **仓库内依据**：README.md、design/AESTHETIC.md、design/VOICE.md、src/components/MiniDeskToy.tsx、src/App.tsx（toggleMini）、src/sync/{types,useSync,webdav}.ts、src/storage/backups.ts、src/platform/http.ts、src/i18n/locales/zh.ts、design/records/D-20261110-048-decisions-and-f4-http.md、docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md。

---

## 附录 A：方法与限制

- **取样**：官方商店页 / 官方 API（Steam AppDetails、iTunes Lookup 与 RSS）/ 官方帮助中心 / 官方设计文档 / 官方仓库 issue；页面正文抓取失败时用公共阅读代理取正文，并在正文标注「未完整抓取」。
- **失败与缺口**：Steam 用户评论文本接口与社区评价页返回登录页或空壳；Apple 支持页与使用指南正文受页面体积截断；Synology 与 WE 帮助站为前端渲染，需经阅读代理；国内服务商（如坚果云）WebDAV 官方文档本次未取得。
- **数字口径**：价格取美国区；评分取 2026-11-10 时点；评论引用是**定性证据**，不代表总体分布。
- **事实与判断分离**：逐条标注「官方宣称 / 可验证事实 / 我的判断」；未验证项一律写明「未验证」，不用推断替代。

## 附录 B：与仓库现状的对照

| 能力 | 仓库现状（2026-11-10） |
|---|---|
| 迷你摆件与置顶 | 已有：MiniDeskToy.tsx + toggleMini（260×380、强制置顶、退出写回设置） |
| 摆件三档尺寸 | **缺**：固定 260×380，无尺寸偏好字段 |
| WebDAV 原生 HTTP | 已有：src/platform/http.ts（D-048） |
| WebDAV 错误码 | 已有 8 类；**缺**连接自检与 2FA/证书分支文案 |
| WebDAV 预设 | **缺** |
| 凭据存储 | 明文 localStorage；**缺**说明与不保存选项 |
| 备份/恢复/打开目录 | 已有：backups.ts（手动 5 份、自动 5 份、损坏兜底） |
| 档案包（README/PNG/校验和） | **缺** |
| 诊断包导出 | 已有（仅本机生成） |
| 过期文案（cors） | **待修**：zh.ts 与 D-048 冲突 |

---

*本文为证据输入，不替代设计记录，也不构成实施批准。*
