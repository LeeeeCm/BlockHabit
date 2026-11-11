# CHANGELOG

本项目遵循「每次改动都能追到一条设计记录」的约定：每条变更下方的 `D-YYYYMMDD-NNN` 指向
`design/records/` 里对应的记录（含背景、方案、取舍与验收证据）。

## [未发布] — 2026-11-11（第十轮：人类批准项落地 —— 自由装饰模式 / 内容包 v3 / 手动检查更新）

人类确认「批准所有内容，继续完成，合并 main」后，本轮把此前 blocked 的三项全部落地：
D-20261111-068（自由装饰模式）与 D-20261111-069（手动检查更新）改为 approved，
新增 approved 记录 D-20261111-070（内容包 v3）。**版本号仍 0.2.0；不 push、不打 tag。**

### C1 自由装饰模式（D-20261111-068 approved）

- 全落成（`completedBlueprintIds` 覆盖 `blueprintOrder` 全部；数量动态，当前 23）后展台出现「装饰模式」开关（默认关）。
- 会话内 90° 象限旋转：整数格点旋转 + bbox 归一化，宽深互换；旋转前校验不出界/不与其它模型（按其会话旋转）重叠，非法不应用并 toast 还原。
- 「换一组植被」：`drawEcoProps` 增加可选 seed（默认 0 与旧实现逐像素一致），装饰模式下用 mulberry32 在 margin 环带内确定性重排。
- 旋转/植被/选中只存在 React state：**不写存档、不改 settings、不改 schema**；退出装饰或重开复原；jsdom 断言操作前后 `exportData()` 深度相等，浏览器断言 localStorage 逐字节不变。
- 复用 `ShowcasePlacements`/现有模型与视觉令牌；旋转按钮移动端 44×44；四主题 zh/en 截图与 reduced-motion 验证通过。
- 测试：logic/showcase 21、render/showcaseLayout 20、pages/Showcase 6；`rotations={}` 与旧调用完全一致（回归断言）。
- 已知限制：store 侧落位二次校验仍按基础 footprint（旋转仅会话态，不扩大 store 接口），极端拖拽会回弹，无数据损坏。

### C3 内容包 v3（D-20261111-070 approved，CONTENT_VERSION=3）

- 新增 5 座免费扩展蓝图（追加在既有 18 座之后，既有 18 座几何/顺序/块数/色值零改动，FNV 指纹锁定）：
  街角面包房 bakery 98 / 旧书店 bookshop 104 / 邮政所 postoffice 92 / 消防站 firestation 112 / 水塔 watertower 94，
  合计 500 块；全量 **23 座 / 2485 块**。
- 新 5 座全部复用既有批准 24 色材质调色板（无新 hex），每座 7–8 色 / 4–5 材质家族 / accent ≥ 8%；`generatorsV3.ts` 承载 5 个 make*（`generators.ts` 671 行零改动）。
- `CONTENT_VERSION=3`；新增 `CONTENT_PACK_V3_IDS` 与 `city-life-2` pack；`BASE_PACK_IDS` 同时排除 v2+v3（基础包仍恰 12 座/1385 块）。
- 兼容矩阵随版本升级：旧 v2 档读入升 3、未来 v4 needsUpgrade（raw 不变/同步 0 请求/导入拒绝）、merge 取高不写低；三处白名单与 archive `appContentVersion` 自动跟随。
- 图鉴 23 卡 / 容量 23 / 建造·展台·年鉴·档案·关于页数字全部动态；内容包测试 29 例、独立 `.tmp-c3/data-check.mjs` 141 断言 PASS；浏览器四主题 zh/en 23 卡、新座建造正常、0 page error。

### C4 手动检查更新 + updater 骨架（D-20261111-069 approved）

- 新增依赖 `@tauri-apps/plugin-updater@2.14.1` / `@tauri-apps/plugin-process@2.4.0` 与 Rust `tauri-plugin-updater` / `tauri-plugin-process`，lib.rs 注册、capabilities 授权、`plugins.updater` 占位（空 pubkey/endpoints，`installMode: passive`，未开 `createUpdaterArtifacts`）。
- 新增 `src/platform/updater.ts`：`isUpdaterEnabled()`（`VITE_UPDATER_ENABLED=1` 且 Tauri 运行时）、`checkForUpdate()` 四态、`installUpdate()`、`discardPendingUpdate()`，插件按需动态 import。
- 设置 → 内容路线新增「版本与更新」行：idle/checking/已是最新/发现新版本/失败；**默认构建安全禁用并如实说明「发布链路尚未启用」**；只有用户点击才联网；取消只忽略迟到结果（插件无 abort API，不误报失败）。
- 单测 19 例（updater 10 + AboutPanel 9）含「默认构建不 import 插件/不发请求」；`npm run tauri build -- --no-bundle` 成功（Rust 2m17s）。
- **仍 blocked（需人类提供）**：签名密钥生成与保管、发布端点 URL、`latest.json` 托管、CI release secrets、`createUpdaterArtifacts` 开启、Windows Authenticode（可选）、启用前 Rust `on_before_exit` 存档握手；keyring 仍为设计+迁移方案（未接依赖、未改存储格式）。

### 文档与验证

