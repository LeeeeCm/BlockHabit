# BlockHabit 设计中枢方案（Design Hub，详细设计）

- 日期：2026-11-10
- 触发需求：所有设计必须从**一个统一的文件夹/文件**开始查看；每次设计完成后写回同一处；**删除需人工审核确认**。
- 关系：本文是「过程规则」方案，与 `2026-11-10-blockhabit-optimization-plan.md`（「内容优化」方案）互补；历史规格保持只读。
- 硬约束：**不改变现有视觉语言**。本文全部内容为流程与文档治理，不新增任何界面元素。

---

## 0. 问题：设计知识为什么散成了四份

2026-11 时项目里的设计知识分散在四处，且互相漂移：

| 位置 | 它其实是什么 | 问题 |
| --- | --- | --- |
| `docs/superpowers/specs/*.md`（4 份规格 + 3 份计划，约 12 万字符） | **历史快照** | 大量条目已实现或已推翻，新人无法判断哪条还算数 |
| `src/theme.css` / `src/components/ui.css`(1280 行) / `src/render/iso.ts` | **事实上的规范** | 没有文字说明「为什么」，改一个数值不知道连带影响什么 |
| `design/logo/` | 品牌资产原件 | 无使用规则（何时用 mark / wordmark / 深浅版） |
| 仓库根 | 无 `AGENTS.md` | AI 代理每次从零读代码猜风格，于是反复出现「纸白主题漏令牌白屏」「硬编码 #f59e0b 造成两种琥珀」 |

典型事故复盘：2026-10-03 评审的 P0 缺陷（纸白主题缺 `--block-right`/`--block-ghost` → canvas 抛异常整树白屏）**不是能力问题，是规则缺位**——新增主题时没有一处「必须检查」的清单。

## 1. 目标与非目标

**目标**
1. 全项目只有一个设计入口：`design/README.md`。任何人/AI 做设计前的第一件事是读它。
2. 每次设计沉淀为一条**不可变记录**（`design/records/D-YYYYMMDD-NNN-*.md`），登记进 `RECORDS.md` 与 `index.json`。
3. 删除是**高成本且可审计**的动作：状态位优先（`deprecated`/`superseded`），物理删除必须过 `APPROVALS.md` 的人工审核。
4. 规则可被**机器执行**：`npm run design:check` + vitest 守门，不再依赖人记得。

**非目标**
- 不做 wiki / 外部知识库（必须与代码同仓、可 grep、可 diff）。
- 不重写历史 spec（它们是时间证据，重写等于销毁证据）。
- 不引入文档生成工具链（无 Docusaurus/VitePress；纯 markdown + 一个零依赖 node 脚本）。

## 2. 方案

### 2.1 目录结构

```
design/                     ← 唯一设计入口（原 design/logo 保留，升格为品牌资产子目录）
├─ README.md                唯一入口：A1–A7 设计公理 / 文件地图 / 五步流程 / 删除铁律
├─ AESTHETIC.md             设计理念：三个隐喻、黑白为骨的五个理由、参考谱系、明确不做的事、张力与取舍
├─ TOKENS.md                四主题令牌矩阵 + 圆角/字体/间距/阴影档位 + 点缀色红黑榜
├─ ART.md                   等距投影、积木三面着色、光照、接触阴影、落块物理、精灵缓存
├─ SURFACES.md              每个界面表面的结构骨架、尺寸、视觉纪律、已知例外
├─ VOICE.md                 语气、中英术语表、标点与数字格式、i18n 结构
├─ RECORDS.md               记录台账（一条设计一行，含状态）
├─ APPROVALS.md             删除 / 推翻公理的人工审核台账
├─ index.json               机器可读索引（脚本维护）
├─ records/                 每条设计一个文件，append-only
└─ logo/                    品牌资产原件（原有）
```

### 2.2 三条不可动摇的规则

**规则一 · 唯一入口**
`design/README.md` 是唯一入口，且它必须自包含到「能在 5 分钟内独立找到该读哪一节」。它承载：设计公理 A1–A7（每次开工逐条自检）、文件地图（什么改动必须读哪个文件）、五步流程与记录模板、删除铁律。
仓库根 `AGENTS.md` 把它写进代理规则：设计改动前必读，未登记的设计改动视为未完成。

**规则二 · 记录先于代码（append-only）**

```
proposed ──(人类审核)──> approved ──(实现并验证)──> implemented
   │                        │                        │
   │                        └────(被新设计取代)──────> superseded
   └──(人类否决)──> revoked                                 │
                                                           ▼
                                                     deprecated
```

- 记录一旦写定，**只允许改两件事**：`status` 与「变更履历」。正文不可改写；改了主意就新增一条并把旧的置为 `superseded`。
- `approved` / `implemented` / `revoked` **只能由人类设置**（`reviewer` 必须填真实姓名，不能是 `pending`），校验器强制。
- 编号 `D-YYYYMMDD-NNN` **永不复用**。

**规则三 · 删除需人工审核**

1. AI 禁止删除 `design/` 下任何文件/章节/表格行。
2. 淘汰设计 = 改状态（`deprecated`/`superseded`），全文保留。
3. 物理删除流程：`APPROVALS.md` 提 `pending` → **人类**填 `approved` + 姓名 + 日期 + commit → 删除 → 填 `done` 并在原位留墓碑。
4. 同一纪律覆盖设计性资产：`design/logo/**`、`src/theme.css` 令牌、`src/logic/blueprints/generators.ts` 建筑数据、`src-tauri/icons/**`。

