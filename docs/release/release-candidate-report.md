# 发布候选报告 — BlockHabit 0.2.0（2026-11-11 第十轮完成版）

- 基线：`main` @ 90d0180（63 条历史提交，本轮由分支合并，不 push、不打 tag）
- 工作分支：`chore/release-prep`，共 **30 条提交**（本报告所在提交为最后一条 docs 提交）
- 结论：**发布候选可用**。Lead 门禁全绿；第九轮独立 verifier PASS（前 20 条提交）；第十轮独立 verifier 状态见 §5。
- 人类决策：2026-11-11「批准你的所有内容，继续完成，合并 main」→ D-068/D-069 转 approved 并实现、新增 D-070 approved 并实现；本地 main 以 `--no-ff` 合并（merge commit `8f85837`），随后 `4a4dfcb` 以 `.gitattributes` 统一 LF 换行（修复 Windows 检出 CRLF 导致的门禁平台差异）。
- 性质：本地优先、无账号、无遥测；除已批准的 updater/process 外无新增依赖；不改视觉语言；版本仍 0.2.0。

## 1. 提交清单（main..HEAD）

### 1.1 任务 A：历轮成果 Git 基线（8 条）

| # | hash | 主题 |
| --- | --- | --- |
| 1 | 24c9bdf | chore: 建立设计中枢、协作规则与工程配置 |
| 2 | a5fe74e | feat: 0.2.0 基础体验与工程优化 |
| 3 | 2aaa37e | feat: 打开动机与可发现性（今日简报/模板/晚间提醒/页面提示） |
| 4 | a10dc48 | feat: Wave1 桌面摆件、落成年鉴与 WebDAV 自检 |
| 5 | 82a5586 | feat: Wave2 完整档案包、建筑档案与专注陪伴 |
| 6 | 4229883 | feat: B1 内容版本门与 6 座扩展蓝图（18 座 / 1985 块） |
| 7 | 6d72d7e | feat: 18 座蓝图逐座材质配色（D-20261111-067） |
| 8 | 5bbcf1e | docs: 更新 CHANGELOG 至 0.2.0 与 2026-11-11 各轮成果 |

### 1.2 任务 B/C 收尾与第十轮批准项（共 21 条）

| # | hash | 主题 |
| --- | --- | --- |
| 9 | cb42667 | refactor(render): 抽取 modelStage 公共等距舞台（B2） |
| 10 | 5dc8991 | refactor(settings): SettingsDialog 拆分 + 档案 manifest 版本语义（B3） |
| 11 | d0fc589 | feat(sync): WebDAV 自检取消 + rememberPassword + 密码 DOM 缓解（B1） |
| 12 | 605f075 | feat(focus): 今日页专注入口 + 多会话规则 + 通知/托盘可测化（B4） |
| 13 | b358741 | feat(gallery): 建筑档案移动端 BottomSheet + 拍立得落成日 + 性能测量（B5） |
| 14 | 283fb2c | chore(test): 测试/工程卫生收尾（B6） |
| 15 | 4139aa8 | feat(i18n): 补齐 B/C 收尾文案（zh/en） |
| 16 | 9824b00 | feat(settings): 内容路线/关于分组（C2） |
| 17 | ef401d9 | docs(design): D-068 自由装饰模式 + B/C 记录履历与设置表面更新 |
| 18 | c75c8a6 | docs(release): C4 自动更新/keyring 评估 + C3 内容包 v3 方案 + C6 真机验收清单 |
| 19 | 55f43b6 | refactor(storage): archiveZip 字节/压缩层拆分（archive.ts 839→587 行） |
| 20 | 260f104 | docs: 第九轮 CHANGELOG/REVIEW-QUEUE/真机清单校正 + 发布候选报告 |
| 21 | 2a87fb1 | chore(ci): 版本号一致性门禁（C4 零依赖项） |
| 22 | 2f30844 | test(blueprints): 内容包脚手架校验（C3，不生产内容） |
| 23 | de034e6 | docs: D-069 手动检查更新设计 + C3/C4 零依赖收尾记录 |
| 24 | 8efc5dd | feat(i18n): 装饰模式 / 内容包 v3 名称 / 手动检查更新文案（zh/en） |
| 25 | 7062a72 | feat(showcase): 自由装饰模式（D-20261111-068 approved） |
| 26 | 3753301 | feat(blueprints): 内容包 v3 五座与 CONTENT_VERSION=3（D-20261111-070 approved） |
| 27 | bdde800 | feat(updater): 手动检查更新入口 + updater 骨架（D-20261111-069 approved） |
| 28 | e5d3537 | fix(settings): 更新失败详情脱敏可复制 + 去除内联 lang 三元（verifier P2） |
| 29 | a39d236 | chore(format): 本轮新文件 Prettier 对齐并纳入 format:check |

