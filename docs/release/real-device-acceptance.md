# C6 真机验收清单（Windows 桌面端）

- 日期：2026-11-11（初版）；最近更新：2026-11-15（0.2.2 发布：载荷版本、`.sha256`、T6 起点改为已发布 v0.2.1）
- 评估者：b6-release-docs（task-5）；0.2.1 / 0.2.2 更新：lead
- 用途：**发布前在真实 Windows 机器上逐项执行**。每项写明「操作步骤 / 期望结果 / 本机可自动化结果与证据」；已由自动化覆盖的项也保留真机复核（自动化不能证明 OS 窗口、系统通知、真实服务器、真实落盘）。
- 前提：使用 **release 构建的安装包**（`npm run tauri build` 产物），不是浏览器预览；验收前备份 `%APPDATA%/blockhabit*` 数据。
- 证据保存：截图/录屏/日志放到 `.tmp-b6/real-device/`（已被 `.gitignore` 忽略，不提交）；每项在 §7 记录表填结果。
- 说明：标 **自动** 的项已由 vitest/浏览器脚本覆盖；标 **真机** 的项必须人类在真实设备执行；标 **条件** 的项依赖发布链路配置（签名密钥 / 发布端点 / latest.json，见 C4 评估）。

---

## 0. 环境准备

| 项 | 要求 |
| --- | --- |
| 系统 | Windows 10/11 x64（产品唯一正式目标） |
| 显示器 | 至少一组：主屏 100% + 副屏 125%/150%（验证 HiDPI 与多屏）；另一轮用双 100% 复核 |
| 构建 | `npm ci` → `npx tsc --noEmit` → `npm test` → `npm run tauri build`；安装 NSIS 或 MSI 产物 |
| 数据 | 验收前复制一份 `%APPDATA%/blockhabit*` 备份；准备一份含 **190 块城堡**（或 100+ 块建筑）的存档用于 B3 |
| WebDAV | 三个真实账号/目录：Nextcloud（自建或托管）、坚果云、群晖；Nextcloud/坚果云需**应用专用密码**（2FA 账号） |
| 工具 | 秒表/手机计时（25 分钟项）、Fiddler/Charles（更新请求抓包）、PowerShell（`Get-FileHash` 校验） |

---

## 1. T1 Tauri 多屏 / HiDPI / 拖拽 / 双击

| 步骤 | 期望结果 |
| --- | --- |
| 1. 主窗口拖到副屏（不同缩放），再拖回；切换最大/还原 | 窗口不裁切、不越界；自定义标题栏拖动/双击最大化正常（`decorations:false`） |
| 2. 打开迷你摆件（设置→桌面摆件），拖主窗到副屏；重启应用 | 摆件位置按当前显示器工作区钳制、重开恢复（`blockhabit.windowLayout.v1`） |
| 3. 拔掉副屏/改缩放后重开 | 摆件被钳回主屏可见区域，不出现 NaN/移出屏幕 |
| 4. 展台页拖动模型：吸附网格、碰撞变红、松手落位；重启 | 磁吸正确、碰撞不落位、落位持久化；画面不模糊（DPR 变化补偿生效） |
| 5. 双击摆件标题 | 主窗口展开/恢复；摆件关闭 = 先恢复主窗再收托盘（D-059） |
| 6. 托盘：左键单击 / 右键 | 左键展开主窗；右键在光标处弹出菜单，菜单不超出屏幕（任务栏在底部时出现在点击点上方） |
| 7. 摆件三档（口袋 220×150 / 标准 280×400 / 展台 420×560）在 125%/150% 缩放下切换 | 内容不裁切、按钮命中区 ≥32px、3D 场景正常 |

**自动化覆盖/证据**：
- 自动：`src/platform/miniWindow.test.ts`（三档尺寸预算、位置钳制、布局持久化/坏 JSON 回退）；`src/render/showcaseLayout.test.ts`（画家算法/落位偏移/底座几何）；`src/render/touchGesture.test.ts`（触摸手势数学与集成）；`src/components/MiniDeskToy.test.tsx`（三档渲染、双击展开回调）。
- 本轮实测（2026-11-11 02:56）：上述文件均通过（见 §6）。
- **必须真机**：OS 多显示器工作区、DPR 跨屏变化、WebView2 实际渲染清晰度、托盘定位、窗口拖拽。自动化环境（jsdom）没有真实窗口。