### 2.3 机器执行：`scripts/design-ledger.mjs`

零依赖 node 脚本，`npm run design:check` 调用，同时被 `src/designLedger.test.ts` 引入（因此进入 `npm test`）。检查项：

| # | 检查 | 失败含义 |
| --- | --- | --- |
| 1 | `design/` 核心文件齐全；`AGENTS.md` 存在且引用 `design/README.md` | 入口被破坏 |
| 2 | 每条记录文件名匹配 `D-YYYYMMDD-NNN-slug.md`，front-matter 字段齐全，`id` 与文件名一致，`date` 与 `id` 日期一致 | 记录不可信 |
| 3 | `status` ∈ 枚举；`approved/implemented/revoked` 时 `reviewer !== pending` | 有人绕过人工审核 |
| 4 | id 全局唯一、正文 ≥120 字 | 记录是空壳 |
| 5 | `index.json` ↔ `records/` 双向一致，状态不陈旧 | 索引漂移 |
| 6 | `RECORDS.md` 台账包含每条 id | 台账漏登 |
| 7 | **对照 `git ls-tree HEAD design/` 检测删除**：被删文件必须在 `APPROVALS.md` 有 `approved`/`done` 记录 | 静默删除设计记忆 |

`--fix` 依据 `records/` 重建 `index.json`（只重建索引，不碰台账散文）。

已实测：把 `design/logo/mark-light.jpg` 临时移出 → 校验器报「检测到未审批删除：design/logo/mark-light.jpg」并退出码 1，移回后恢复通过。

## 3. 与既有文档体系的关系

| 文档 | 定位 | 与设计中枢的关系 |
| --- | --- | --- |
| `design/**` | **现行规范 + 决策台账** | 唯一需要「持续维护」的地方 |
| `docs/superpowers/specs/**` | 时间快照（某次设计/优化的详细方案） | 只读；新方案新增文件，不改旧文件 |
| `docs/superpowers/plans/**` | 实施计划 | 只读 |
| `AGENTS.md` | 代理规则入口 | 强制把设计流程与删除铁律写进代理行为 |
| `README.md` | 人类第一入口 | 设计相关段落指向 `design/README.md` |

## 4. 落地清单（本次已完成）

| 交付物 | 状态 |
| --- | --- |
| `design/README.md`（入口 + 公理 A1–A7 + 流程 + 删除铁律） | 完成 |
| `design/AESTHETIC.md`（理念、边界、张力、现状强度评估） | 完成 |
| `design/RECORDS.md` + `design/APPROVALS.md` + `design/index.json` | 完成 |
| `design/records/D-20261110-001-design-hub-bootstrap.md` | 完成（proposed） |
| `design/TOKENS.md` / `ART.md` / `SURFACES.md` / `VOICE.md` | 完成（代码事实抽取） |
| `AGENTS.md` | 完成 |
| `scripts/design-ledger.mjs` + `src/designLedger.test.ts` + `npm run design:check` | 完成 |
| `README.md` 设计段落改写 | 完成 |

## 5. 验收

1. `npm run design:check` 通过（记录全登记、状态合法、无未审批删除）。
2. `npm test` 全绿（含 `src/designLedger.test.ts`），`npx tsc --noEmit` 零错误。
3. 人为删除一条记录且不写审批 → 校验失败并指名被删记录（已实测）。
4. 人工走查：让一个没读过本仓库的人按 `design/README.md` §0 的 60 秒流程，能在 5 分钟内回答「我要改活跃色该读哪一节、改积木阴影该读哪一节」。

## 6. 取舍与风险

1. **流程有成本**：每次视觉改动多一次写记录。取舍：这是需求明确要求的（人工审核），且记录本身是后续优化的证据链。低频改造（每天不足 1 次）可接受。
2. **删除检测依赖 git 历史**：从未提交过的记录被删无法检测（`git ls-tree HEAD` 不含它）。缓解：记录必须在同一次提交里入库；`AGENTS.md` 明令提交前跑 `design:check`。
3. **与历史 spec 双轨**：存在「读旧 spec 得到过期结论」的风险。缓解：`design/README.md` §2 文件地图明确标注旧 spec 为「时间快照，只读」，且 `RECORDS.md` 记录会标注 `supersedes`。
4. **状态位可被 AI 乱改**：AI 可以把 `approved` 改成 `deprecated` 规避审核。缓解：后续接 CI 时校验「状态变更只能由人提交的 commit 引入」（当前靠 review 纪律，列入优化方案批次）。
5. **`index.json` 手工改会漂移**：缓解：`--fix` 一键重建，校验器对比状态陈旧即报错。

## 7. 后续可扩展（不在本次）

- 接 CI：`design:check` + `tsc --noEmit` + `npm test` 作为 PR 门禁（项目当前无 CI，见优化方案）。
- 记录与代码联动：记录里登记 `surface`，改动对应文件时由脚本提示「记得更新/新增记录」。
- `design/logo/README.md`：品牌资产使用规则（最小尺寸、安全区、深浅版适用场景）。