> 说明：任务 A 是把工作区中历轮（2026-11-10/11 的六轮）未提交成果按主题切片；跨轮次共享文件
> 无法重建独立中间态，因此**单条中间提交不保证单独可编译**（各 commit body 已说明），但 HEAD
> 完整可构建、可测试。回滚建议：按序列反向 `git revert`，或以分支整体回退（人工执行）。

## 2. 门禁结果（第十轮完成版实测）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 错误 |
| `npm test` | **104 文件 / 1090 用例全绿**（含 C1/C3/C4 新增测试；历史 `.tmp-verify-a2` 脚本已排除） |
| `npm run design:check` | **70 条记录通过**（12 approved：D-059…D-070；58 proposed） |
| `npm run format:check` | 通过 |
| `npm run check:versions` | 通过（package.json / tauri.conf.json / Cargo.toml 均 0.2.0，已接入 CI） |
| `npm run build` | 成功；主入口 426.10KB（gzip 130.28KB）、CSS 252.17KB（gzip 108.68）、MiniDeskToy 懒加载 13.45KB（gzip 3.48） |
| `npm run tauri build -- --no-bundle` | 成功（含 updater/process 插件；最终构建耗时见 §5/命令记录） |
| `git status` | 干净（仅 .gitignore 忽略项）；未提交 dist/.tmp/target |
| 版本/标签/远程 | 0.2.0；无 tag；无 remote push |

## 3. B 类技术收尾完成情况（第九轮，保持）

| 项 | 状态 | 证据 |
| --- | --- | --- |
| B1 WebDAV 取消 / rememberPassword / 密码 DOM / 统一 handler | ✅ | diagnose 取消 4、配置 5、WebdavPanel 4；浏览器密码不回填 |
| B2 modelStage / 复制降级 | ✅ | modelStage 20、yearbookCanvas 20；四表面 25 张 PNG 逐像素 0 差异 |
| B3 SettingsDialog 拆分 / manifest 语义 | ✅ | SettingsDialog 781 行；archiveFormatVersion+appContentVersion；archive 587 / manifest 212 / zip 263 |
| B4 专注今日入口 / 多会话 / 通知托盘 | ✅ | focusSession 31、MiniDeskToy 14、HabitRow.focus 4 |
| B5 建筑档案移动端 / 落成日 / 性能 | ✅ | completionDateOfBuilds、data-testid、BottomSheet；190 块在帧预算内 |
| B6 测试工程卫生 | ✅ | vitest 排除 .tmp、format:check、注释校正 |

## 4. C 类产品/发布增强完成情况（第十轮更新）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| C1 自由装饰模式（D-068 approved） | ✅ **已实现** | 全落成解锁；会话内 90° 旋转 + 换植被；不写存档/settings/schema；44px、四主题 zh/en、reduced-motion；测试 21+20+6 |
| C2 内容路线 / 关于（D-069 前身） | ✅ 完成 | 动态 23 座/2485 块/contentVersion 3、年度节奏、升级说明、本地优先；zh/en |
| C3 内容包 v3（D-070 approved） | ✅ **已实现** | 5 座/500 块 → 23 座/2485 块；CONTENT_VERSION=3；旧 18 座指纹锁定零改动；兼容矩阵升 v4 |
| C4 手动检查更新（D-069 approved） | ✅ 骨架完成；发布链路 blocked | updater/process 依赖与插件、AboutPanel 版本与更新行、默认禁用不联网、19 例测试、tauri build 成功；签名密钥/端点/latest.json/CI/code signing 待人类 |
| C5 性能/质量基线 | ✅ 完成 | 首屏/切页/建造 190/展台 18/图鉴 18/年鉴导出全在预算内 |
| C6 真机验收清单 | ✅ 交付 | 新增 T7 自由装饰模式、更新 T6 更新项与执行记录表 |

## 5. 独立验证