- README：23 座 / 2485 块、contentVersion=3、自由装饰模式、版本与更新说明；SURFACES：展台装饰模式、图鉴动态卡数、设置页「版本与更新」行。
- docs/release：内容包 v3 评估更新为已实施；自动更新评估更新实施状态与 blocked 清单；真机验收清单补 T7 装饰模式与更新项。
- 设计记录：D-068/D-069 approved + 履历、新增 D-070 approved；台账 70 条通过。
- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` **104 文件 / 1090 用例全绿**；`npm run design:check` **70 条记录通过**；`npm run format:check`、`npm run check:versions` 通过；`npm run build` 成功（主入口 426.10KB / gzip 130.28KB，新增内容与更新入口 +11.5KB raw/+2.8KB gzip，无新运行时依赖除已批准的 updater/process）。
- 第十轮独立 verifier：**PASS**（P0=0；P1=1 设计台账未提交 → 随第十轮 docs 提交消除；P2=2 已修复：更新失败详情脱敏可复制 / 内联 lang 三元改映射表；P3=6 记录为已知限制，见发布报告 §6）。verifier 亲测 tsc 0、104/1090、design 70、build 425.82/130.22、tauri build exit 0、内容包独立脚本 23/2485 + 旧 18 座 0 mismatch、浏览器四主题/移动端/装饰/更新禁用态 0 page error。
- `npm run tauri build -- --no-bundle` 成功（含 updater/process 插件）。
- 已以 `--no-ff` 将 `chore/release-prep` 合并到 `main`（merge commit 8f85837，不 push、不打 tag）；随后 `4a4dfcb` 增加 `.gitattributes` 统一文本 LF，修复 Windows 检出 CRLF 导致 `design:check`/Prettier 在 main 工作区失败的问题。

## [未发布] — 2026-11-11（第九轮补充：C4 零依赖项 + C3 内容包脚手架 + D-069）

在第九轮发布候选基础上，继续推进「依赖与人类决策之前就能做」的零依赖收尾。**未新增依赖、未生产内容、未改视觉语言/存储格式/版本号。**

### C4 自动更新/签名/keyring（零依赖部分，2a87fb1）

- 新增 `scripts/check-versions.mjs`：校验 package.json / tauri.conf.json / Cargo.toml `[package].version` 三处一致（`--json` 可机读），`npm run check:versions` 已接入 CI（Version consistency 步骤）；`scripts/check-versions.test.mjs` 6 例覆盖一致/不一致/缺失/Cargo 解析边界。**未生成签名密钥、未改发布链路。**
- 新增设计记录 **D-20261111-069（proposed）**「手动检查更新入口」：版本与更新行、idle/checking/up-to-date/available/error 状态机、无自动检查/无静默下载、未启用发布链路时诚实禁用；依赖/签名/端点获批后再实现，本轮不写实现代码。
- keyring 维持「rememberPassword 不落盘（B1 已实现）；OS keychain 需人类批准 Rust 依赖」。

### C3 下一批内容包脚手架（2f30844）

- 新增 `src/logic/blueprints/contentPackKit.ts`：`validateContentPackDraft`（id 唯一、version=nextContentVersion、蓝图必须追加、座数 4–6、每座 80–120 块、整包 400–600 块，规则可覆盖）、`planAppendedOrder` / `packBlockCount` / `existingPackBlueprintIds` / `nextContentVersion`；纯函数、可注入合成注册表。
- `contentPackKit.test.ts` 12 例（含真实注册表 18 座/1985 块断言）。**未生产任何建筑数据、未改 generators.ts、未改 CONTENT_VERSION**；内容主题/规模仍待人类确认。

### 验证（2026-11-11 续作）

- `npx tsc --noEmit` 0 错；`npm test` **102 文件 / 1008 用例全绿**（新增 2 个测试文件 18 例）；`npm run design:check` **69 条记录通过**（新增 D-069）；`npm run format:check`、`npm run check:versions` 通过；`npm run build` 成功（主入口仍 414.61KB / gzip 127.44KB——脚手架未被运行路径引用）。
- 独立 verifier 结论（前 20 条提交）仍适用；上述续作改动为纯增量、不触碰运行路径，门禁已复跑。
- 仍 blocked：C1（D-068 待审核）、C4 依赖/签名/端点/密钥、C3 内容主题与规模确认、C6 真机验收。

## [未发布] — 2026-11-11（第九轮：Git 整理 + B 类技术收尾 + C 类发布增强 → 发布候选）

本轮按用户目标做三件事：先把历轮未提交成果整理成可回滚的 Git 基线（任务 A），再完成 B1–B6
技术收尾，最后完成 C1–C6 产品/发布增强。**不改版本号、不新增依赖、不 push、不打 tag。**

### Git 整理（任务 A）

- 在 `main` 之上新建分支 `chore/release-prep`，把工作区约 200 项改动按主题拆成 8 条基线提交：
  工程配置与设计台账 / 0.2.0 基线 / 第四轮打开动机 / Wave 1 / Wave 2 / B1 内容包 / 18 座配色 /
  CHANGELOG。跨轮次共享文件（App.tsx、SettingsDialog、i18n、storage/sync 等）无法按轮次重建
  中间态，已在对应 commit body 说明并合并提交。
- 不提交 `.tmp*`、`dist/`、`src-tauri/target/`、`node_modules`、个人截图产物；每条提交跑
  `tsc` 门禁，基线整体跑全量测试与 `design:check`；最终工作区干净（仅忽略项）。共 20 条提交
  （8 基线 + 12 收尾），未 push、未打 tag。中间提交是按主题切片的工作区快照，跨轮次共享文件
  无法重建独立中间态，**单条中间提交不保证单独可编译**（已在各 commit body 说明）；回滚方式为
  按序列反向 revert 或以分支整体回退。

### B 类技术收尾

- **B1 A3 WebDAV**：分步自检可取消（AbortController；取消后不再发起后续阶段、仍尽力 DELETE 已创建
  的临时文件，结果区分「已取消 / 取消但清理失败」）；`rememberPassword` 开关（关闭时
  localStorage 绝不写密码、读取旧配置丢弃遗留密码，会话内存内继续可用）；密码 DOM 缓解（已保存
  密码不回填 `input.value`，placeholder 提示留空继续使用，`autoComplete=new-password`）；服务商
  切换统一单一 handler。新增 diagnose 取消 4 例、配置落盘 5 例、面板 4 例。
- **B2 A2 年鉴**：抽出 `src/render/modelStage.ts`（画报/相纸/图鉴/年鉴共用 measure+fit+painter）；
  重构前 25 张 canvas PNG sha256 全等、RGBA 逐像素 diff=0；复制 PNG 失败自动降级下载
  （`copied|downloaded|failed` 三态 + toast）；modelStage 20 例、yearbookCanvas 20 例。
- **B3 A4 档案包**：SettingsDialog 1314 → 740 行（<800），WebDAV 与档案/备份/诊断 UI 抽为
  `WebdavPanel` / `ArchiveDataPanel`（useSync 生命周期不变）；档案 manifest 语义澄清为
  `archiveFormatVersion`（格式版本=1）+ `appContentVersion`（=当前 CONTENT_VERSION），旧
  manifest 的 `contentVersion` 兼容读取；`parseArchiveManifest` 7 例；manifest 再拆
  `archiveManifest.ts`，收尾再把字节/压缩层拆到 `archiveZip.ts`：最终 archive.ts 587 行 /
  archiveManifest.ts 212 行 / archiveZip.ts 263 行（Node 行口径，均 <800）。
- **B4 B2 专注**：今日页新增专注入口条（有可开始的专注习惯且无会话时出现，移动端 ≥48px）；
  多会话展示规则（ready 优先→到点时间含延长→startedAt→id；「另有 N 个专注」副行，确认后自动
  切下一会话）；通知计划/托盘相位抽纯函数（先 `markNotified` 落盘再通知、tooltip 可单测）；
  修「延长后今日页提前待确认」并补 4 例 fake-timers 回归。
- **B5 B3 建筑档案**：移动端接 BottomSheet（嵌套拍立得 z-index 分层、Esc 逐层关闭）；档案舞台
  `data-testid="archive-stage"`；拍立得落成日改为 `completionDateOfBuilds`（=max(placedAt)
  本地日期，与 D-065 同口径；无有效日期显示「不可考」，修掉原来的 UTC+今天错误）；100+ 块
  性能实测（打开 40–45ms、切换 p95 ≤10.7ms、滚动 0 超帧、PNG 15–17ms）。
- **B6 工程卫生**：vitest 排除 `**/.tmp-*/**`（`npm test` 只跑源码测试）；`.prettierignore`
  忽略 `.tmp*`；`format:check` 通过；修正 ShowcaseScene / generators.ts 过期块数注释。

### C 类产品/发布增强

- **C2 内容路线/关于**：设置页新增「内容路线」分组（默认折叠）——动态展示 18 座 / 1985 块 /
  contentVersion 2、年度免费扩建节奏、跨设备升级说明、本地优先承诺；zh/en 齐全，不写死未来
  内容包日期。新增 AboutPanel 3 例。
- **C1 自由装饰模式**：新增设计记录 **D-20261111-068（proposed，reviewer=pending）**，按最小方案
  设计（全落成后展台解锁，复用 ShowcasePlacements/现有模型自由摆位 + 90° 旋转 + 微生态，不新增
  持久化字段、不做沙盒经济）。**按 AGENTS.md 新机制需人类确认，本轮明确暂停、不写实现代码。**
- **C4 自动更新/签名/keyring**：`docs/release/updater-and-keyring-assessment.md` —— 现状事实、
  Tauri updater 机制与签名密钥/发布端点分步方案、更正「updater 签名 ≠ Windows 代码签名」口径、
  keyring 迁移/回滚方案；需人类批准的依赖/密钥/端点/证书均标 blocked，**未装依赖、未生成密钥、
  未改存储格式**。
- **C3 下一批内容包**：`docs/release/content-pack-v3-assessment.md` —— 不生产内容、不改
  CONTENT_VERSION；给出 5 座/约 500 块/每年一批建议、脚手架改动点（含 BASE_PACK_IDS 推导坑）、
  发布门禁与兼容矩阵；主题/规模等待人类确认。
- **C5 性能基线复测**：首屏 FCP 148–168ms（基线 144ms，+3%~17% 噪声；gzip 主包 +2.4KB）、
  切页 5.9–10.8ms（0 chunk/0 long task）、建造 190 块 p95 3.6–3.8ms（0 超帧）、展台拖拽
  p95 4.0ms、图鉴 18 缩略图首开 40.2ms、展台 18 座 p95 3.7ms、年鉴打开 60.5ms/PNG 导出 49.6ms；
  全部在帧预算内，无功能性回退（详见 `.tmp-c5/report.md`，不提交产物）。
- **C6 真机验收清单**：`docs/release/real-device-acceptance.md` —— 多屏/HiDPI/拖拽双击、A4 真实
  落盘/reveal、A3 真实 Nextcloud/坚果云/群晖、B2 真实 25 分钟+系统通知+托盘、B3 100 块时间线；
  每项列「操作步骤 + 期望结果 + 本机自动化证据」，真机项交人类执行。

### 验证

- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` **100 文件 / 990 用例全绿**（全部源码测试；
  2 个历史 `.tmp-verify-a2` 验证脚本已移出匹配范围）；`npm run design:check` **68 条记录通过**
  （含 D-068 proposed）；`npm run format:check` 通过；`npm run build` 成功。
- 构建：主入口 414.61KB（gzip 127.44KB，较上轮 405.40/125.08 +1.9%，来自设置面板拆分与内容路线
  UI，无新依赖）；MiniDeskToy 懒加载 13.45KB（gzip 3.48KB）；CSS 252.17KB（gzip 108.68KB）。
- `npm run tauri build -- --no-bundle` 成功（release exe，Rust 编译 1m36s）。
- B/C 期间浏览器验证：四主题 × zh/en（设置各面板、今日专注入口、摆件三档、档案卡移动端、
  年鉴/拍立得日期）、0 console error；证据在各 `.tmp-b*/shots`。
- 独立 verifier 验证（本轮收尾）：**PASS，P0=0 / P1=0，P2=2 已处置，P3=3 已修正/记录**。verifier
  亲自复跑门禁（100 文件 / 990 用例、68 条记录、tsc 0、format 通过、构建 414.61/127.44）与浏览器
  核验（seed 密码后 input.value 为空且 DOM 无密码、rememberPassword=不记住后 localStorage 无密码、
  今日专注入口四主题、移动端档案 BottomSheet + 嵌套拍立得 Esc 分层、拍立得落成日=max(placedAt)、
  0 console error），并核对 Git/记录卫生（无 tag/remote/stash、版本未变、ls-tree 无禁止路径、6 条
  旧记录仅追加履历、D-068 proposed 已登记）。P2-2 行数口径已处置（见 B3 条目）；P2-1「单条中间
  提交不可编译」为跨轮次主题切片的已知限制（见任务 A 说明），不阻断 HEAD，回滚按序列反向 revert。
  报告 `.tmp-verify-final/report.md`（不提交产物）。

## [未发布] — 2026-11-11（第八轮：18 座蓝图逐座色彩设计）

本轮按人类要求「每一个蓝图都要有颜色设计」，建立材质调色板并逐座检查 18 个模型；不改几何/块数/顺序，不新增色相。

### 色彩系统（D-20261111-067）

- 固定材质调色板：石/浅/木土/暖光/冷光/生命/信号七族，全部复用仓库既有 hex；每座在 `palette.ts` 声明角色→色值，`palette.test` 验证角色实际出现、≥3 色、跨 ≥2 家族、非中性 accent 占比 ≥ 8%（按座微调）。 *D-20261111-067*
- 6 座灰阶模型补齐材质色：灯塔白塔/红条/蓝灯室、工厂红砖/石烟囱/暖窗、方尖碑沙岩/黄铜顶、金字塔双层沙岩/金尖、机甲分件红胸甲/蓝眼/红天线、城堡灰石/红陶塔顶/暖窗。 *D-20261111-067*
- 扩展 6 座强化识别：树屋绿树冠+露台花池、温室红陶基座/顶脊+绿植槽、钟楼红陶尖顶+黄铜钟、石桥木桥面+黄铜灯、天文台铜绿穹顶、图书馆红砖墙+暖窗+黄铜门灯。 *D-20261111-067*
- 逐座 contact sheet（18 座大图）检查、四主题与 zh/en 渲染回归；基础 12 座几何/块数/顺序与 git HEAD 逐块一致，仅颜色变化；扩展包块数 treehouse 119 / bridge 101，全量 18 座 1985 块。 *D-20261111-067*

### 验证

- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` 94 文件 / 913 用例全绿；`npm run design:check` 67 条通过；`npm run tauri build -- --no-bundle` 成功（release exe 1m40s）。
- 构建：主入口 405.40KB（gzip 125.08KB），MiniDeskToy 懒加载 12.80KB（gzip 3.40KB）；CSS 252.17KB（gzip 108.68KB）。
- 独立验证（verifier / `task-25`）：**PASS，P0/P1/P2=0**；18 座 palette 13/13、旧 12 座与 HEAD 逐块几何一致、新 6 座 1985 总数、contact sheet 逐座可辨识、图鉴四主题 zh/en 与建造/展台/档案渲染正常、0 console error；P3 为口径/环境边界（ART 已校正 accent 口径、记录已补实际最小 9.5%、火箭红翼例外、Tauri 真机未测）。报告 `.tmp-verify-color/report.md`。
## [未发布] — 2026-11-10（第七轮：B1 技术前置 — 内容版本门 + 兼容矩阵）