---

## 2. T2 A4 真实档案包落盘 / 取消 / reveal

| 步骤 | 期望结果 |
| --- | --- |
| 1. 设置→数据安全→导出完整档案包 | 生成到 `%APPDATA%/blockhabit/exports/blockhabit-archive-<时间戳>/`；完成后自动在资源管理器定位（revealItemInDir） |
| 2. 检查产物 | 含 `README.md`、`manifest.json`、`data/state.json`、`data/checksums.txt`、`buildings/*.png`（透明 640×640）；manifest 与 checksums 的 bytes/sha256 对得上 |
| 3. PowerShell 校验 | `Get-FileHash <文件> -Algorithm SHA256` 与 `checksums.txt` 一致 |
| 4. 用 `data/state.json` 导入 | `prepareImport` round-trip 通过，数据与导出前一致（含设置/展台/档案） |
| 5. 导出中途点「取消」 | 返回 cancelled；**不留下 `.tmp-archive-*` 半成品**；已有档案不受影响 |
| 6. 目标目录只读/磁盘满（可模拟） | 如实报错；清理 tmp；不 rename；不产生半成品 |
| 7. 连续导出同名 | 第二次目录名追加 `-2`，不覆盖旧档案 |
| 8. 导出进行中再点导出 | 返回 busy（并发闸），不写两份 |
| 9. 浏览器预览（`npm run dev`）同操作 | 降级为单 ZIP 下载（STORE+CRC32；CompressionStream 可用时 DEFLATE），可解压还原 |

**自动化覆盖/证据**：
- 自动：`src/storage/archive.test.ts`（40 例：CRC/SHA、ZIP 结构、DOS 时间、文件名、round-trip、凭据断言、manifest/checksums 一致性、写 tmp→rename→reveal、失败清理、取消、同名 -2、busy、浏览器 ZIP、PNG 尺寸契约）。
- 本轮实测：`archive.test.ts` 通过（§6）。
- **必须真机**：真实 Tauri fs 插件写入 `appDataDir`、`revealItemInDir` 打开资源管理器、磁盘满/权限错误的 OS 行为、PNG 实际编码与文件大小。

---

## 3. T3 A3 真实 WebDAV（Nextcloud / 坚果云 / 群晖）

对**每个服务商**执行：

| 步骤 | 期望结果 |
| --- | --- |
| 1. 设置→同步→选预设（Nextcloud / 坚果云 / 群晖 / 通用）→填服务器地址/用户名/应用密码 | 端点按预设自动生成（Nextcloud 含 `/remote.php/dav/files/<user>/BlockHabit/`；坚果云固定域名；群晖 `/home/BlockHabit/`）；旧 endpoint 不残留 |
| 2. 点「测试连接」 | 五阶段依次通过：地址 → 连接 → 认证 → 读写（PUT→GET→DELETE 临时文件）→ 清理；结果脱敏可复制；**不触发正式同步合并** |
| 3. 错误密码（或登录密码代替应用密码） | 认证阶段 401，提示「使用应用专用密码」；不误报为网络错误 |
| 4. 开启同步→立即同步 | 远端出现 `blockhabit-data.json`；本机状态不变（首次推送） |
| 5. 第二台设备/第二份安装：同步 | 数据合并（墓碑不复活）；双端撤销的打卡不会互相复活 |
| 6. 双端并发修改同一存档 | 412 冲突 → 重新合并 → 重推一次收敛（无丢失更新） |
| 7. 断网/错误地址/证书错误 | 如实提示阶段与原因（timeout/TLS/unreachable/auth/not-found/quota 等），可复制诊断 |
| 8. 浏览器预览同操作 | 明确提示「浏览器预览受跨域限制，请在桌面端重试」，不伪装成网络错误 |