- 第九轮 verifier（前 20 条提交）：**PASS，P0=0/P1=0**，P2/P3 已处置；报告 `.tmp-verify-final/report.md`。
- 第十轮 verifier（4 条代码提交 + 记录/门禁）：**PASS**，P0=0 / P1=1（设计台账未提交，随本报告所在 docs 提交消除）/ P2=2（已修复：错误详情脱敏可复制、内联 lang 三元改映射表）/ P3=6（见 §6 已知限制/处置）；报告 `.tmp-verify-r10/report.md`。
- 第十轮 verifier 亲测：tsc 0、npm test 104/1090、design:check 70、format/check:versions 通过、build 425.82KB/gzip 130.22KB、`tauri build -- --no-bundle` exit 0；内容包独立脚本 23/2485 + 旧 18 座逐块 0 mismatch + generators.ts 零 diff；浏览器四主题/移动端/装饰/更新禁用态 0 page error。

## 6. 仍 blocked / 需要人类处理

1. **C4 发布链路**：签名密钥生成与保管（`npx tauri signer generate`，仓库外 + CI secrets，不经明文提交）、发布端点 URL、`latest.json` 托管、CI release secrets、`createUpdaterArtifacts` 开启、Windows Authenticode（可选）、启用前 Rust `on_before_exit` 存档握手；提供后按 C4 文档 §3.7 与真机清单 T6 验收。
2. **C6 真机验收**：T1 多屏/HiDPI、T2 档案包落盘/reveal、T3 三服务商 WebDAV、T4 25 分钟专注+通知+托盘、T5 100 块时间线、T6 更新、T7 自由装饰模式。
3. **keyring 阶段三**：按评估 §4 方案 B，需新依赖 + 存储迁移决策；当前仅 rememberPassword 不落盘。
4. **其余 58 条 proposed 设计记录**：按 design/REVIEW-QUEUE.md 分组审核。
5. **远程发布**：本地 main 已合并；未 push、未打 tag、未发布，由人类决定。

### 已知限制（第十轮 verifier P3，接受并记录）

- 移动端装饰开关/检查更新按钮为既有按钮尺寸（约 28–29px），未强制 44px；旋转按钮已 44×44（移动端为实验态，不阻塞发布）。
- 装饰模式会话态在切换页面后复原（D-068 明确不写存档；「本次会话」指在展台页内的会话，切页/重开均复原）。
- `format:check` 仍为人工白名单（既有机制，避免全仓格式化 churn）；本轮新增文件已纳入白名单，既有文件的增量改动不在门禁范围（机制性扩围需单独立项）。
- 图鉴「未开始」卡显示容量口径（如 94/94）为既有行为，非本轮回归；后续可另立记录优化。

## 7. 复现

```
git switch main
npx tsc --noEmit && npm test && npm run design:check && npm run format:check && npm run check:versions
npm run build
npm run tauri build -- --no-bundle
# 浏览器/性能/真机：见 .tmp-c5/report.md、.tmp-verify-*/report.md、docs/release/real-device-acceptance.md
```
## 8. 第十一轮（2026-11-12）：P3 收尾与发布链路脚手架

- **P3（D-20261112-071 approved）**：移动端装饰开关/检查更新按钮 44×44（≤640px 断点）；图鉴未开始卡片改为「共 N 块」；store 校验口径继续记录为已知限制。
- **审核摘要**：REVIEW-QUEUE §12 给出 58 条 proposed 的分组摘要（6 功能 / 40 工程 / 12 文档决议），供人类批量审批。
- **发布脚手架**：release workflow（手动触发）+ tauri.release.conf.json + latest.json 生成器（8 例测试）+ release-runbook；本机已验证配置合并与构建；**签名密钥/端点/secrets/on_before_exit 仍待人类**。
- 台账 71 条（13 approved）；本轮提交后 push 至 origin/main，走 GitHub Actions CI 复核。

## 9. 第十二轮（2026-11-14）：0.2.1 可发布状态

- **授权**：人类本轮明确授权「批准一切必要请求与最佳方案；可新增依赖（keyring 等）、可修改并 push main、
  可生成签名密钥（私钥只能放仓库外）、可配置 GitHub Actions secrets、可运行发布 workflow、
  可在确认历史无敏感信息后把仓库设为公开、可升版本 0.2.1 并创建 Release/tag」。
