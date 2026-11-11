# 发布候选报告 — BlockHabit 0.2.0（2026-11-11）

- 基线：`main` @ 90d0180（63 条历史提交，未改动）
- 工作分支：`chore/release-prep`（**未 push、未打 tag、未改版本号**；版本保持 0.2.0）
- 结论：**可发布候选（Release Candidate）**。Lead 门禁全绿 + 独立 verifier PASS（P0=0 / P1=0）。
- 性质：本地优先、无账号、无遥测；本轮不新增依赖、不改视觉语言。

## 1. 提交清单（main..HEAD，共 23 条；本报告由第 23 条 docs 提交提交，表格列出其之前的 22 条）

### 1.1 任务 A：历轮成果 Git 基线（8 条）

| # | hash | 主题 |
| --- | --- | --- |
| A1 | 24c9bdf | chore: 建立设计中枢、协作规则与工程配置 |
| A2 | a5fe74e | feat: 0.2.0 基础体验与工程优化 |
| A3 | 2aaa37e | feat: 打开动机与可发现性（今日简报/模板/晚间提醒/页面提示） |
| A4 | a10dc48 | feat: Wave1 桌面摆件、落成年鉴与 WebDAV 自检 |
| A5 | 82a5586 | feat: Wave2 完整档案包、建筑档案与专注陪伴 |
| A6 | 4229883 | feat: B1 内容版本门与 6 座扩展蓝图（18 座 / 1985 块） |
| A7 | 6d72d7e | feat: 18 座蓝图逐座材质配色（D-20261111-067） |
| A8 | 5bbcf1e | docs: 更新 CHANGELOG 至 0.2.0 与 2026-11-11 各轮成果 |

### 1.2 任务 B/C：技术收尾与发布增强（13 条）

| # | hash | 主题 |
| --- | --- | --- |
| 1 | cb42667 | refactor(render): 抽取 modelStage 公共等距舞台（B2） |
| 2 | 5dc8991 | refactor(settings): SettingsDialog 拆分 + 档案 manifest 版本语义（B3） |
| 3 | d0fc589 | feat(sync): WebDAV 自检取消 + rememberPassword + 密码 DOM 缓解（B1） |
| 4 | 605f075 | feat(focus): 今日页专注入口 + 多会话规则 + 通知/托盘可测化（B4） |
| 5 | b358741 | feat(gallery): 建筑档案移动端 BottomSheet + 拍立得落成日 + 性能测量（B5） |
| 6 | 283fb2c | chore(test): 测试/工程卫生收尾（B6） |
| 7 | 4139aa8 | feat(i18n): 补齐 B/C 收尾文案（zh/en） |
| 8 | 9824b00 | feat(settings): 内容路线/关于分组（C2） |
| 9 | ef401d9 | docs(design): D-068 自由装饰模式 + B/C 记录履历与设置表面更新 |
| 10 | c75c8a6 | docs(release): C4 自动更新/keyring 评估 + C3 内容包 v3 方案 + C6 真机验收清单 |
| 11 | 55f43b6 | refactor(storage): archiveZip 字节/压缩层拆分（archive.ts 839→587 行） |
| 12 | 2a87fb1 | chore(ci): 版本号一致性门禁（C4 零依赖项） |
| 13 | 2f30844 | test(blueprints): 内容包脚手架校验（C3，不生产内容） |

> 说明：任务 A 是把工作区中历轮（2026-11-10/11 的六轮）未提交成果按主题切片；跨轮次共享文件
> 无法重建独立中间态，因此**单条中间提交不保证单独可编译**（各 commit body 已说明），但 HEAD
> 完整可构建、可测试。回滚建议：按序列反向 `git revert`，或以分支整体回退（`git reset --hard main`
> 属人类决策，AI 不执行）。

## 2. 门禁结果（最终代码实测）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 错误 |
| `npm test` | **102 文件 / 1008 用例全绿**（全部源码测试；历史 `.tmp-verify-a2` 2 个验证脚本已排除；新增版本校验 6 例 + 内容包脚手架 12 例） |
| `npm run design:check` | **69 条记录通过**（9 approved D-059…-067 + 60 proposed，含 D-068/D-069） |
| `npm run format:check` | 通过 |
| `npm run check:versions` | 通过（三处构建版本均 0.2.0；已接入 CI） |
| `npm run build` | 成功；主入口 414.61KB（gzip 127.44KB）、CSS 252.17KB（gzip 108.68）、MiniDeskToy 懒加载 13.45KB（gzip 3.48） |
| `npm run tauri build -- --no-bundle` | 成功（release exe 20.73MB，Rust 编译 1m36s） |
| `git status` | 干净（仅 .gitignore 忽略项） |
| 产物 | `dist` 212 文件 / 5.56MB；未提交 dist/.tmp/target |

## 3. B 类技术收尾完成情况

