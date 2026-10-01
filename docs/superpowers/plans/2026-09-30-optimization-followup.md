# BlockHabit 优化后续计划（交接文档）

- 日期：2026-09-30
- 前置：`2026-09-30-blockhabit-optimization-design.md`（本轮已完成的六批优化 + §7 已接受的取舍/延后项）
- 基线：287/287 测试、`tsc --noEmit` 零错误、`vite build` 成功、`cargo check` 通过
- **硬约束：不改变现有视觉风格与审美**（纸白/墨黑主题、琥珀唯一点缀色、圆润乐高积木）

## P1 · 行为正确性收尾（小改动，先做）

1. **custom 空数组防御**：`merge` 不校验 `frequency.days` 为空数组 → `streak.ts` 无上限回溯可能挂起（streak.test 补边界用例；mergeHabits 或 rebuild 侧过滤空 days 的 custom 习惯）。
2. **repair reason 补 locale key**：`'archived'`/`'future'` 目前回落 `repairFailToast`（Stats.tsx reasonToast 映射补 2 组 key）。
3. **useDialogA11y / 快捷键守卫单测**：jsdom 三例（Esc、Tab 圈闭、焦点恢复）+ App 数字键弹窗守卫一例（4.1/4.2 验收缺口）。
4. **MiniDeskToy 跨午夜**：`todayKey()` 静态取值 → 复用 `useTodayKey`。

## P2 · i18n 全量收口（PR-B，机械重构）

- 约 90 处 `lang === 'zh' ? … : …` 内联翻译迁入 t() 体系；重灾区：MonthlyPoster/Polaroid 画布文案、Build 页次级文案、Showcase 部分。
- `types.ts` 按 `today.fullCard.*`、`stats.metric.*`、`build.xray.*` 分组补 key；en/zh 同步；死键清理清单见主设计文档 4.4。
- 完成标准：`grep -c "lang === 'zh'" src/` 降至 < 15（画布例外需注释）。

## P3 · Canvas 热路径（需先建视觉回归手段）

1. **iso.ts 块精灵缓存**：按 `(color, type, dpr, tileW)` 预渲染单块到 OffscreenCanvas，`drawCube` 命中即 `drawImage`；AO 压痕/落地阴影/bonus 描边保持矢量叠加。主题切换清缓存。
2. **BuildScene 每帧热路径**：排序后 cubes / indexAt / build→checkIn 映射移入 useMemo+ref，rAF 只读；排序仅数据变化时执行。
3. **ShowcaseScene**（2026-10-01 审查后标记部分完成）：`placementsRef` 化、监听稳定化、footprintMap 缓存已完成；「拖拽不全量重建 allCubes」与「静态底座离屏缓存」**延后**——拖拽必重建被拖模型，需按"仅重建被拖模型 + 复用其余缓存"设计并配视觉验证（移入下方延后项）。
4. 前置：四主题 × bonus 块 × AO 的截图 diff 工具（可临时用 `?demo-castle` + 手工走查，或引 pixelmatch 脚本）。

## P4 · 列表渲染完整 memo 链路

- HabitRow `React.memo` + Today 的 `handleHabitCheck`/`onEdit` useCallback 化 + store 层内容等价 selector（今日切片不变则返回原引用），达成"无关打卡零重渲染"。
- 验收：60+ 习惯演示数据下，单卡打卡不触发其它卡片渲染（React DevTools Profiler 记录前后对比）。

## P5 · 一致性收尾（§7.15）

- 遮罩统一 `--overlay` 变量（theme.css 四主题定义；BottomSheet 0.45 / .overlay 0.32 收敛）。
- ConfirmDialog 移动端分支复用 BottomSheet 容器。
- mobile.css 输入框 16px 规则从 `@media (max-width:768px)` 移挂 `.mobile-app-root`。
- 音效：`getAudioContext` 挂起时 await resume 成功后再调度（当前 eager resume 已记 §7.14）。

## P6 · 产品化 backlog（按需排期）

| 项 | 要点 |
| --- | --- |
| 自动更新 | `tauri-plugin-updater` + 签名清单 + `createUpdaterArtifacts` |
| CSP | **✅ 2026-10-01 完成**：严格 csp（script 'self'、style+inline、connect-src https: 兼容 WebDAV）+ `devCsp: null` 保 HMR；**打包产物需手工实测**（手工验证清单） |
| fs scope 最小化 | **✅ 2026-10-01 完成**：删 recursive 全量授权，改 7 个精确命令权限 + scope `$APPDATA/blockhabit*` |
| 音量滑杆 | sound.ts 主 GainNode + `settings.volume` + 设置页滑杆（沿用现有 UI 语言） |
| WebDAV 凭据 keyring | tauri-plugin-stronghold / 系统 keyring（依赖现有 error code 体系） |
| 周起始日配置 | `settings.weekStart: 'mon'|'sun'` 贯通 dates.ts/weekCountFor/热图列头 |
| 习惯硬删除同步语义 | deleteHabit 复活问题（§7.8）：要么软删墓碑，要么 UI 引导归档 |

### 延后项（2026-10-01 独立审查记录）

- ShowcaseScene 拖拽热路径（仅重建被拖模型 + 复用其余模型缓存）与静态底座离屏层
- iso.ts 精灵缓存测试补 dpr/palette/512 淘汰维度
- merge 空 days 习惯的"静默删除"改为 rebuild 侧钳制修复（保留习惯而非丢弃）
- 打包后实测生产 CSP（dev 模式 devCsp=null 不校验）

## 手工验证清单（无自动化覆盖，改相关代码时必测）

- 双设备 WebDAV 端到端：A 撤销 → 同步 → B 不复活；双端同时推 → 412 重试收敛。
- 托盘退出：退出后 `blockhabit.json` 含最后打卡；双开 exe 聚焦已有窗口。
- 迷你摆件：进入/退出窗口尺寸正确恢复（含 125%/150% 缩放屏）。
- 触屏笔记本缩窄窗口不切移动布局。
- 四主题 × zh/en 走查：星标、同步错误色、成功按钮、空态、toast。

## 工作约定

- 每项先补/改测试再实现；批次结束 `npx vitest run` 全绿 + `npx tsc --noEmit` 零错误 + `npm run build` + `cd src-tauri && cargo check`。
- 关键不变量：**合并后 `builds` 必须严格等于 `rebuildBuilds(liveCheckInsView(checkIns), dayClaims)`**（merge.test 有不变量测试，勿破坏）。
- 测试陷阱：`initPersistence` 模块级单例——每个测试文件只能调用一次（见 persistence.*.test.ts 文件头注释）；jsdom 无 `matchMedia`（场景/DPR 代码已防御，测试需自行 defineProperty）。