- **台账**：58 条 proposed → approved（reviewer=LeeCM，正文零改动，仅追加授权履历）；新增 approved
  D-20261114-072（keyring）与 D-20261114-073（format:check 扩围）；D-048/D-050/D-068 追加式履历补充。
  台账 **73 条 / 73 approved / 0 proposed**。
- **代码**：
  | 主题 | 记录 | 交付 |
  | --- | --- | --- |
  | on_before_exit 存档握手 | D-20261110-019 | Rust `ExitRequested` 拦截 + 握手去重 + `should_handshake` 纯函数（3 例）；`installUpdate({ beforeInstall })` 安装前 flush（+2 例）；AboutPanel 传 `forceFlush` |
  | WebDAV 密码进 OS 凭据管理器 | D-20261114-072 | `keyring 3.6.3`（仅 Windows 目标）+ `credentials.rs` 4 命令（3 例）+ `platform/credentials.ts`（6 例）+ useSync 探测/迁移/回填（10 例）+ `rememberPasswordHintOs` zh/en |
  | 装饰模式旋转落位校验 | D-20261111-068 履历 | `updateShowcasePlacement(..., rotations?)` + 7 例；不改持久化字段 |
  | format:check 扩围 | D-20261114-073 | 目录级范围 + 188 文件一次对齐（零逻辑改动）+ CI 新增 Format check / Production build |