本轮只做 B1 的数据安全前置，不生产内容、不改定价；避免旧客户端/同步在未知蓝图出现时静默丢数据。

### 内容版本门

- 新增 `src/logic/blueprints/manifest.ts`：`CONTENT_VERSION=1`、base 内容包清单（与 `blueprintOrder` 一致）、版本归一化与「未来版本」判断。 *D-20261110-063*
- `AppState.contentVersion` 为可选字段，独立于 `schemaVersion`：缺省视为 1；追加内容包时只 +1，不升 schemaVersion。 *D-20261110-063*
- 读取门禁在 sanitize **之前**：本地加载遇到更高内容版本 → `needsUpgrade`（挂起持久化、提示升级，未知 blueprint 不清洗不落盘）；导入/远程同步同样拒绝，不覆盖远端。 *D-20261110-063*
- 三处存档白名单接通 `contentVersion`（持久化 / 导出 / 同步），复用唯一 `serializeState`；`mergeAppState` 取双方较高值，避免旧端把内容版本写低。 *D-20261110-063*

### 扩展内容包（B1 本体）

- 新增 6 座免费扩展蓝图（追加在基础 12 座之后，不改既有建筑数据）：林间树屋 115 / 玻璃温室 83 / 钟楼 99 / 石拱桥 99 / 山顶天文台 90 / 旧图书馆 108，共 594 块；全量 18 座 1979 块（后续色彩阶段 treehouse +4、bridge +2，最终 600 / 1985）。 *D-20261110-063*
- `CONTENT_VERSION` 升 2，manifest 增加 v2 内容包清单；图鉴/建造/容量/展台/年鉴/建筑档案全部沿用动态总数（18），旧 12 座顺序与块数零改动。 *D-20261110-063*
- 图鉴锁定态改为灰阶剪影（只用 `--ink` 透明度派生，忽略建筑自定义色），名字与「待解锁」保持可读；完成 12 座后自动解锁新包第一座，其余按顺序。 *D-20261110-063*
- 新增内容测试 16 例：两包版本/并集顺序、基础 12 座零改动、v2 每座 40–120 块、坐标唯一、无完全悬空、装饰上限、解锁顺序；总计 93 文件 / 904 用例全绿。 *D-20261110-063*

