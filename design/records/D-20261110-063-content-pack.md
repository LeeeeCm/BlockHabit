---
id: D-20261110-063
date: 2026-11-10
title: 内容二期：免费扩展蓝图包与内容版本门
status: approved
owner: lead
surface: [build, gallery, stats, settings]
axioms: [A1, A6]
files: [src/logic/blueprints/manifest.ts, src/logic/blueprints/generators.ts, src/logic/blueprints/index.ts, src/logic/blueprints/content.test.ts, src/logic/blueprints/index.test.ts, src/logic/blueprints/blueprints.test.ts, src/logic/builds.capacity.test.ts, src/logic/blockHints.test.ts, src/types.ts, src/storage/adapter.ts, src/store/serializeState.ts, src/store/appStore.ts, src/sync/merge.ts, src/sync/useSync.test.ts, src/storage/contentVersion.test.ts, src/components/BlueprintThumb.tsx, src/components/BlueprintThumb.test.tsx, src/components/GalleryDialog.tsx, src/components/GalleryDialog.test.tsx, src/pages/Build.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, CHANGELOG.md, design/SURFACES.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

12 座 1385 块按 1 习惯≈2 块/天约 693 天封顶；全落成后仍诚实提示不再掉块。有限内容是结构差异（并非缺陷），但必须正面回答「第 191 天之后」。内容包的最大技术难点不是画蓝图，而是旧客户端/同步遇到未知 blueprint id 时的数据安全。

## 设计决定

建议 0.5.0 随安装包内置「第一批 6 座」免费扩展蓝图（约 400–600 块），不做付费 DLC（签名/更新/商店就绪后再评估）。新增 `AppState.contentVersion`：旧客户端读到更高版本时挂起持久化并提示升级（复用 needsUpgrade 机制）；未知 blueprint 的数据保留不参与渲染/容量，同步重建保留未知记录；图鉴/容量/统计全部动态取 `blueprintOrder.length`。全落成后提供自由装饰模式作为补充，不做主线。发布节奏一年一更，设置页「关于」诚实说明路线。详见方案 §3.5。

## 取舍与被否方案

- 否掉付费 DLC（本轮）：需要商店/支付/签名/退款，且透支本地优先信任。
- 否掉用无限任务掩盖内容终点：那是竞品路径，不是 BlockHabit。
- 否掉删改现有 12 座蓝图：AGENTS 铁律与用户资产。
- 否掉运行时联网下载内容：违背 A7 与 CSP。

## 影响面

蓝图注册表与生成器、状态字段与 normalizeState、投影重建与同步合并、图鉴/建造/统计总数动态化、兼容矩阵测试、新美术与 i18n。工作量 L。

## 验收标准

6 座蓝图生成器单测；兼容矩阵 5 项（旧×新、新×旧、双端同步、回滚安装）；总数/图鉴/容量/展台/年鉴动态化无硬编码 12；升级与同步自动化测试；四主题截图与性能基线不回退；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §5）：确认必须新增可选 `contentVersion`（不升 schemaVersion），门禁必须在 sanitize **之前**（否则旧客户端静默丢未知 blueprint 的 builds/completed 并落盘）；需同步改 5 个代码点（normalize/loadAndMigrate/三处白名单/merge carry），并做 5 组兼容矩阵（旧×新、新×旧、保存后回旧、双端同步、降级安装）；v1 采用「门禁 + 旧客户端只读不可用」，「保留未知只读兼容」作为 phase 2 可选（+2–3 人日）。
- 2026-11-10 B1 技术前置实现（lead）：新增 `logic/blueprints/manifest.ts`（CONTENT_VERSION=1、base pack、normalize/isFuture）；`AppState.contentVersion` 可选字段；adapter 在 sanitize **之前**用 needsUpgrade 拦截未来内容版本（本地加载 + prepareImport/validateState），serializeState / appStore 默认值 / merge 取 max 三处白名单接通；兼容矩阵测试 6 组（旧档补版本、未来档 needsUpgrade 且 raw 不变、导入/同步拒绝且 PUT=0、双端 merge max、本地存储不改写）。**内容包本体（6 座）与图鉴/容量/解锁动态化未做**，待内容/定价/分发确认；记录仍 proposed。
- 2026-11-10 独立验证（verifier / task-18）：**PASS，P0/P1/P2=0**；浏览器 14/14（future contentVersion 本地加载 needsUpgrade、raw 逐字节不变、改设置/打卡后仍不写盘、同步 0 请求、旧档补写 1、merge max、manifest 与 blueprintOrder 一致）；3 个 P3 为文档/环境边界（Tauri raw 不变静态核对、真实 WebDAV 未接、本 files 元数据已按实际改动校正）。内容包本体仍为后续工作。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。
- 2026-11-11 内容本体实现（yearbook-impl + guide-impl）：CONTENT_VERSION=2；6 座免费扩展蓝图（treehouse 115 / greenhouse 83 / clocktower 99 / bridge 99 / observatory 90 / library 108，合计 594；全量 18 座 1979 块，基础 12 座逐块未改）；图鉴 18 卡、锁定剪影、解锁顺序验证；内容测试 16 例、全量 93 files / 904 tests。B1 完整实现（技术前置 + 内容本体）。
- 2026-11-11 独立验证（task-21）：**PASS，P0/P1/P2=0**；旧 12 座与 HEAD 逐块一致、新 6 座 594 块/40–120、18 卡与容量动态、旧档补写 2、未来 v3 needsUpgrade+raw 不变+同步 PUT=0。修复其 P3① 语义：显式 contentVersion=1 读入/保存也升为当前（避免新客户端建 v2 建筑却保留 1 被旧端误判可读）；task-22 聚焦复验。
- 2026-11-11 聚焦复验（task-22）：**PASS，P0/P1/P2=0**；显式 v1 读档→2、保存/导出/导入均 2、无字段旧档→2、未来 v3 仍 needsUpgrade+raw 不变+同步 0 请求、merge 不写低。修复其 P3：merge 双端显式旧版本也至少写当前版本；清理 ShowcaseScene「12 座」旧注释。B1 内容包完成。
- 2026-11-11 数量校正：色彩系统为 treehouse +4 树冠、bridge +2 灯柱，扩展包最终 600 块、全量 18 座 1985 块；README/CHANGELOG 已同步。
- 2026-11-11 补充记录：自由装饰模式最小方案另立 D-20261111-068（proposed，待人类确认后实现），不新增持久化字段、不做沙盒经济；本轮不写代码。
- 2026-11-11 C2 实现（lead）：设置页新增「内容路线」分组（`src/components/AboutPanel.tsx`，属 D-063 §3.5.5 approved 范围）——动态展示当前蓝图数 / 积木数 / contentVersion（从 `blueprintOrder` 与 manifest 计算，不硬编码）、年度免费扩建节奏（随安装包内置、不联网下载、不额外收费）、跨设备升级说明（更高内容版本的存档会让旧设备拒绝读取并暂停保存）、本地优先与无遥测承诺；zh/en 齐全，不写死未来内容包日期。`design/SURFACES.md` §6 同步更新，新增 AboutPanel 3 例测试。
- 2026-11-11 B3 收尾（b3-settings）：档案包 manifest 不再复用易混淆的 `contentVersion` 字段名——新增 `archiveFormatVersion`（档案**格式**版本，保持 1；旧 manifest 的 `contentVersion` 作为兼容读取别名）与 `appContentVersion`（写出当前 `CONTENT_VERSION`，说明导出时的内容代际）；缺失 `appContentVersion` 的旧档读取时回退为当前版本（仅作人读提示，不参与导入判定）。档案包 README 生成文本新增中英「版本字段怎么读 / Version fields」小节；新增 `parseArchiveManifest` 与 7 例测试（旧档回退、新档 round-trip、非法 manifest 拒绝、未来格式版本原样解析），导入路径（state JSON）不受影响。
