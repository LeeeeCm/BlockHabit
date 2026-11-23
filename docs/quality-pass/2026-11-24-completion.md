# 2026-11-24 质量提升统一完成文档

> 本文件是本次专项的**唯一完成记录**。设计草稿 `2026-11-24-design.md` 已按要求删除；
> 其结论已全部迁入本文。仓库视觉台账仍保留 `design/records/D-20261124-081-quality-pass-and-fixes.md`
>（append-only，状态 proposed，待人工审核）。

## 1. 交付结果

| 问题 | 结果 |
|---|---|
| 任意时段健身无法打卡 | 根因是周频配额满/今日已打卡时卡片仍显示待打卡、点击静默失败。已改为规则函数判定完成态 + 被拒必回执；四类习惯（瞬时/专注/量化/周频）主路径保持可用 |
| 建造页夜灯无效果 | 自定义配色积木此前完全绕过环境光。现在通过 `IsoPalette.tone` 参与 dawn/dusk/night 明暗，正午恒等、色相不变、暗底保留对比度地板 |
| 图鉴缩略图 | 响应式画布不再溢出卡片；透明底去掉多余白底；建造中只画已落块（当前样子）；取景/地基按完整蓝图保持构图稳定并居中 |
| 文案与提示过多 | 删除今日简报、三页页面提示、空态三步引导/口号、卡片时段与「瞬时打卡」、底部「点击完成打卡」、晚间提醒授权卡、落块弹窗首块说明、建造页开荒文案、展台拖拽/空态提示、设置里的重看提示与底部 slogan |

净变化：**67 个文件，+891 / −2060 行**（删除的提示、预设与死代码多于新增）。生产主 chunk 419.57 kB（gzip 129.10 kB，低于 0.2.3 的 434.75 kB）。

## 2. 设计决定（迁自设计草稿）

1. **完成态同口径**：新增 `habitDoneOnDay`。custom 休息日没打卡 → 不算完成（保留免战样式）；
   休息日补了卡 → 算完成可撤销（量化型仍须当日累计达标，A6）；其余 = `habitMetOnDay`。周频配额满即完成，与头部计数/统计/全勤一致（A6）。
2. **周频状态阶梯**：配额满 → 绿勾 + 「本周 x/y」（今天有打卡时可点撤销，否则静态）；今日已打卡未满 → 墨色勾 +「今日已打卡 · 本周 x/y」；
   未打卡 → 待办 + 无胶囊；休息日 →「今日免战」。只有今天存在打卡才可撤销。
3. **被拒必反馈**：`HabitRow.onBlocked` 回传 `already` / `weekly-full`，今日页 toast「今天已打卡」/「本周已完成 x/y」；
   桌面摆件快捷打卡同样检查 `reason`，失败不播庆祝音、不显示成功文案；摆件快捷入口、到点提醒与提醒横幅按
   `canCheckInHabit` 过滤（今天已无法打卡的习惯不再占位/再提醒）；周频 focus 习惯完成时自动取消残留会话。
4. **环境光进入自定义配色**：`IsoPalette.tone`（仅非正午）+ `deriveShadingForColor(color, tone)`；
   精灵缓存键包含 tone；正午无 tone（逐字节不变）；暗底 `floorContrast` 地板。
5. **图鉴**：`BlueprintThumb` 新增可选 `placedCount`，只画前 N 块（`nextSlot` 语义）；地基仍按完整蓝图，
   取景覆盖「完整地基足迹 + 已落块高度」，不为未建高度预留空间。CSS `width:100%; max-width:132; height:auto; aspect-ratio:132/92; margin:0 auto`；
   背景透明；卡片内距 14×12 → 12×10；锁定态优先（不再给剪影传 placedCount）。
6. **文案精简**：今日页只保留日期/进度/完成计数、分类、全勤卡、回声、提醒横幅与习惯卡片；
   空态 = 小图标 + 模板胶囊 + 新建按钮。设置页功能性说明保留（解释有歧义开关，不是标语）。