| 项 | 状态 | 交付/证据 |
| --- | --- | --- |
| B1 A3 WebDAV（取消 / rememberPassword / 密码 DOM / 统一 handler） | ✅ 完成 | diagnose 取消 4 例、配置落盘 5 例、WebdavPanel 4 例；浏览器实测密码不回填、关闭记住后 localStorage 无密码 |
| B2 A2 年鉴（modelStage / 复制降级） | ✅ 完成 | modelStage 20 例、yearbookCanvas 20 例；四表面 25 张 canvas PNG sha256 全等、RGBA diff=0 |
| B3 A4 档案包（manifest 语义 / data-testid / SettingsDialog 拆分） | ✅ 完成 | SettingsDialog 781 行（<800）、WebdavPanel 547、ArchiveDataPanel 198；archiveFormatVersion+appContentVersion、旧档兼容；archive.ts 587 / archiveManifest 212 / archiveZip 263 行 |
| B4 B2 专注（今日入口 / 多会话 / 通知托盘可测化 / 延长同步） | ✅ 完成 | focusSession 31、MiniDeskToy 14、HabitRow.focus 4；浏览器四主题入口与多会话验证 |
| B5 B3 建筑档案（移动 BottomSheet / 落成日 / 性能） | ✅ 完成 | completionDateOfBuilds 5 例、canvas 7、modal 7；190 块实测全部在 16.7ms 帧预算内 |
| B6 测试/工程卫生 | ✅ 完成 | vitest 排除 .tmp、format:check、过期注释修正；源码测试文件数=100=npm test 文件数 |

## 4. C 类产品/发布增强完成情况

| 项 | 状态 | 说明 |
| --- | --- | --- |
| C1 自由装饰模式 | ⏸ **明确暂停（待人类确认）** | 已新增 D-20261111-068（proposed，reviewer=pending）最小方案；按 AGENTS §1 新机制需 approved 后才实现，本轮不写代码 |
| C2 设置页「内容路线/关于」 | ✅ 完成 | AboutPanel 动态 18 座/1985 块/contentVersion 2、年度扩建节奏、升级说明、本地优先；zh/en；3 例测试 |
| C3 下一批内容包 | ⏳ 评估 + 脚手架已交付，内容待人类决策 | docs/release/content-pack-v3-assessment.md；`contentPackKit.ts`（校验/规划纯函数）+ 12 例；未生产内容、未改 CONTENT_VERSION |
| C4 自动更新/签名/keyring | ⏳ 零依赖项完成；依赖类需人类批准 | docs/release/updater-and-keyring-assessment.md；`npm run check:versions` + CI、D-069 手动检查更新设计记录（proposed）；未装依赖/未生成密钥/未改存储格式；rememberPassword 不落盘已落地 |
| C5 性能/质量基线 | ✅ 完成 | 首屏/切页/建造 190/展台 18/图鉴 18/年鉴导出全部在帧预算内，无功能性回退；详见 .tmp-c5/report.md |
| C6 真机验收清单 | ✅ 交付 | docs/release/real-device-acceptance.md（操作步骤+期望结果+自动化证据+执行记录表） |

## 5. 独立验证（verifier，task-6）

- 结论：**PASS（发布候选可用）**，P0=0 / P1=0 / P2=2（已处置）/ P3=3（已修正/记录）。
- 亲自复跑：tsc 0、npm test 100/990、design:check 68、format:check、build；浏览器实测密码 DOM、
  rememberPassword、今日专注入口四主题、移动端档案 BottomSheet + 嵌套拍立得 Esc 分层、拍立得
  落成日=max(placedAt)、0 console error；Git/记录卫生核对通过。
- P2-1（单条中间提交不可编译）：跨轮次主题切片的已知限制，见 §1 说明；不阻断 HEAD。
- P2-2（行数口径）：已再拆 archiveZip.ts，最终 archive.ts 587 行（<800）。
- P3：真机清单覆盖表用例数已按实测更新；两处合并主题已在 body 说明；RECORDS/CHANGELOG EOF 换行已修。
- 报告：`.tmp-verify-final/report.md`（23KB + 20 张截图，不提交产物）。
- 续作说明（2026-11-11）：verifier 验证对象为前 20 条提交；后续新增 2 条零依赖提交（版本校验、内容包脚手架）+ 1 条 docs 提交，均为纯增量、不改运行路径，Lead 已复跑全部门禁（102/1008、69 条、check:versions、build）。

## 6. 仍 blocked / 需要人类处理

1. **C1 D-068 自由装饰模式、D-069 手动检查更新入口**：审核通过（approved）后才实现。
2. **C4 自动更新/keyring**：是否批准新增 updater/process 依赖、签名密钥生成与保管、发布端点、
   CI secrets、Windows 代码签名预算；keyring 是否批准 Rust keyring crate。未批准前保持现状。
3. **C3 内容包 v3**：确认主题/座数/块数/节奏后，新增 approved 设计记录再生产内容。
4. **C6 真机验收**：多屏/HiDPI、A4 真实落盘/取消/reveal、真实 Nextcloud/坚果云/群晖、
   25 分钟专注+系统通知+托盘、100 块时间线——按清单在真实 Windows 设备执行并记录。
5. **远程发布**：本轮未 push、未打 tag；是否推送/打 tag/发布由人类决定。
6. **其余 60 条 proposed 设计记录**：按 design/REVIEW-QUEUE.md 分组审核。

## 7. 复现

```
git switch chore/release-prep
npx tsc --noEmit && npm test && npm run design:check && npm run format:check && npm run check:versions
npm run build
npm run tauri build -- --no-bundle
# 浏览器/性能：见 .tmp-c5/report.md 与 docs/release/real-device-acceptance.md
```