- **发布链路**：
  - 仓库外 `%USERPROFILE%\blockhabit-keys\blockhabit.key`（私钥 + 密码，绝不入库、不打印）。
  - `plugins.updater.pubkey` 与 `endpoints` 已填；`TAURI_SIGNING_PRIVATE_KEY` /
    `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 两个 Actions secrets 已设置。
  - 仓库由 private 改为 **public**（Release 资产需公开，updater 不带 token）；转公开前的历史扫描结论见 §10。
  - 版本 0.2.0 → **0.2.1**（三处构建入口 + `Cargo.lock`），`npm run check:versions` 通过。
- **门禁（本轮实测）**：`npx tsc --noEmit` 0；`npm test` **109 文件 / 1133 用例**；
  `design:check` **73 条**；`format:check` 通过；`check:versions` 0.2.1 通过；
  `cargo test --lib` 6 例；`npm run build` 成功；`npm run tauri build -- --config
  src-tauri/tauri.release.conf.json`（`VITE_UPDATER_ENABLED=1` + 签名密钥）成功并产出 `.sig`。
- **仍须人工/真机**：T6 自动更新全流程、T7 强制结束进程后的存档一致性、C6 keyring 真机验收（凭据管理器条目、
  卸载残留）。清单与测试载荷见 `docs/release/real-device-acceptance.md` §T6/§T7/§T8。

## 10. 转公开前的历史敏感信息扫描（2026-11-14）

| 检查项 | 方法 | 结论 |
| --- | --- | --- |
| 曾入库文件名 | `git log --all --diff-filter=A --name-only` → 447 个唯一路径 → 匹配 `*.key/*.pem/*.pfx/*.p12/*.env/id_rsa/secret/credential/token` | 只命中 `design/TOKENS.md`、D-018/D-026/D-072、`src/platform/credentials.*`、`src-tauri/src/credentials.rs` 等**源码与文档文件名**，无密钥文件 |
| 全历史内容 | `git log --all -p` 搜索 `BEGIN … PRIVATE KEY`、`ghp_/gho_/github_pat_`、`sk-`、`AKIA`、`xox[baprs]-`、`AIza`、`TAURI_SIGNING_PRIVATE_KEY=`、`minisign encrypted secret key` | **0 命中** |
| 硬编码密码 | `git grep -E 'password\s*[:=]\s*…'` 全历史 | 仅测试夹具（`'secret'` / `'password123'` / `'legacy-password'`）与字段名，无真实凭据 |
| 个人身份 | 提交邮箱 `git log --all --pretty=%ae` | 仅 `leecm@blockhabit.local`（本地占位，非真实邮箱） |
| 跟踪树隐私 | `git grep` 匹配 gmail/qq/163/outlook/手机号 | 仅学术论文 URL 与 Cargo.lock 校验和，无个人信息 |
| 生成物 | 跟踪文件中最大的 8 个 | 最大为 `scripts/fixtures/demo-state.json`（184KB **合成**演示数据，habits/checkIns 为空） |

## 11. 发布结果（2026-11-14 实测，Release 已存在）

### 11.1 流水线

| 项 | 值 |
| --- | --- |
| Release workflow run | [43502649192](https://github.com/LeeeeCm/BlockHabit/actions/runs/43502649192) — **success**（首次 43502110013 在 `Verify updater config` 失败，原因：该步骤没注入 secrets 环境变量；已在 `fae5a0b` 修复并补密码非空校验） |
| CI（8ac03c9） | [43503581531](https://github.com/LeeeeCm/BlockHabit/actions/runs/43503581531) — **success**（含新增的 Format check / Production build 两步） |
| Release | <https://github.com/LeeeeCm/BlockHabit/releases/tag/v0.2.1>（非 draft / 非 prerelease / 即 latest） |
| tag → commit | `v0.2.1` → `8ac03c9`（二进制构建自 `fae5a0b`；两者差异**只有** docs 与 `useSync.ts` 注释，见 `git diff fae5a0b 8ac03c9 --stat`） |

### 11.2 资产与公网可访问性（本机实测）

| 资产 | 大小 | 校验 |
| --- | --- | --- |
| `BlockHabit_0.2.1_x64-setup.exe` | 9,300,439 B | 公网下载 HTTP 200；sha256 `0dc798f451bc46a65c8cb8be7f8c4d51f2b6705e6d924527cbc805d8870f849b`，与 GitHub assets API 记录的 digest **完全一致** |
| `BlockHabit_0.2.1_x64-setup.exe.sig` | 420 B | 内容与 `latest.json.platforms["windows-x86_64"].signature` **逐字节相同** |
| `BlockHabit_0.2.1_x64_en-US.msi` | 11,276,288 B | 同一 Release 资产 |
| `latest.json` | 1,044 B | `https://github.com/LeeeeCm/BlockHabit/releases/latest/download/latest.json` **HTTP 200**（跟随重定向到 release-assets），内容自洽 |

`latest.json` 实际内容（节选）：

```json
{
  "version": "0.2.1",
  "notes": "0.2.1：58 条设计记录批量审核；…",
  "pub_date": "2026-11-13T20:41:52Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6…",
      "url": "https://github.com/LeeeeCm/BlockHabit/releases/download/v0.2.1/BlockHabit_0.2.1_x64-setup.exe"
    }
  }
}
```

### 11.3 签名与公钥配对（本机结构性校验）

把 `plugins.updater.pubkey`（base64 → minisign 公钥文本）与 Release 上的 `.sig`（base64 → minisign 签名文本）解码后比对 key id：

```
pub alg: Ed | keyid: c38f798bd203ed59
sig alg: ED | keyid: c38f798bd203ed59     ← 完全一致
KEYID MATCH: true
```

即 **签名产物确实由配置里那把公钥对应的私钥签出**，不是「随便签了个东西」。算法位分别是 `Ed`（公钥）/ `ED`（预哈希签名），符合 Tauri updater 约定。

> 未覆盖：真正的「旧版本 → 检查更新 → 下载 → 校验 → 安装 → 重启」闭环需要安装桌面应用后人工执行，
> 见 `real-device-acceptance.md` §6 T6；本报告只证明**发布侧**（资产、清单、签名、公网可达）全部就绪。

### 11.4 一次性修掉的发布侧坑

1. `Verify updater config` 步骤检查 `$env:TAURI_SIGNING_PRIVATE_KEY` 却没在 `env` 里注入 secret → 必然空值。
   已注入两个 secrets（只做非空判断，不打印），并补 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 非空校验。
2. 本地复现时设 `TAURI_SIGNING_PRIVATE_KEY_PATH` 会报「A public key has been found, but no private key」——
   bundler 只认 `TAURI_SIGNING_PRIVATE_KEY`（内容）。已写进 runbook §1.3。

## 12. 独立验证（第十二轮 verifier）

- 结论：**PASS**，P0 = 0。
- 实测（verifier 自己跑的数字）：`tsc --noEmit` 0；`npm test` **108 文件 / 1124 用例**；`design:check` **73 条**；
  `format:check`；`check:versions` 0.2.1；`npm run build`；`cargo test --lib` **6 passed**；GitHub CI 在 `36c5d34` 独立 success。
- 设计记录纪律：58 条记录用 `c827233` 旧全文逐字比对，只替换 status/reviewer 后是 HEAD 的**严格前缀**（58/58 通过）；
  `307eba9` 的 60 个文件全为 M（无 A/D）；`git log --diff-filter=D -- design/` 全历史 0；index 73/73 approved。
- 代码审查：`should_handshake` 不会锁死进程；`beforeInstall` 失败即中止安装；`rememberPassword=false` 全路径无明文；
  `credentials` 非 Tauri 不谎报；并用**破坏性实验**（把 `appStore` 的 `rotations` 改 `undefined` → 3 failed / 4 passed）证明新测试断言可失败，随后已还原。
- 发布侧独立核验：Release 4 资产、latest.json 公网 200、exe sha256 与 GitHub digest 一致、`.sig` 与 signature 逐字节相同、
  minisign keyid 与 `tauri.conf` 公钥一致、fixture 经 `prepareImport` 可导入（23 座 / 2485 块）。

### 缺陷处置

| 级别 | 项 | 处置 |
| --- | --- | --- |
| P1 | `real-device-acceptance.md` §12 脚本把仓库 owner 写成 `LeeeCm`（少一个 e）→ 第 2 步 404 | ✅ **已修**：改为 `LeeeeCm`，并加 `$ErrorActionPreference='Stop'`、每步状态码断言、`-cne` 失败即 throw（不再出现「失败后仍打印 SIG-MATCH」） |
| P2 | §12 脚本无 fail-fast，失败仍打印 SIG-MATCH 且 exit 0 | ✅ **已修**（同上） |
| P2 | 4 个文件超过 800 行：Today 766→947、MiniDeskToy 717→905、SettingsDialog 745→830、en.ts 774→806 | ⚠️ **接受并记录**：唯一原因是 `bb719e9` 的 Prettier 重排（`printWidth 100` 把长行拆开），**没有新增逻辑**；格式化前四个文件都 < 800。约定仍然有效：下次往这四个文件加逻辑时先拆分 |
| P2 | `36c5d34` 提交时文档已写「已出签名包并上传 latest.json」，但该次 Release run 实际失败 | ✅ 已在 §11.1 与真机清单 T6 表头写明「首次触发失败 → 修复后重跑成功」，不再有前后矛盾 |
| P3 | 部分文档数字陈旧（updater 10 例 / 104 文件 / 1090 用例 / 70 条） | ✅ 已更新为 12 例 / 108 文件 / 1124 用例 / 73 条 |
| P3 | `update.close()` 在安装成功后未调用 | ⚠️ 接受：安装成功即进程被安装器接管退出，句柄随进程回收；保持与已发布二进制一致，不在发布后改逻辑 |
| P3 | `credential_set("")` 不会删除旧条目 | ⚠️ 接受：前端只在密码非空时调用 set、清空走 `credential_delete`；保持与已发布二进制一致 |
| P3 | `QuitGate` 不复位（理论） | ⚠️ 接受：`begin_quit` 只发起一次且 1.5s 后必然 `app.exit(0)`，进程生命周期内不存在「握手后继续运行」的分支 |
| P3 | 自动同步只在设置页挂载期间运行 | ✅ **已修**（D-20261115-074）：同步控制器上移到应用级 `<SyncProvider>`，启动/定时同步与 keyring 迁移不再依赖设置页挂载；新增 4 例回归测试 |
| P3 | `release.yml` 空 `--notes` 在 PS 5.1 下会报「参数缺少值」 | ⚠️ 接受：当前触发总是带 notes；若将来要走空 notes，改用 `--notes-file` |
| P3 | 未独立验证：`tauri build` 本机复跑、真机 T6/T7/T8、§12.1 双 `--config` 起点包实跑、四主题视觉回归 | 如实声明：这些均需真机/密钥，已列入真机清单 |

## 13. verifier 处置后的复查（2026-11-14）

P1（§12 脚本仓库名少一个 e、无 fail-fast）不是「改个字符」就完事：这个脚本本来就是给人类照着敲的，
散落在 Markdown 里无法被门禁约束，改对一次下次还会漂。因此把**发布后自检做成了仓库里的脚本**：

- 新增 `scripts/check-release.mjs` + `scripts/check-release.test.mjs`（9 例纯逻辑单测）：
  `npm run release:check -- --version 0.2.1 [--download]`，11 项检查（Release 存在/非 draft/资产齐全/
  latest.json 200/version 一致/url 指向本 tag/`.sig` 与 signature 逐字节一致/安装包 HEAD 200/
  `--download` 时 sha256 与 GitHub digest 一致）。零依赖、纯 Node `fetch`，**不受 Windows PowerShell 5.1
  的 `Invoke-WebRequest` 首启限制影响**（该限制是本机实测踩到的真问题）。
- `real-device-acceptance.md` §12 改为「一条命令」，并记录最近一次实测的 11/11 结果。

### 复查后的门禁（当前 HEAD）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 错误 |
| `npm test` | **109 文件 / 1133 用例全绿**（+1 文件 / +9 例：check-release 单测） |
| `npm run design:check` | **73 条** |
| `npm run format:check` | 通过（新脚本已自动纳入 `scripts/**/*.mjs` 范围） |
| `npm run check:versions` | 0.2.1 |
| `npm run release:check -- --version 0.2.1 --download` | **11/11 通过** |
| `cargo test --lib` | 6 passed |

> 说明：本节的新增（自检脚本）发生在 `v0.2.1` 二进制构建之后，属**发布工具**而非产品逻辑，
> 因此不需要重发 0.2.1；已发布的安装包与当前 `src/`/`src-tauri/src/` 的产品代码仍然一致
> （本轮没有改动任何运行时逻辑）。

## 14. 0.2.1 之后（2026-11-15）：应用级自动同步

- **D-20261115-074（approved）**：修掉「不开设置页就永不同步」。根因不是猜测：`useSync()` 的三组
  effect（启动同步 / 定时同步 / keyring 迁移回填）挂在 `SettingsDialog` 里，而 `App.tsx` 是
  `{settingsOpen && <SettingsDialog/>}`。提交 `1b2e537` 声称的 `sync-on-launch` 实际未生效。
- 修法是**只提升挂载位置**：新增 `src/sync/SyncProvider.tsx`（应用级持有唯一实例，Context 分发），
  `main.tsx` 只在主窗口包 Provider（托盘窗口不挂，避免并发写同一份远端），`SettingsDialog` 改用
  `useSyncController()`；`useSync` 内部逻辑一行未改。类型归位到 `src/sync/types.ts`。
- 新增 4 例回归测试，关键一条是「只挂 Provider、不挂 SettingsDialog 也会在 2s 后触发启动同步」。
- 顺带修掉一个**日期相关 flake**：`Heatmap.test.tsx` 的 aria-disabled 用例在周日跑必然失败
  （13 周网格以本周结尾，周日没有未来日）。已固定系统时间到周三，断言不变。
- 门禁：`tsc` 0；`npm test` **110 文件 / 1137 用例**；`design:check` **74 条**；`format:check`；
  `build` index 428.91 kB（+0.29 kB，chunk 归属未变）；CI run 43617100269 **success**。


## 15. 0.2.2（2026-11-15 第十三轮）

### 15.1 版本与候选提交

- 版本：`0.2.1` → **`0.2.2`**（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` +
  `Cargo.lock` 的 blockhabit 包，`npm run check:versions` 通过）。