### 验证

- 新增兼容矩阵测试：旧档补写版本、未来档 needsUpgrade + 原存档字节不变、导入拒绝、双端同步 PUT=0、merge max、内容 manifest 与 18 座蓝图一致性。
- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` 93 文件 / 905 用例全绿；`npm run design:check` 66 条通过；`npm run tauri build -- --no-bundle` 成功（release exe 1m06s）。
- 构建：主入口 403.84KB（gzip 124.79KB），MiniDeskToy 懒加载 12.80KB（gzip 3.40KB）；CSS 252.17KB（gzip 108.68KB）。
- 独立验证（verifier / `task-21`）：**PASS，P0/P1/P2=0**；旧 12 座逐块与 HEAD 一致、新 6 座 594 块、18 卡/容量/展台/年鉴/B3 全动态、旧档补写 2、未来 v3 needsUpgrade/raw 不变/同步 PUT=0。修复其 P3①「显式 contentVersion=1 保存后仍写 1」→ 读档/保存统一升到当前版本。
- 聚焦复验（`task-22`）：**PASS，P0/P1/P2=0**；显式 v1 读档→2、保存/导出/导入均 2、无字段旧档→2、未来 v3 仍 needsUpgrade+raw 逐字节不变+同步 0 请求；merge 双端显式旧版本也至少写当前版本；报告 `.tmp-verify-b1-fix/report.md`。
- 独立验证（verifier / `task-18`）：**PASS，P0/P1/P2=0**；浏览器 14/14（future contentVersion 本地加载 needsUpgrade 且 raw 逐字节不变、sanitize 前拦截、同步 PUT=0、旧档补写 1、merge max、manifest 与 blueprintOrder 一致），3 个 P3 为文档/环境边界。报告 `.tmp-verify-b1/report.md`。
## [未发布] — 2026-11-10（第六轮：Wave 2 — 数据主权 / 编年史 / 专注陪伴）

本轮实现 Wave 2 三项（D-062 / D-065 / D-064），仍在既有定位与视觉语言内，不新增字段与依赖；记录保持 `proposed`，待人工审核。

### 数据主权（A4）

- 设置 → 数据安全新增「完整档案包」：生成 README + manifest + 数据 JSON + checksums + 已落成建筑透明 PNG（640×640），桌面写入 `appDataDir/exports/…`（tmp→rename、失败清理、同名 -2、revealItemInDir 打开）；浏览器下载单 ZIP（无依赖 STORE+CRC32，DEFLATE 可选降级）。 *D-20261110-062*
- 档案内 `state.json` 必须经 `prepareImport` round-trip、manifest/checksums/文件三者一致、全包不含 WebDAV 凭据；导出有进度/取消/并发闸。 *D-20261110-062*

### 编年史（B3）

- 图鉴已落成建筑新增「档案」入口：落成日 = `max(placedAt)`、第 N 座按落成时间、耗时天数、投入最多习惯（`fromHabitId`）、全勤/奖励块、关键块时间线（首/25/50/75/末，可展开当天随笔与心境）、铭言内联编辑、拍立得与保存档案卡 PNG（1280×1760）。 *D-20261110-065*
- 零新字段、旧档缺失日期显示「不可考」；保留图鉴原「点卡片=选择蓝图」交互，零回归。 *D-20261110-065*

### 专注陪伴（B2）

- 专注会话持久化到设备本地 `blockhabit.focusSessions.v1`（绝对时间，重开恢复 ready）；摆件三档专注面板：倒计时 + 静态环形 + [确认落块] / [再等 5 分钟]（最多 2 次）/ [放弃]（二次确认）。 *D-20261110-064*
- 到点仅进 ready，确认才 `checkIn(actualMinutes)`；`notifiedAt` 先落盘再通知，重启不重复；托盘 tooltip 仅相位变化更新；无监控/阻断/自动完成。 *D-20261110-064*
- 今日页与摆件延长同步：`HabitRow` 用有效 `session.targetMs` 判断 running/ended。

### 验证

- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` 89 文件 / 841 用例全绿；`npm run design:check` 66 条通过；`npm run tauri build -- --no-bundle` 成功（release exe 1m50s）。
- 构建：主入口 399.78KB（gzip 123.78KB），MiniDeskToy 懒加载 12.80KB（gzip 3.40KB）；CSS 252.17KB（gzip 108.68KB）；Tauri release exe 构建通过。
- 独立验证（verifier，`task-17`）：**PASS，P0/P1/P2=0**；A4 浏览器 ZIP 8/8 校验（CRC/manifest/checksums/sha256、state round-trip 214 builds、透明 640×640 RGBA、无密码）、B3 浏览器 9/9（落成日/ordinal 不依赖数组顺序/关键块 5 锚点/PNG 1280×1760/嵌套 Esc）、B2 逻辑与摆件状态（ready 不自动完成/确认落卡/放弃无打卡/延长同步）。剩余 6 项 P3 为记录 files 偏差（已校正）与桌面真机/长时计时/性能环境限制。报告 `.tmp-verify-wave2/report.md`。
## [未发布] — 2026-11-10（第五轮：把差异化做出来 — 摆件三档 / 落成年鉴 / WebDAV 自检）

