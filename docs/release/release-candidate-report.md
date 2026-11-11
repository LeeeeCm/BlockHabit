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