**自动化覆盖/证据**：
- 自动：`src/sync/webdav.test.ts`（12 例：URL/鉴权/200/404+PROPFIND/401/412/MKCOL/500/CORS 归类）；`src/sync/webdav.e2e.test.ts`（3 例：**真实本地 HTTP 服务器**模拟 WebDAV，双设备撤销不复活、并发 412 收敛）；`src/sync/providers.test.ts`（13 例：四预设 URL、编码、切换不沿用旧端点）；`src/sync/diagnose.test.ts`（35 例：五阶段/错误分类/脱敏/取消（B1）/清理）；`src/sync/webdavConfig.test.ts`（5 例：rememberPassword 落盘策略）；`src/components/WebdavPanel.test.tsx`（4 例：密码不回填/开关/取消）；`src/sync/useSync.test.ts`（10 例：配置落盘/合并流程）。
- 本轮实测：上述文件通过（§6）。
- **必须真机**：真实 Nextcloud/坚果云/群晖的 TLS、2FA 应用密码、目录权限、服务器差异（PROPFIND 状态码、MKCOL 支持）、Tauri 原生 HTTP 通道（浏览器 CORS 已被绕开）。

---

## 4. T4 B2 真实 25 分钟专注 + 系统通知 + 托盘

| 步骤 | 期望结果 |
| --- | --- |
| 1. 今日页对 focus 习惯点「开始专注」→ 25 分钟 | 摆件/今日页进入 focusing；倒计时按真实时间（关掉主窗也继续） |
| 2. 最小化/关闭主窗到托盘，等待到点 | 托盘 tooltip 从「今日进度 …」变为带「专注中」；到点变为「时间到，确认后落块」 |
| 3. 到点瞬间 | 弹出 **Windows 系统通知**「『习惯名』专注时间到，确认后落块」；只提醒一次 |
| 4. 不点确认，继续等 | **不自动打卡、不自动落块**（数据诚实）；摆件/今日页保持 ready |
| 5. 点「确认落块」 | 正常 checkIn（actualMinutes=25），积木掉落；会话清除；托盘 tooltip 恢复 |
| 6. 到点前点「再等 5 分钟」（最多 2 次） | 新目标到点后再提醒一次（notifiedAt 清空）；第 3 次不可用 |
| 7. 点「放弃」→ 二次确认 | 会话清除，**不产生任何打卡** |
| 8. 专注中重启应用 | 会话从 localStorage 恢复；已提醒过的不重复通知；过期（>24h）会话不再打扰 |
| 9. 多会话（两个习惯同时专注） | 主面板显示最早到点/ready 优先；副行提示「另有 N 个专注」 |

**自动化覆盖/证据**：
- 自动：`src/logic/focusSession.test.ts`（31 个测试块：状态机、跨午夜、延长、通知计划（B4）、托盘相位/文案（B4）、多会话规则（B4）、timerStore 持久化/坏 JSON/prune）；`src/components/MiniDeskToy.test.tsx`（14 例：三档、ready 不自动完成、延长上限、多会话副行、放弃无打卡、重开恢复）；`src/components/HabitRow.focus.test.tsx`（4 例：延长后今日页不提前待确认，fake timers）。
- 本轮实测：上述文件通过（§6）。
- **必须真机**：Windows 系统通知权限与通知中心、托盘 tooltip 真实更新（`update_tray` Rust command）、WebView2 后台节流下 25 分钟计时/通知是否准时（**重点风险**：窗口隐藏时 JS 定时器可能被节流；状态用绝对时间派生，但通知触发点需实测；若延迟明显，记录为 P2 并评估原生调度）。
- 建议先跑 1 分钟快速冒烟（临时习惯 targetMinutes=1，仅测试用），再跑完整 25 分钟终验。

---

## 5. T5 B3 100 块建筑时间线

前置：准备含 **190 块城堡**（或任意 100+ 块建筑）的存档；图鉴→该建筑→「档案」。