本轮实现 Wave 0 既有缺陷修复与 Wave 1 三条创新项（D-059 / D-060 / D-061），设计记录仍为 `proposed`，待人工审核。

### 桌面存在感（A1）

- 迷你摆件三档：口袋 220×150（3D + 进度 + 1 个快捷打卡）、标准 280×400（默认，3D + 3 个快捷打卡）、展台 420×560（3D + 今日清单）；双击标题展开主窗，关闭 = 先恢复主窗再收托盘。 *D-20261110-059*
- 置顶改为设置项（默认**关**），设置页可选尺寸与置顶；进入摆件前显式 `setMinSize` 再 `setSize`，退出恢复主窗尺寸/位置并把最小尺寸还原为 900×600；位置存设备本地 `blockhabit.windowLayout.v1`，按当前显示器工作区钳制；新增 capability `set-min-size` / `set-position`。 *D-20261110-059*
- 摆件头部按钮命中区统一 32px；浏览器预览按预设尺寸居中模拟三档视觉，Tauri 下铺满真实窗口。 *D-20261110-059*

### 长期故事（A2）

- 落成年鉴：统计页「年鉴」入口，按年生成竖版 720×1200@2x 画布（总览 7 项、12 个月热图、建筑年表、时间形状、当年一句），年份切换、保存/复制 PNG、导出可独立阅读的 Markdown；空年份诚实空态；完全本地生成、零新字段、排除墓碑。 *D-20261110-060*