7. **今日页性能**：删除每分钟问候语轮询；连击计算用 `parseKey(day)`。
8. **动效**：状态勾的脉冲从 `rotate(90deg)` 改为纯缩放，避免勾图标旋转的怪异感；未新增动画。
9. **双语/数据**：删除的 i18n 键从 `types.ts` / `zh.ts` / `en/*.ts` 三处同步删除（schema 强制对齐）；
   数据 schema、同步协议、存储键均未变。

## 3. 测试与验证证据

**新增/更新测试**
- `src/logic/checkin.test.ts`：`habitDoneOnDay` 6 例（日频、周频配额满/未满、custom 休息日补卡、counter、休息日 counter 未达标）。
- `src/pages/today/TodayHabitSections.test.tsx`（新）：周频配额满显示完成且不可点、今日已打卡未满回执 `already`、普通待打卡仍能正常打卡。
- `src/render/ambientContrast.test.ts`：tone 写入/正午缺省、晨曦无地板、自定义色三面变暗、色相不变、墨黑底对比度地板、无 tone 零回归。
- `src/components/BlueprintThumb.test.tsx`：透明底/响应式样式、`placedCount` 只绘制 N 块、0 块只画地基。
- `src/components/GalleryDialog.test.tsx`：建造中卡片向缩略图传 `placedCount`、暂停的未完成建筑仍显示当前进度，锁定/完成不传。
- `src/components/SettingsPanels.test.tsx` / `src/pages/Showcase.test.tsx`：同步删除提示后的断言。

**门禁（全部通过）**
```
npx tsc --noEmit          # 0 error
npm test                  # 109 files / 1120 tests passed
npm run format:check      # all matched files use Prettier code style
npm run design:check      # 81 条记录，设计中枢完整
npm run build             # vite build ✓（最终体积见 §1）
```

**浏览器实测（Vite dev，端口 1420 / 1421 全新 origin）**
- 全新用户空态：只有模板胶囊 + 「新建习惯」，无口号/三步引导/页面提示。
- 今日页：周频卡显示「今日已打卡 · 本周 1/3」；点击卡片出现 toast「今天已打卡」；点状态勾打开撤销确认。
- 图鉴：卡片内容宽 140px、画布 118px（修复前 132px 溢出）；768px 视口无横向滚动；建造中卡片只显示当前已落块，虚线地基完整、无裁切/溢出；无白色画布底。
- 建造页 02:00（night）：陶土积木明显变暗（与修复前同场景截图对比），夜灯胶囊与效果一致。
- 主题切换：纸白 → 墨黑后建造页画布立即重绘（`THEME_CHANGED_EVENT`），地基/积木/描边随主题换色，无需旋转或重进页面。
- 桌面 800×600 与平板 768×1024 两种视口均检查。

## 4. 文件清单（主要）

**打卡与今日页**：`src/logic/checkin.ts`、`src/components/HabitRow.tsx`、`src/components/habitrow/HabitRowFooter.tsx`、`HabitRowHeader.tsx`、`src/pages/Today.tsx`、`src/pages/today/TodayHabitSections.tsx`、`TodayEmptyState.tsx`、`TodayFullDayCard.tsx`、`src/pages/today/TodayHabitSections.test.tsx`、`src/components/MiniDeskToy.tsx`、`src/platform/eveningNudgePrefs.ts`。

**环境光**：`src/render/isoColor.ts`、`src/render/isoCube.ts`、`src/render/ambientContrast.test.ts`。

**图鉴**：`src/components/BlueprintThumb.tsx`、`src/components/GalleryDialog.tsx`、`src/components/ui-cards.css`、对应测试。

**文案精简**：`src/pages/Build.tsx`、`Showcase.tsx`、`Stats.tsx`、`src/components/BlockDropModal.tsx`、`HabitTemplates.tsx`、`src/components/settings/LabGroup.tsx`、`SettingsFooter.tsx`、`src/components/minidesk/MiniFooter.tsx`、`src/components/ReminderWatcher.tsx`、`src/i18n/types.ts`、`src/i18n/locales/zh.ts`、`en/today.ts`、`en/build.ts`、`en/reminders.ts`、`en/habitDialog.ts`、`en/settings.ts`、`en/common.ts`、`en.ts`。