| 步骤 | 期望结果 |
| --- | --- |
| 1. 打开建筑档案 | 标题/落成日/第 N 座/耗时天数/投入最多习惯/全勤日/奖励块如实显示；未落成建筑显示诚实空态（不伪造日期） |
| 2. 关键块时间线 | 首块 / 25% / 50% / 75% / 末块 五个锚点，按序位升序；可展开当天随笔与心境；墓碑打卡不关联 |
| 3. 100+ 块滚动/展开 | 无明显卡顿、不丢帧（主观 + 任务管理器 CPU 观察）；时间线文案不截断 |
| 4. 编辑奠基石铭言 → 保存 → 重开 | 铭言持久化；空白铭言视为无 |
| 5. 保存「档案卡」PNG / 「拍立得」PNG | 1280×1760（档案卡）/ 640×880@2x 契约；文件可打开、文字清晰、四主题配色正确；无铭言时不伪造铭言行 |
| 6. 四主题 × zh/en 切换 | 颜色/字体/文案正确，暗色下可读 |
| 7. 移动端布局（窗口缩窄/实验性） | 走 BottomSheet；Esc 逐层关闭（嵌套拍立得不误关抽屉）——桌面端不强制 |

**自动化覆盖/证据**：
- 自动：`src/logic/buildingArchive.test.ts`（24 块：落成日=max(placedAt) 本地日期、第 N 座、耗时、投入最多、关键块锚点、随笔时间线、墓碑排除、旧档不可考、跨年、completionDateOfBuilds 5 例）；`src/render/buildingArchiveCanvas.test.ts`（7 例：640×880@2x / 640×260@2x、绘制契约、字体等待、data-testid）；`src/components/BuildingArchiveModal.test.tsx`（7 例：桌面/移动 BottomSheet、Esc、嵌套、空态）。
- 本轮实测：上述文件通过（§6）。
- **性能数据（B5，dev + agent-browser，castle 190 块，3 次运行）**：打开档案卡首帧 40–45ms（舞台 380 次 blit 仅 0.9–1.2ms）、关键块切换 mean 7.7–7.9ms / p95 ≤10.7ms、滚动 2s p95 ≤4.0ms / >16.7ms 帧 0、档案卡 PNG 绘制 15–17ms；均在 16.7ms 帧预算内（详见 `.tmp-b5/report.md`，不提交产物）。真机复核为最终口径。
- **必须真机**：真实 canvas 绘制性能、PNG 实际保存、字体加载、100+ 块滚动流畅度。

---

## 6. T6 手动检查更新与签名（**0.2.1 起可执行；0.2.2 为当前验证目标**）

> 2026-11-14 起发布链路已配置：签名密钥在仓库外、公钥/endpoints 已写入 `plugins.updater`、
> 两个 Actions secrets 已设置、仓库已转 public，0.2.1 / **0.2.2** 均已由 Release workflow 出签名包并上传 `latest.json`。
> 因此 T6 从「条件项」变为**可执行项**：先安装 0.2.1，再让应用自己升级到 **0.2.2**（当前 latest）。
> 0.2.2 的 Release 资产除 exe/sig/msi/latest.json 外还带 **`.sha256`** 校验文件，tag 由 workflow 钉在触发提交上
> （见发布报告 §15）。C4 评估见 `docs/release/updater-and-keyring-assessment.md`。

### 6.0 测试载荷（0.2.1 起新增，缺一不可）

| 载荷 | 位置 | 用途 |
| --- | --- | --- |
| **旧版安装包（0.2.1 已发布版，updater 已启用）** | GitHub Release `v0.2.1`：`BlockHabit_0.2.1_x64-setup.exe`（直接安装即可；它带公钥与端点、`VITE_UPDATER_ENABLED=1`，会真的去查 latest.json） | 作为 T6 的起点（安装在 0.2.1，再升级到 0.2.2） |
| **新版安装包（0.2.2，签名）** | GitHub Release `v0.2.2`：`BlockHabit_0.2.2_x64-setup.exe` / `.sig` / `.sha256` / `latest.json`（MSI 可选） | 被 updater 下载安装的目标 |
| **升级后数据判定基准** | 升级前先导出一份档案包并记录建筑数/连击数；升级后再导出比对 | 判定「升级不丢数据」 |
| **23 座全落成测试存档** | `docs/release/fixtures/all-blueprints-complete.json`（本仓库新增，**合成数据**：schemaVersion 2 / contentVersion 3 / 23 座 / 2485 块；展台仅能摆下 15 座，属几何限制不是缺陷） | T7 装饰模式与 T6「升级后数据不丢」的判定基准 |
| 一键校验脚本 | `.tmp-release/verify-release.ps1`（由 Lead 生成，含 `gh release view` 与 `Invoke-WebRequest` 断言） | 发布后自检资产可公网访问 |