### 数据主权（A3）

- WebDAV 服务商预设：Nextcloud / 坚果云 / 群晖 / 通用，按用户名重建 DAV 端点；应用专用密码提示；「测试连接」为独立分步自检（地址 → 连接 → 认证 → 读写 → 清理），临时文件 PUT→GET→DELETE，失败后指出阶段与建议（401 点名应用密码、证书/目录/目录不存在等），写路径不触发同步合并；结果全量脱敏，可复制错误详情；浏览器预览明确提示需在桌面端运行。 *D-20261110-061*

### Wave 0 既有缺陷修复

- 抽出唯一存档字段白名单 `src/store/serializeState.ts`，持久化、导出、WebDAV 推送共用：修复 `repairBrickMonth` 未进持久化/同步导致的「重启重复发月度修复砖额度」。
- `openDataDir()` 改用 `revealItemInDir`（`opener:default` 内），避免未授权 `openPath` 导致的静默失败；对应测试更新。
- zh/en CORS 文案改为「桌面端已走原生 HTTP；浏览器预览受跨域限制」，不再声称直连通道开发中。

### 验证

- Lead 门禁：`npx tsc --noEmit` 0 错；`npm test` 86 文件 / 764 用例全绿（源码自带 84/744，另含 `.tmp-verify-*` 独立验证 20 例）；`npm run design:check` 66 条通过；`npm run tauri build -- --no-bundle` 成功。
- 独立验证（verifier / guide-impl）：A2 PASS（P0/P1=0，2 个 P2 已修）；Wave 1 有条件通过（P0/P1=0，2 个 P2 已修，A3 剩余 P3 记录为 follow-up）；Wave 0 3/3 PASS。
- 构建：主入口 354.35KB（gzip 108.60KB），MiniDeskToy 懒加载 5.17KB（gzip 1.85KB）；CSS 252.17KB（gzip 108.68KB）；Tauri release exe 构建通过。
- 浏览器实测截图：摆件三档/暗色 `.tmp-a1/`；年鉴 light/dark/oat/fog × zh、en、2025、空态 `.tmp-a2/`；WebDAV 预设/回填/浏览器提示 `.tmp-a3/`。
## [未发布] — 2026-11-10（第四轮：让用户愿意每天打开的桌面习惯应用）

