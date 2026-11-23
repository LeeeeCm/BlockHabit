---
id: D-20261124-081
date: 2026-11-24
title: 质量专项：周频打卡死点 / 彩色积木夜间环境光 / 图鉴缩略图 / 文案精简
status: proposed
owner: lead
surface: [today, build, gallery, stats, settings]
axioms: [A1, A2, A3, A4, A5, A6]
files: [src/logic/checkin.ts, src/components/HabitRow.tsx, src/components/habitrow/HabitRowFooter.tsx, src/components/habitrow/HabitRowHeader.tsx, src/pages/today/TodayHabitSections.tsx, src/pages/Today.tsx, src/pages/today/TodayEmptyState.tsx, src/components/MiniDeskToy.tsx, src/render/isoColor.ts, src/render/isoCube.ts, src/components/BlueprintThumb.tsx, src/components/GalleryDialog.tsx, src/components/ui-cards.css, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/today.ts, src/i18n/locales/en.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

用户报告三类问题：

1. **任意时段打卡的健身无法成功打卡**。根因不是时段：周频（如每周 3 次）配额满了以后，
   卡片 `done` 仍按「今天有打卡」判定，于是继续显示待打卡；点击被 `canCheckInHabit` 以
   `weekly-full` 拒绝，界面静默返回。今日已打卡但周配额未满时同样静默。头部完成计数
   与卡片状态因此互相矛盾。
2. **建造页夜灯没有实际效果**。蓝图积木带自定义 `color` 时，`drawCubeBody` 直接走
   `deriveShadingForColor()`，完全不经过 `applyAmbientLighting()`；默认蓝图均为彩色积木，
   所以夜灯只在主题灰块上生效。ART §10 已写明「环境光只改变明暗，不改变色相」，代码未兑现
   （D-20261110-017 将其记为后续独立条目，本记录执行该后续）。
3. **图鉴缩略图**：固定 132×92 画布比卡片内容宽（约 129px）更宽，模型照片溢出圆角外框；
   建造中的建筑仍显示完整蓝图；画布白底与卡片底色不一致、未居中。

另按项目负责人要求执行一次文案精简：砍掉标语、提示文字与次要标签；界面若离开解释就不成立，
应改布局而不是加提示。

## 设计决定

1. **完成态同口径**：新增纯函数 `habitDoneOnDay`（custom 休息日除外，其余 = `habitMetOnDay`）。
   今日卡片 `done` 改用它；周频配额满即完成，与头部计数、统计页、全勤卡一致（A6）。
2. **周频状态阶梯**：配额满 → 绿勾 + 静态「本周 3/3」；今日已打卡未满 → 墨色勾 +
   「今日已打卡 · 本周 1/3」；未打卡 → 待办 + 无胶囊；休息日 → 「今日免战」。
   只有存在今日打卡时才可撤销。
3. **被拒必反馈**：`HabitRow` 增加 `onBlocked(reason)`，`already` / `weekly-full` 由今日页 toast
   说明；桌面摆件快捷打卡同样检查 `reason`，失败不播庆祝音、不显示成功文案。
4. **环境光进入自定义配色**：`IsoPalette` 增加可选 `tone`（仅非正午时段），
   `deriveShadingForColor(color, tone)` 按同一乘数表调整基色再过原有明暗阶梯，
   暗底保留 `floorContrast` 地板；缓存键加入 tone。正午严格恒等，色相不变（ART §10）。
5. **图鉴**：画布响应式 + 透明底 + 居中；`BlueprintThumb` 新增可选 `placedCount`，
   建造中只画前 N 块（`nextSlot` 语义），取景/地基仍用完整蓝图，构图稳定且不出框；
   卡片内距 14/12 → 12/10。
6. **文案精简**：删除 TodayBrief、GuideTip/guideTips、空态三步引导与口号、模板标题/提示、
   卡片 meta 的时段与「瞬时打卡」、底部「点击完成打卡」胶囊；对应 i18n 键三处同步删除。
   设置页功能性说明保留（解释有歧义的开关，不是标语）。
7. **今日页去掉每分钟轮询**：问候语随 TodayBrief 删除，连击计算改用 `parseKey(day)`。

## 取舍与被否方案

- 否决「周频只在今天打卡时才算完成」：会让配额完成后的一周内卡片天天可点、天天失败，
  正是本次 bug；也违背头部计数。
- 否决「给周频已完成卡片加提示气泡」：提示不是状态，仍需用户点击才发现；直接显示完成态更诚实。
- 否决「自定义配色不参与环境光，另做夜间叠色层」：会引入第二套打光与额外绘制状态；
  乘数进入 `deriveShadingForColor` 与主题块共用同一张光照表，符合 A3。
- 否决「图鉴建造中用完整蓝图包围盒取景」：会让早期几个块缩在底部，虽然构图稳定但不像
  「当前样子」；改为只画已落块并以其取景，同时保留完整地基。
- 否决「保留 GuideTip 只删文案」：提示卡本身是浮层噪声；可发现性改由可见控件承担。
- 否决「删掉设置页全部说明」：设置项存在真实歧义（风化/透视），说明属于功能性标签；
  本次只删营销式/重复式文案。

## 影响面

- 代码：今日页、习惯卡、桌面摆件、渲染颜色域、图鉴缩略图、i18n。
- 数据：无 schema 变化、无迁移、无同步变化。
- 文档：`design/ART.md`（§4 环境光、§10 自定义配色）、`design/SURFACES.md`（图鉴/今日空态）、
  `design/VOICE.md`（删除文案后的口径）。
- 需要人工走查：今日页四类习惯打卡、周频配额完成态、建造页四时段观感、图鉴窄窗。

## 验收标准

- `npm test`、`npx tsc --noEmit`、`npm run design:check`、`npm run format:check`、`npm run build` 全绿。
- 周频配额满后卡片显示完成且不再接受点击；任何被拒点击出现可读 toast。
- night/dusk 下彩色积木明显变暗、正午不变、墨黑主题不消失。
- 图鉴缩略图不溢出卡片、建造中显示当前块、无多余白底。
- 今日页不再出现 TodayBrief / GuideTip / 三步引导 / 「瞬时打卡」/「点击完成打卡」。

## 变更履历

- 2026-11-24 created (lead)
- 2026-11-24 实现完成（待人工审核）：周频完成态与回执 / 自定义色环境光 tone / 图鉴当前态与响应式 / 文案精简；
  补充 custom 休息日「补卡后可撤销」的边界（未补卡仍显示免战）。
- 2026-11-24 追加：移除今日页晚间提醒一次性授权卡，开关保留在设置页；落块弹窗首块说明、建造页开荒文案、
  展台拖拽/空态提示、设置页底部 slogan 一并移除；按 VOICE §5-⑥ 修正中文半角冒号。
- 2026-11-24 评审修订：图鉴建造中只画已落块，地基仍按完整蓝图，取景覆盖「完整地基足迹 + 已落块高度」，SURFACES §9.2 同步；
  custom 休息日量化习惯补卡未达目标不亮勾（A6）；周频完成胶囊保留「本周 x/y」（今日可撤销时仍可点）；
  状态勾脉冲由 rotate(90deg) 改为纯缩放（scale 1.18，沿用既有 duration/easing）；空态图标圆角改用 `--r-sm`；
  退出装饰模式时若有旋转/植被改动，toast 告知会复原。
- 2026-11-24 评审修订（第二轮）：周频完成卡不再显示无效的随笔编辑器；周频 counter 不套用配额状态；
  习惯完成时取消残留专注会话；统计页/手账/导出/热图改用未撤销打卡；专注状态键改为开始计时（不再凭空结算）；
  桌面摆件快捷项/提醒按可打卡性过滤并修正「+1 积木」文案；设置页修复积木分母改用 REPAIR_MAX；
  图鉴取景外扩以容纳虚线地基、锁定态优先；晨曦不带对比度地板。旧记录全文保留，状态由人类审核决定。
- 2026-11-24 评审修订（第三轮）：图鉴暂停建筑保留当前进度；主题切换派发 `THEME_CHANGED_EVENT` 让
  Build/Showcase 画布即时重绘；确认弹窗拦截 React 事件冒泡避免误打卡；TimerWatcher 在通知前校验
  `canCheckInHabit`；恒等 tone 不套对比度地板、palette 缓存按 document 隔离；测试改用本地时区并登记卸载。
- 本记录取代 D-20261110-052（今日简报）、D-20261110-054（页面提示）与 D-20261110-023 的首启引导部分；
  旧记录不删除，状态由人类审核决定。