> 关键：**不要用 0.2.0 的旧 tag/旧包**。0.2.0 时代的安装包没有公钥与端点，点「检查更新」只会显示禁用态。
> 0.2.1 起发布包已内置 updater 配置，可直接作为起点；若需要「本地重出 0.2.1 起点包」（例如没有旧版安装包），
> 见 §12.1（用 `--config '{"version":"0.2.1"}'` 覆盖安装包版本号，仓库文件不动）。

发布链路已配置，按下列步骤执行：

| 步骤 | 期望结果 |
| --- | --- |
| 0. 默认构建（未配置）打开 设置→内容路线→版本与更新 | 按钮禁用、如实显示「发布链路尚未启用」；不发起任何外部网络请求（抓包核对） |
| 1. 安装旧版本 → 手动「检查更新」 | 发现新版本，显示版本号/说明；无更新时诚实提示 |
| 2. 下载 → 安装（passive）→ 重启 | 应用退出前存档 flush（退出握手）；新版本启动；数据/设置/WebDAV 配置不丢 |
| 3. 篡改 `latest.json` 签名 | 拒绝安装并提示校验失败（签名不可关闭） |
| 4. 断网 / endpoint 404 / 非 2XX | 诚实提示失败；不显示「已是最新」；不阻塞应用 |
| 5. 抓包检查请求 | 只含版本/平台/架构，无用户标识；README 已披露网络行为 |
| 6. 回滚演练 | 坏版本只能发更高版本修复；不会自动降级；数据层 `contentVersion` 门禁保护旧档 |
| 7. 升级后内容版本协同 | 新内容版本存档在旧设备上触发 needsUpgrade（不落盘、不丢数据）；提示用户全部设备升级 |

**自动化覆盖**：updater 适配层 12 例（默认构建不 import 插件/不发请求、四态、错误脱敏、句柄释放、`beforeInstall` 先于下载、握手失败即中止）+ AboutPanel 10 例（禁用/最新/可用/失败/取消不误报/安装交付 forceFlush）；真实下载→签名校验→安装→重启必须真机。

---

## 7. T7 自由装饰模式（D-20261111-068）

前置：用仓库内的合成载荷 `docs/release/fixtures/all-blueprints-complete.json`（23 座全落成、2485 块）
在 设置 → 数据 → 导入 中导入（**先导出一次现有存档做备份**）。载荷不含任何真实用户数据。

| 步骤 | 期望结果 |
| --- | --- |
| 1. 未全落成时打开展台 | 顶栏无「装饰模式」入口；拖拽/点击看相纸行为与旧版一致 |
| 2. 全落成后打开展台 → 开「装饰模式」 | 出现「退出装饰」；点击模型=选中（不打开拍立得）；浮层显示模型名 + 逆时针/顺时针 90° + 换一组植被 |
| 3. 旋转 90/180/270 | 模型按象限旋转、宽深互换、不越界/不与邻居重叠；非法旋转 toast「旋转后会与其他模型重叠，已还原」且模型不变 |
| 4. 换一组植被 | 微生态植被重排；toast「植被已重排（仅本次会话）」 |
| 5. 重开应用 / 退出装饰 | 旋转与植被复原（仅本次会话，不写存档）；退出后点击模型恢复正常打开拍立得 |
| 6. 四主题 × zh/en + 移动端 390 宽 | 浮层与按钮可见、旋转按钮 ≥44px、无新颜色/阴影、reduced-motion 无动画 |

**自动化覆盖**：logic/showcase 21、render/showcaseLayout 20、pages/Showcase 6；浏览器逐像素断言「装饰开未操作 == 关」「退出 == 操作前」、localStorage 前后逐字节相同、四主题/移动端截图。
**必须真机**：真实鼠标/触摸拖拽与旋转浮层定位（超矮窗口可能压到模型，见已知限制）。