本轮在「定位与美术风格不变」前提下，补上打开动机、可发现性与启动流畅度，并产出竞品与差异化策略。设计记录：D-20261110-052 … -058（均待人工审核）。

### 打开动机（F 批续）

- 今日简报：问候语 + 今日完成/剩余 + 当前蓝图还差多少块落成；「开始第一个」直接滚动定位第一件未完成习惯并脉冲高亮。 *D-20261110-052*
- 首启空态新增 5 个一键模板（喝水 / 阅读 / 走动 / 早睡 / 记账），点一下创建每日瞬时习惯；完整表单仍保留。 *D-20261110-053*
- 晚间收尾提醒：首次打卡后一次性询问是否每天 21:00 提醒；默认关，设置页可改时间；全局提醒关闭时不触发，每天最多一次，只陈述「还有 N 件没落块」；系统通知权限在用户点「开启」的当下申请。 *D-20261110-055*
- 简报 CTA 在分类筛选下只指向当前可见的第一件未完成习惯（筛选内没有未完成则隐藏按钮），不会出现点了没反应；`prefers-reduced-motion` 下滚动为瞬时。 *D-20261110-052*
- endgame：全部蓝图落成后简报不再回绕提示「下一座」（已建成蓝图会被跳过）。 *D-20261110-052*

### 可发现性

- 建造 / 展台 / 统计首次进入各给一条可关闭的用法提示（滚轮缩放与拖拽、点击建筑看相纸、热图灰阶含义），设置页「实验室 → 页面提示 → 重看页面提示」可重新出现；tab 按钮补 1–4 快捷键提示。 *D-20261110-054*

### 启动与流畅

- 水合门：读档完成前不再渲染首启空态，消除「空态一闪 → 真实习惯」。页面懒加载经实测（首切 ~300ms 的 Suspense 延迟提交空白，见 `.tmp-perf/report.md`）后回退为静态 import，切页恢复即时；仅迷你摆件保留懒加载（3.4KB，不再拖累首屏）。 *D-20261110-056*
- 渲染性能实测：建造 190 块入场级联 P95 3.4ms、>16.7ms 帧 0、long task 0；静止时零重绘；展台拖拽单次 pointermove 0.43ms；prod 冷加载 FCP 144ms；DPR 上限 2 生效。结论：**基线达标，不改渲染层**（报告与 24 张像素零差异证据：`.tmp-perf/report.md`）。 *D-20261110-057*

### 产品策略

- 竞品与差异化文档：15 个应用横向对比、34 条来源、10 条差异化建议（现在就能做 / 需要设计轮 / 明确不做）。 *D-20261110-058*

### 验证

- 独立验证结论：0 个 P0/P1/P2 缺陷，7 项 P3 全部收敛；功能主路径、四主题 × 双语、600×700、reduced-motion、键盘、水合门、生产 preview 全过；24 张渲染基线截图逐像素 0 差异（22,118,400 px）；最终产物首次切页 11.5 / 9.7 / 23.2ms（二次 5.4/3.9/14.1ms），主 chunk 309.14KB（gzip 94.86KB），212 文件 / 5.45MB。报告 `.tmp-verify-round/report.md`。 *D-20261110-056 / -057*
## [0.2.0] — 2026-11-10

本轮是「定位与美术风格不变」前提下的系统优化，分六批推进；完整清单见
`docs/superpowers/specs/2026-11-10-blockhabit-optimization-plan.md`。

### 数据安全（A 批）

- 读档失败不再被当成「没有存档」而用空态覆盖真实存档；存档来自更高版本时挂起持久化。
- 保存串行化 + 唯一临时文件名，去掉「rename 失败就直接覆盖主档」的非原子回退。
- 存档损坏时原文备份为 `.corrupt-backup` 并明确提示；导入支持 v1 旧档迁移。
- 撤销打卡改为「与事实重建对比」，只移除真正不再满足条件的积木；删除习惯级联清理提醒与缓存。
- 蓝图容量钳制（12 座 × 蓝图块数）与修复积木「不早于习惯创建日」的下界。
- OS 关机 / 注销也走「前端 flush → 确认 → 退出」握手；迷你悬浮件关闭时先恢复窗口尺寸。 *D-20261110-019*

### 奖励回路（B 批）

- 连击里程碑（每满 7 天）掉落的积木渲染为点缀色 bonus 块，并补齐存档/合并/画报全链路。 *D-20261110-007*
- 步进型习惯的「达标 → 减档 → 再加回」不再重复产出积木。 *D-20261110-008*
- 修复积木改为宽口径：每月 2 块 + 连击每满 30 天奖励 1 块，上限 4 块，补签窗口 30 天。 *D-20261110-027*
- 统计页热图回归「灰阶点亮、全完成日满亮」（绿/蓝是第二套色相，与 A1「唯一点缀色」相抵）；绿色只保留给进度条。 *D-20261110-035*
- 全勤领取不再「无条件庆祝」：失败给具体原因，成功才播庆祝音，连击里程碑额外标注。 *D-20261110-035*

### 无障碍与视觉（C 批）

