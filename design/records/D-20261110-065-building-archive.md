---
id: D-20261110-065
date: 2026-11-10
title: 建筑即编年史：图鉴里的建筑档案卡
status: approved
owner: lead
surface: [build, gallery]
axioms: [A2, A4, A6]
files: [src/logic/buildingArchive.ts, src/logic/buildingArchive.test.ts, src/components/BuildingArchiveModal.tsx, src/components/GalleryDialog.tsx, src/render/buildingArchiveCanvas.ts, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en.ts, design/SURFACES.md]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

每座建筑落成后有拍立得、铭言、图鉴缩略图，但没有一处回答「这座建筑是哪一年、由哪些天组成、当时写了什么」。打卡随笔存在于手账长廊，和建筑是两套界面。

## 设计决定

图鉴中点击已落成建筑打开「建筑档案卡」：等距大图 + 建筑名 + 落成日期 + 第 N 座；数据（总块数、耗时天数、投入最多习惯、全勤/奖励块数）；时间线（首块、每 25%、最后一块，点击看当天打卡与随笔，复用 BrickInspect 数据）；铭言可编辑；底部拍立得与保存档案卡 PNG。全部从 builds/checkIns/foundationNotes 派生，不新增持久化字段。与 A2 分工：年鉴按年总览，档案卡按建筑专辑，共用画布能力。详见方案 §3.7。

## 取舍与被否方案

- 否掉给每块积木写小传：输入成本高且与随笔重复。
- 否掉新增第三个常驻 tab：信息架构膨胀。
- 否掉 v1 新增 buildingStory 字段：先证明使用再考虑「精选记忆块」（需同步设计）。

## 影响面

新增派生逻辑与档案卡弹窗、图鉴入口、画布复用、i18n、SURFACES；无数据迁移。

## 验收标准

派生逻辑单测（落成日/耗时/投入最多习惯/关键块/空数据）；图鉴→档案卡→拍立得/保存 PNG 全流程；键盘可达与 Esc；100 块建筑时间线流畅（分段）；四主题 zh/en；tsc/test/design:check 通过。

## 变更履历

- 2026-11-10 created (lead)
- 2026-11-10 技术校订（依据 technical-notes §7）：落成日必须由 `builds.placedAt` 最大值推导（`completedBlueprintIds` 合并后按 id 排序，不能当落成顺序）；抽 `blockMetaIndex`（与 BuildScene 同源）复用 BrickInspectPopover 的「块序位→打卡元数据」O(1) 映射；零新字段；查询 O(n) 亚毫秒；与 A2 共用 selectors/画布。
- 2026-11-10 人类在对话中确认按路线图进入 Wave 2（记录仍保持 proposed，状态更新由人类在台账完成）；Wave 2 实现开工。
- 2026-11-10 实现（guide-impl）：`logic/buildingArchive.ts` + 19 tests、`render/buildingArchiveCanvas.ts`（640×880@2x 卡 / 640×260@2x 舞台）、`BuildingArchiveModal`、Gallery 已落成卡片新增「档案」pill；关键块 5 锚点、铭言内联编辑、保存 PNG 1280×1760、嵌套拍立得 Esc 逐层关闭、四主题 × zh/en 验证。**交互取舍**：为保留既有「点卡片 = 选择蓝图」不回归，档案入口用角落 pill，而非记录原设想的「主区域开档案、角落选择」；如人类希望互换，改动很小。
- 2026-11-11 人类确认（LeeCM）：状态 proposed → approved。
- 2026-11-11 B5 收尾（b5-archive）：档案卡移动端接 BottomSheet（isMobile 分支，title/footer 保留、Esc 逐层关闭；嵌套拍立得用零尺寸 stacking wrapper z-index 1001 抬到抽屉之上，玻璃叠影取舍见 .tmp-b5/report.md §2）；档案舞台 canvas 加 data-testid="archive-stage"、离屏档案卡画布加 data-testid="archive-card-canvas"；拍立得落成日改回 max(placedAt) 本地日期（复用 logic/buildingArchive 新纯函数 completionDateOfBuilds，无有效日期显示「不可考」/Unknown，修掉原先 new Date() 今天 + UTC 日期的双重错误）；100+ 块（castle 190）实测：打开档案卡 40–45ms、舞台 190 块绘制 0.9–1.2ms/380 次 blit、关键块切换 mean 7.7–7.9ms（p95 ≤10.7ms）、滚动 320fps 0 超帧、档案卡 PNG 15–17ms，全部在 16.7ms 帧预算内；新增 buildingArchiveCanvas.test 7 例 + BuildingArchiveModal.test 7 例，logic 单测 24 例，tsc 0 错。证据 .tmp-b5/。