- 0.2.1 之后、0.2.2 之前的候选内容：应用级自动同步修复（D-20261115-074）与 Heatmap 日期 flake 修复。
- 0.2.2 发布候选新增：发布侧自检闭环（D-20261115-075）：

| 项 | 内容 |
| --- | --- |
| tag 钉住提交 | `gh release create --target "$GITHUB_SHA"`，tag 与 workflow checkout 提交严格一致 |
| 空 notes 兜底 | 发布说明写 `release-notes.md`，`--notes-file` 同时用于 Release 与 latest.json |
| 校验资产 | Release 新增 `BlockHabit_<ver>_x64-setup.exe.sha256`（GNU 风格；MSI 同样一份） |
| 流水线自检 | workflow 最后一步 `node scripts/check-release.mjs --version <ver> --download`（10×15s 重试），失败即红灯 |
| 自检增强 | `release:check` 增加 .sha256 资产存在 + 内容与 GitHub digest 一致；带 `--download` 共 13 项 |

### 15.2 门禁（发布候选，实测）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 错误 |
| `npm test` | **110 文件 / 1139 用例全绿**（check-release 单测 9 → 11 例） |
| `npm run design:check` | **75 条**（新增 D-20261115-075） |
| `npm run format:check` | 通过 |
| `npm run check:versions` | 0.2.2 |
| `npm run build` | 见发布后复测 |
| `cargo test --lib` | 见发布后复测 |

### 15.3 发布结果

- 待 v0.2.2 Release workflow 成功后回填（资产、latest.json、release:check 输出、tag 指向）。