- 焦点环统一为 `--ink` 2px 外环；对话框补齐可访问名称；热图改为 roving tabindex + 方向键导航。
- 新建习惯弹窗「有未保存改动」时先确认再关闭。
- 彩色填充上的文字改用对比度令牌：6 处从 1.85–2.54:1 提升到 4.52–10.68:1（WCAG AA）。 *D-20261110-018*
- 暗色主题夜间环境光加对比度地板，积木不再与背景融为一体。 *D-20261110-017*

### 视觉纪律（D 批）

- 动效令牌收口：17 个时长字面值 + 7 种缓动 → 7 档时长 + 4 档缓动，裸值由测试拦截。 *D-20261110-026*
- 字号阶梯收口：20 档 → 8 档语义令牌（11/12/13/14/16/18/20/24），裸字号由测试拦截。 *D-20261110-028*
- 设置面板改为可折叠分组，3.6 屏 → 2.7 屏，首屏只留外观与提醒。 *D-20261110-029*
- 建造页取景改为「按已放置积木」，开荒期模型放大 1.5×。 *D-20261110-015*
- 界面内 emoji 清零；背景模糊收敛为单一令牌。 *D-20261110-025*
- 清理死 i18n 键、死 CSS、蓝图名双源等历史残留。 *D-20261110-021*
- 瞬时提示统一走 `useTransient`：修掉「连续两次提示时，第二次被第一次的计时器提前清掉」，并保证卸载后计时器归零。 *D-20261110-036*

### 体积与性能（E 批）

- 字体瘦身：移除从未被加载的 MiSans 两档字重与 Rubik 四个无用子集，安装包 **11.47 MB → 7.22 MB**（−37%），五个界面逐像素零回归。 *D-20261110-014*
  > 后续 F4 接入原生 HTTP（WebDAV 绕开 CORS）使安装包回升到 **8.53 MB / MSI 10.13 MB**，相对基线仍为 −25% / −18%；见 *D-20261110-048*。
- 展台热路径零分配化：离屏底座复用、命中检测缓存、偏移积木预计算（pointermove −23%）。 *D-20261110-016*
- 精灵缓存升级为 LRU + 24MB 字节预算，高分屏不再无上限增长。 *D-20261110-020*
- 等距渲染按职责拆为 geometry / color / cube / ground 四模块，`iso.ts` 变为 14 行 barrel；`ui.css`（1218 行）拆为 5 个按序入口（四页逐像素 0 差异）。 *D-20261110-032* / *D-20261110-033* / *D-20261110-034*
- 两个 900 行级场景组件拆分：`BuildScene` 906→786、`ShowcaseScene` 890→796（动画时间线 / 取景数学 / 读砖气泡 / 纯几何派生），两页均逐像素 0 差异。 *D-20261110-044* / *D-20261110-045*
- 生产构建分包：react / tauri / state 独立 chunk，主 chunk **497 kB → 289 kB**，消除 500 kB 告警。 *D-20261110-040*

### 产品化（F 批）

- 首启三步引导 + 第一块积木的专属说明；新建习惯表单把选填项折叠，首屏只剩 4 个控件。 *D-20261110-023* / *D-20261110-031*
- 全蓝图落成后不再静默：建造页给常驻完成态说明，今日页打卡时明确「已无新积木可掉」；无掉块的三类原因抽为纯逻辑并可单测。 *D-20261110-038* / *D-20261110-041*
- 数据主权：设置页可见备份列表、一键恢复、打开数据目录。 *D-20261110-022*
- WebDAV 跨域失败不再误报为「网络错误」，给出可执行的替代方案。 *D-20261110-024*
- 本地诊断包导出（崩溃日志 + 数据体量 + 帧率采样），纯本地不上传；提醒开启但未自启时给出提示。 *D-20261110-030*
- README 校准：修正与实现不符的表述，新增「已知限制」章节。 *D-20261110-024*
- CI：GitHub Actions 跑 `tsc --noEmit` + `npm test` + `npm run design:check`。 *D-20261110-012*

### 工程质量

- 设计中枢：`AGENTS.md` + `design/`（唯一入口）+ 追加式设计台账 + `npm run design:check` 校验；46 条实施记录可逐条追溯。
- 测试规模 **72 文件 / 604 用例**；本轮新增覆盖：积木投影与蓝图注册表、渲染数学（几何/颜色）、场景动画与取景、展台纯几何、瞬时提示。
- 测试抓到并修掉的真实缺陷：`floorContrast` 在极暗前景/背景组合下达不到契约对比度（32 → 64 步）。 *D-20261110-043*
- 端到端验证：`npm run tauri build` 通过（F4 后 NSIS 8.53 MB / MSI 10.13 MB，差异原因见 D-20261110-048）；生产包实测建造页 canvas 采样与 dev 环境一致。 *D-20261110-039* / *D-20261110-046*
- 审核入口：`design/REVIEW-QUEUE.md`（46 条记录按审核成本分组，含待决事项清单）。

## 历史版本

0.2.0 之前的版本没有单独的 CHANGELOG；实现与设计沿革可查：

- `docs/superpowers/specs/2026-08-22-blockhabit-design.md`（原始规格）
- `docs/superpowers/specs/2026-08-23-block-rendering-design.md`（积木立体渲染）
- `docs/superpowers/specs/2026-09-30-blockhabit-optimization-design.md`（上一轮优化）
- `docs/superpowers/specs/2026-10-03-blockhabit-ux-review-fixes.md`（体验评审修复）