---

## 7.5 T8 OS 凭据管理器（keyring，D-20261114-072）

前置：桌面端 0.2.2（0.2.1 起具备 keyring 能力）；一个可用的 WebDAV 账号（T3 已准备）。

| 步骤 | 期望结果 |
| --- | --- |
| 1. 设置→同步填写 WebDAV（含密码）→ 保持「记住」 | 保存后不再等待 |
| 2. 关闭应用 → 打开「控制面板 → 凭据管理器 → Windows 凭据」 | 找到 `com.blockhabit.app` 条目；用户名是 64 位十六进制（**不是**邮箱/URL） |
| 3. 检查存档与配置 | WebView 数据里（`%APPDATA%\com.blockhabit.app\EBWebView`）**搜不到明文密码**；导出的档案包里也没有 |
| 4. 重启应用 → 打开「设置 → 同步」 | 不要求重输密码；面板打开后密码已从凭据管理器回填，点「立即同步」可成功（迁移/回填发生在首次打开设置页，与既有同步挂载方式一致） |
| 5. 手动删除该凭据条目 → 重启 | 同步失败时如实提示「需要重新输入密码」；**不崩溃、不阻塞启动、不清空其它配置** |
| 6. 关闭「记住密码」→ 重启 | 本次运行可同步；凭据管理器里该条目被删除；重启后要求重输 |
| 7. 卸载应用 | 记录凭据管理器条目是否残留（**已知：NSIS 卸载不清理**，作为已知限制登记，不判失败） |

**自动化覆盖**：`cargo test --lib` 凭据模块 3 例（账号键校验）；`webdavKeyring.test.ts` 10 例
（不可用退回旧行为 / 可用不落明文 / 迁移成功即删明文 / 迁移失败保持原样 / 回填 / 关闭记住即删除 / 探测失败不误删）；
`credentials.test.ts` 6 例（不可用不谎报成功、账号键派生与换行防撞键）。
**必须真机**：凭据管理器条目、WebView 数据无明文、重启回填、卸载残留。

---

## 8. 全局壳检查（真机，建议同轮执行）

| 项 | 步骤 | 期望 |
| --- | --- | --- |
| 单实例 | 启动应用后再双击一次快捷方式 | 不产生第二实例；聚焦已有主窗 |
| 退出握手（托盘/程序化） | 有未落盘操作时托盘→退出；以及安装器安装更新时 | 先 flush 存档再退出（≤1.5s 超时兜底）；不丢最近打卡 |
| 退出握手（强制结束 / 关机） | 打卡后立刻用任务管理器「结束任务」；再重复一次「注销」 | **已知限制**：tao 0.37.1 不处理 `WM_QUERYENDSESSION`，关机/注销不保证送达 `ExitRequested`；期望「最后一次打卡仍可能丢失」，但**不得**出现存档损坏或空态覆盖（关键动作已立即落盘）。记录为已知限制，不判 P0 |
| 开机自启 | 设置→开机自启开/关 → 重启系统 | 行为与开关一致 |
| 数据目录 | 设置→打开数据目录 | 资源管理器定位到 `%APPDATA%/blockhabit*` |
| 错误日志 | 触发一次错误（如损坏导入） | 有本地日志/错误提示；不上传、不联网 |
| 托盘菜单 | 打开菜单后点其它窗口 | 失焦自动隐藏 |
| 主题/字体 | 四主题切换 | 无闪烁/错色；离线字体正常 |

---

## 9. 自动化 vs 真机 覆盖总结