**删除文件**：`src/components/TodayBrief.tsx`、`src/logic/todayBrief.ts`、`src/logic/todayBrief.test.ts`、`src/components/GuideTip.tsx`、`src/components/GuideTip.test.tsx`、`src/platform/guideTips.ts`、`src/platform/guideTips.test.ts`、`src/components/EveningNudgeConsent.tsx`。

**评审修复涉及**：`src/components/habitrow/HabitRowDialogs.tsx`、`src/app/TimerWatcher.tsx`、`src/render/BuildScene.tsx`、`src/render/ShowcaseScene.tsx`、`src/platform/appearance.ts`、`src/App.tsx`、`src/components/minidesk/MiniFooter.tsx`、`src/components/settings/SettingsFooter.tsx`、`src/pages/Stats.tsx`。

**设计台账**：新增 `design/records/D-20261124-081-quality-pass-and-fixes.md`（proposed）；更新
`design/RECORDS.md`、`design/index.json`、`design/ART.md`（环境光 tone）、`design/SURFACES.md`（§9 增补）、
`design/VOICE.md`（§6 文案精简）；`CHANGELOG.md` 新增 Unreleased 段。

## 5. 已知限制与后续

- **只做了 Web 构建与浏览器实测**，未跑 `npm run tauri build`（Rust 首次编译 3–10 分钟）与真机走查；
  本次改动不涉及 Tauri 桥接与存档格式，风险低，但建议发版前在桌面壳再走一遍四类打卡。
- **图鉴建造中构图**：地基按完整蓝图，取景覆盖「完整地基足迹 + 已落块高度」；早期模型偏小但不会被裁切或出框。
- **跨时段刷新**：环境光在页面下一次重绘时更新（切页/交互/主题切换），不会在 10/16/19 点整主动重绘；
  这是 ART §4 已记录的既有边界，本次未改动。
- **未处理**：`package.json` 中 4 个零引用字体包（TOKENS §3 已记录），移除会改动 lockfile，
  建议作为独立依赖清理提交。
- **设置页功能性说明保留**：它们是解释有歧义开关的标签，不是标语；如需进一步精简，应同时改写标签本身。
- 设计记录状态仍为 `proposed`，按仓库规则需人类审核后改为 `approved` / `implemented`。

## 6. 设计文档处置

按用户要求，工作用设计草稿 `docs/quality-pass/2026-11-24-design.md` 已删除；设计决定全文已迁入本文第 2 节。
`design/` 下的台账记录按仓库「不可删除」铁律保留（append-only）。

## 7. 评审修正（独立多角度代码评审后）

多角度评审（逐行 / 删除行为 / 跨文件调用 / TS 陷阱 / 包装与缓存 / 仓库约定）发现并已修正：