| 模块 | 本轮自动化证据（2026-11-11 收尾后实测） | 必须人类真机 |
| --- | --- | --- |
| T1 多屏/HiDPI/拖拽双击 | miniWindow 7、showcaseLayout 12、touchGesture 6、MiniDeskToy 14 | ✅ 全部 OS 窗口/托盘/DPR |
| T2 A4 档案包 | archive 37（含 mock fs 的写盘/取消/reveal 流程；manifest 版本语义 7 例） | ✅ 真实 fs/reveal/磁盘错误 |
| T3 A3 WebDAV | webdav 12、webdav.e2e 3（本地 HTTP 服务器）、providers 13、diagnose 35、webdavConfig 5、WebdavPanel 4 | ✅ 三个真实服务商 |
| T4 B2 专注/通知/托盘 | focusSession 31、MiniDeskToy 14、HabitRow.focus 4 | ✅ 系统通知/托盘/后台计时 |
| T5 B3 100 块时间线 | buildingArchive 24、buildingArchiveCanvas 7、BuildingArchiveModal 7 | ✅ 真机绘制/滚动/PNG |
| T6 手动检查更新 | updater 12（含句柄释放与 beforeInstall）、AboutPanel 10（默认禁用/不联网） | ✅ 真实下载→签名校验→安装→重启 |
| T7 自由装饰模式 | logic/showcase 21、showcaseLayout 20、pages/Showcase 6 | ✅ 真机拖拽/浮层/会话复原 |
| 全局壳 | 单实例/退出握手为 Rust 逻辑，无 JS 单测 | ✅ 全部 |

**本轮定向测试结果**：相关模块定向运行全部通过；`npx tsc --noEmit` 0 错误；`npm run format:check` 通过。

> 说明：最终全量门禁以 Lead 提交前实测为准（0.2.1）：`npx tsc --noEmit` 0 错、`npm test` **109 文件 / 1133 用例全绿**、`design:check` **73 条**、`format:check`、`check:versions` 0.2.1、`npm run build`、`tauri build --config src-tauri/tauri.release.conf.json`（签名）均通过；本清单只引用与验收模块相关的定向结果。

---

## 10. 真机执行记录表（复制使用）

| 编号 | 机器/系统 | 显示器/缩放 | 结果（通过/失败/阻塞） | 证据路径 | 备注 |
| --- | --- | --- | --- | --- | --- |
| T1-1 | | | | | |
| T1-2 | | | | | |
| T2-1 | | | | | |
| T2-5 | | | | | |
| T3-Nextcloud | | | | | |
| T3-坚果云 | | | | | |
| T3-群晖 | | | | | |
| T4-25min | | | | | |
| T5-190块 | | | | | |
| T6-更新 | | | | | 条件：发布链路 |
| T7-装饰旋转 | | | | | |
| T7-装饰退出复原 | | | | | |
| 全局-单实例 | | | | | |
| 全局-退出握手 | | | | | |

失败项必须记录：复现步骤、期望/实际、截图/录屏路径、是否阻塞发布；P0/P1 修复后重跑对应项。

---

## 11. 已知限制与风险（验收时不要误报）

- **旧版本没有更新通道**：0.2.0 及更早的安装包里 `plugins.updater` 的 pubkey/endpoints 为空，按钮会诚实禁用——这是预期，不是 bug；这些版本只能手动下载覆盖安装。0.2.1 起按钮可用。
- **关机/注销不保证送达 ExitRequested**：`tao 0.37.1` 不处理 `WM_QUERYENDSESSION`（见 D-20261110-019 履历）；关键动作已立即落盘，最多丢一次非关键设置的防抖窗口，**不得**因此判定存档损坏。
- **装饰旋转仅会话态**：D-20261111-068 明确不写存档，切页/重开均复原（「本次会话」指在展台页内）；store 落位二次校验仍按基础 footprint，极端旋转拖拽可能回弹（无数据损坏）。
- **移动端新按钮尺寸**：装饰开关/检查更新按钮未强制 44px（旋转按钮已 44×44）；移动端为实验态，不阻塞发布。
- **通知依赖进程存活**：应用完全退出后不会提醒；开机自启可缓解（README §平台范围）。
- **移动端为实验态**：无构建目标，T5 的移动布局项仅作回归观察，不阻塞发布。
- **浏览器预览与桌面端能力不同**：WebDAV 跨域、文件系统、系统通知、托盘都必须以桌面端为准。
- **WebView2 后台节流**：T4 的 25 分钟通知可能受窗口隐藏影响，必须实测；若延迟明显，记录为风险而非直接判失败（状态/数据仍正确）。
- **B5 性能数据**：100 块时间线的量化性能以 B5 报告为准（已就绪），本清单只列操作与期望。

---

## 12. 发布后自检（一条命令）

发布后/回归时跑：

```bash
npm run release:check -- --version 0.2.2            # 12 项检查，只走公开 HTTP + gh CLI
npm run release:check -- --version 0.2.2 --download # 13 项：额外下载安装包核对实测 sha256，并核对 .sha256 资产
```

它会依次核对：latest.json 公网 200、version 与期望一致、GitHub Release 存在且非 draft/prerelease、
资产含 `*latest.json` / `*x64-setup.exe` / `*x64-setup.exe.sig` / `*x64-setup.exe.sha256`、
latest.json 的 url 指向本 tag 的安装包、`.sig` 与 latest.json 的 signature **逐字节一致**、安装包 HEAD 200、
`.sha256` 资产内容与 GitHub digest 一致（`--download` 时再下载安装包实测 sha256 比对）。
任一项失败退出码为 1，并打印失败项。

> 为什么不用 PowerShell 的 `Invoke-WebRequest`：本仓库开发机是 **Windows PowerShell 5.1**，
> 未做 IE 首启配置时 `Invoke-WebRequest` 会抛 `NonInteractive` 而拿不到内容（实测踩过）。
> 脚本用 Node 的全局 `fetch`，与 PowerShell 版本无关；纯逻辑部分有 11 例单测（`scripts/check-release.test.mjs`）。
>
> 仓库 owner 是 **`LeeeeCm`**（四个 e），手工拼 URL 时注意别少写一个。

最新一次实测（2026-11-15 发布 v0.2.2 后，`npm run release:check -- --version 0.2.2 --download`）：

| # | 检查 | 结果 |
| --- | --- | --- |
| 1 | latest.json 公网可读 | ✔ HTTP 200 |
| 2 | latest.json version | ✔ 0.2.2 |
| 3 | GitHub Release 存在 | ✔ v0.2.2 |
| 4 | 非 draft / 非 prerelease | ✔ |
| 5–8 | 资产含 latest.json / exe / .sig / .sha256 | ✔ 6 个资产齐全（exe+msi 各一份 .sha256） |
| 9 | url 指向本 Release 的安装包 | ✔ |
| 10 | .sig 与 signature 逐字节一致 | ✔ 420B == 420B |
| 11 | 安装包 HEAD 200 | ✔ |
| 12 | .sha256 资产内容与 GitHub digest 一致 | ✔ `1b18d100…` |
| 13 | （--download）下载实测 sha256 与 digest | ✔ `1b18d100…` |

> 完整性自查（人类可照做）：`Get-FileHash .\BlockHabit_0.2.2_x64-setup.exe -Algorithm SHA256` 与
> Release 上的 `.sha256` 文件对比；minisign keyid `c38f798bd203ed59` 与 `tauri.conf.json` 公钥一致（发布报告 §15.4）。

### 12.1 旧版起点包（T6 需要「带 updater 的旧安装包」）

**优先做法**：直接安装已发布的 `v0.2.1` 安装包（`gh release download v0.2.1 -p "*-setup.exe"`）。
0.2.1 起发布包已内置 updater 公钥/端点，会去查 latest.json（当前 latest = 0.2.2），是天然起点。

**兜底做法**：如果本机没有 v0.2.1 安装包，用下面的命令重出一个「0.2.1 版本号 + 当前 updater 配置」的
起点包（只覆盖安装包版本号，不改仓库文件）：

```powershell
$env:VITE_UPDATER_ENABLED = '1'
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "$env:USERPROFILE\blockhabit-keys\blockhabit.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content -Raw "$env:USERPROFILE\blockhabit-keys\PASSWORD.txt"
npm run tauri build -- --config src-tauri/tauri.release.conf.json --config '{"version":"0.2.1"}'
# 产物：src-tauri/target/release/bundle/nsis/BlockHabit_0.2.1_x64-setup.exe
```

> 0.2.0 时代的安装包没有公钥/端点，**不能**用作 T6 起点。
> 该包只用于本机 T6 起点，**不要**上传成 Release 资产（否则 `latest.json` 会指错版本）。
> T7 的强制结束/关机项见 §8「退出握手（强制结束 / 关机）」的已知限制说明。