1. **周频完成卡不再显示随笔编辑器**：无今日打卡时编辑器会打开但保存无效（`commitNote` 无目标），现仅在 `todayCheckIn` 存在时渲染。
2. **周频 counter 不套用配额状态**：`isWeeklyQuota = weekly && kind !== 'counter'`，状态键继续加步进而非打开撤销。
3. **残留专注会话**：习惯因配额变化变为完成时自动 `cancelTimer`，避免隐藏计时器继续到点通知。
4. **图鉴**：地基仍按完整蓝图；取景包围盒外扩一格以容纳虚线地基；锁定态优先，不给剪影传 `placedCount`（避免空白剪影）。
5. **晨曦地板**：`tone` 在 dawn 不带 `bg`，自定义配色不再被暗底对比度地板反向提亮（dusk/night 仍保留地板）。
6. **统计页墓碑泄漏**（pre-existing）：新增 `liveCheckIns`，总数/专注时长/热图/回声/手账/导出/修复目标全部只用未撤销打卡。
7. **专注习惯状态键**（pre-existing）：空闲时点击现在开始计时，不再凭空结算整个目标时长并掉块。
8. **桌面摆件**：快捷项按 `canCheckInHabit` 过滤；无掉块时不再承诺「+1 积木」；周配额未满但今日不可打卡时显示「今天没有可打卡的了」而非「全部搞定」；到点提醒/横幅同样跳过今日不可打卡的习惯。
9. **设置页修复积木库存**（pre-existing）：分母改用 `REPAIR_MAX`（4），不再显示 `3 / 2`。
10. **约定**：空态图标圆角改用 `--r-sm`；状态勾脉冲改为纯缩放的变更写入记录履历；退出装饰模式若有旋转/植被改动会 toast 告知复原。
11. **渲染隔离**：`onBlocked` 回调不再依赖 `checkIns` 数组，避免任意一次打卡让所有习惯卡重渲染。
12. **图鉴暂停建筑**：切走当前蓝图后，已有进度的未完成建筑仍显示当前块与「建造中 x/y」，不再伪装成完整模型/「开始建造」。
13. **主题切换画布刷新**：App 设置 `data-theme` 并清精灵缓存后派发 `THEME_CHANGED_EVENT`，Build/Showcase 画布随即重绘；浏览器实测纸白↔墨黑切换后画布立即换色（此前要等下一次旋转/交互）。
14. **弹窗点击穿透**：撤销/删除确认弹窗经 portal 渲染，React 事件仍会冒泡到卡片；用 `display:contents` 包裹并拦截点击，避免点弹窗正文误打卡。
15. **到点通知资格**：`TimerWatcher` 在生成通知计划时检查 `canCheckInHabit`，资格失效则取消会话，不再提醒一个注定被拒绝的打卡。
16. **颜色缓存**：恒等 tone 不再套用对比度地板；`paletteFromDocument` 改为按 document 的 WeakMap 缓存，测试/多文档不串用主题与背景色。
17. **测试稳健性**：今日卡测试改用本地时间构造时钟并断言打卡日期；根节点登记到 afterEach，断言失败也会卸载，避免离屏组件继续订阅 zustand。

未改项：墨黑主题夜间自定义色右脸可能被对比度地板抬高 ≤3 个 RGB 单位——这是 C4 记录明确接受的「不低于标准光照可辨度」行为，与主题色路径一致。


## 8. 追加：WebDAV 只保留通用模式（D-20261124-082）

**需求**：WebDAV 数据同步不要那么多默认供应商，统一用通用模式。

**改动**
- 设置页 WebDAV 组移除 Nextcloud / 坚果云 / 群晖 / 通用四个预设按钮、`服务商` 标签与 2FA 应用专用密码提示；
  地址框始终可编辑，用户直接填写完整 WebDAV 集合 URL。
- 删除 `src/sync/providers.ts`（`ProviderId` / `PROVIDER_PRESETS` / `buildEndpoint` / `switchProvider` /
  `normalizeServerBase` 与预设路径常量）及 `providers.test.ts` / `webdavProvider.test.ts`；
  `WebdavPanel` 内的 `endpointHost` / `isJianguoyunEndpoint` / `detectProvider` / `baseFromEndpoint` 同步删除。
- 协议补全、尾斜杠与同步文件名拼接仍由 `getSyncUrl` / `normalizeCollectionUrl` 负责；分步自检、自动同步、
  凭据保管、记住密码等能力不变。
- **不迁移、不清空旧配置**：endpoint 一直以完整 URL 存档，老用户的 Nextcloud/坚果云/群晖地址继续原样同步。
- 删除 i18n 键 6 个（types / zh / en.webdav 三处对齐）。

**测试**
- `SettingsPanels.test.tsx`：改为断言「只渲染通用表单、无服务商按钮、地址可编辑、输入写入配置」。
- 删除 `providers.test.ts`（预设 URL 拼接）与 `webdavProvider.test.ts`（host 识别）；对应功能已不存在。
- 门禁：`npx tsc --noEmit`、`npm test`（109 文件 / 1120 用例）、`npm run format:check`、`npm run design:check`（82 条）、`npm run build`（index 419.57 kB / gzip 129.10 kB）全部通过。
- 浏览器实测：设置页 WebDAV 组无服务商按钮/标签，地址框可编辑，直接显示地址/用户名/密码三项。
