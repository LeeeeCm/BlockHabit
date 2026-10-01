# BlockHabit 优化后续计划（交接文档）

- 日期：2026-09-30
- 前置：`2026-09-30-blockhabit-optimization-design.md`（本轮已完成的六批优化 + §7 已接受的取舍/延后项）
- 基线：317/317 测试、`tsc --noEmit` 零错误、`vite build` 成功、`cargo check` 通过
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
| CSP | **✅ 2026-10-01 完成并实测**：严格 csp（script 'self'、style+inline、connect-src https: 兼容 WebDAV、frame-ancestors 'none'）+ `devCsp: null` 保 HMR；release 产物启动 + PrintWindow 截窗验证完整渲染无白屏。注意：http:// 内网 NAS 的 WebDAV 端点会被 connect-src 拦截（有意收紧） |
| fs scope 最小化 | **✅ 2026-10-01 完成并实测**：7 个精确命令权限 + scope `$APPDATA` + `$APPDATA/blockhabit*`（首版漏掉目录自身致 mkdir/readDir 被拒、保存恒失败——第二轮审查发现后已修，见下） |
| 音量滑杆 | **✅ 2026-10-01 完成**：sound.ts 主 GainNode（全部音效经主音量节点输出）+ `settings.volume` 持久化 + 设置页滑杆（CDP 实测 40→存档→100 还原） |
| WebDAV 凭据 keyring | tauri-plugin-stronghold / 系统 keyring（依赖现有 error code 体系） |
| 周起始日配置 | `settings.weekStart: 'mon'|'sun'` 贯通 dates.ts/weekCountFor/热图列头 |
| 习惯硬删除同步语义 | deleteHabit 复活问题（§7.8）：要么软删墓碑，要么 UI 引导归档 |

### fs scope 回归记录（2026-10-01 第二轮审查发现并修复）

收紧为 `blockhabit*` 时漏掉了 `$APPDATA` 目录自身：`mkdir(appDataDir())` 与 `readDir(appDataDir())` 被 scope 拒绝 → 启动自动保存恒失败（saveError toast）+ 备份清理失效。修复：scope allow 追加 `{"path": "$APPDATA"}`（目录自身），文件仍限 `blockhabit*`。验证：重建产物后启动 4s 内 `blockhabit.json` mtime 刷新（启动即自动保存链路可达）。

### 延后项（2026-10-01 独立审查记录）

**✅ 2026-10-01 全部完成：**

- ShowcaseScene 拖拽热路径：静态排序列表缓存 + 拖拽时与被拖模型双有序线性归并（O(n) 替代每帧 O(n log n) 重建+排序）；静态底座（阴影/侧裙/托盘/网格）离屏层缓存，key = 视口/dpr/主题，拖拽与悬停期间恒命中
- iso.ts 精灵缓存测试补齐 dpr 维度、palette 维度（主题切换互不污染）、512 上限 FIFO 淘汰三个用例
- merge/sanitize 空 days custom 习惯：本地加载路径（sanitizeState）已打通——宽容谓词先过滤、再钳制为工作日保留（坏档自修复可达）；merge 侧插入与 LWW 覆盖分支均钳制（对称）。远程同步与用户导入保持严格拒绝（整档 incompatible 报错，不静默吞坏档）——有意取舍：静默钳制远端档案可能掩盖更大损坏
- 生产 CSP 打包实测：`npm run tauri build` 产物启动 + PrintWindow 截窗验证，真实数据完整渲染、无白屏（dev 模式 devCsp=null 不校验 CSP，此为唯一有效验证路径）

## 验证清单（2026-10-01 起大部分已自动化，剩余项标注）

- **✅ 双设备 WebDAV 端到端**：`src/sync/webdav.e2e.test.ts`（真实本地 HTTP 服务器模拟 WebDAV 语义）——首次同步 / A 撤销→B 合并不复活（往返验证）/ 并发推送 412 → 重拉重并收敛（无 lost update）。
- **✅ 打卡立即落盘 + 撤销墓碑**：CDP 驱动真实应用实测（真实存档，打卡 mtime 即时刷新、撤销墓碑写入）。
- **✅ 迷你摆件进出**：CDP 实测——进入 260×380、退出还原 1116×769（截图 `.tmp-shots/03-mini-widget.png`）。
- **✅ 触屏笔记本判定**：`platform.test.ts` 粗/细指针两用例（自动化）。
- **✅ 四主题走查**：CDP 截图 build/showcase/stats × light/dark/oat/fog 共 12 张（`.tmp-shots/`），目视核验通过（暗色精灵渲染、雾灰热图、真实数据）。
- **✅ 生产 CSP**：release 产物 PrintWindow 截窗验证（见 P6）。
- **⬜ 托盘退出握手**：需真实托盘交互（Rust 侧握手逻辑静态审查通过；前端 flush 已由打卡立即落盘覆盖）。
- **⬜ 双开 exe 聚焦**：需手动双击验证（single-instance 插件为官方能力，低风险）。
- **⬜ 125%/150% 缩放屏**：需多显示器环境。

- 双设备 WebDAV 端到端：A 撤销 → 同步 → B 不复活；双端同时推 → 412 重试收敛。
- 托盘退出：退出后 `blockhabit.json` 含最后打卡；双开 exe 聚焦已有窗口。
- 迷你摆件：进入/退出窗口尺寸正确恢复（含 125%/150% 缩放屏）。
- 触屏笔记本缩窄窗口不切移动布局。
- 四主题 × zh/en 走查：星标、同步错误色、成功按钮、空态、toast。

## 工作约定

- 每项先补/改测试再实现；批次结束 `npx vitest run` 全绿 + `npx tsc --noEmit` 零错误 + `npm run build` + `cd src-tauri && cargo check`。
- 关键不变量：**合并后 `builds` 必须严格等于 `rebuildBuilds(liveCheckInsView(checkIns), dayClaims)`**（merge.test 有不变量测试，勿破坏）。
- 测试陷阱：`initPersistence` 模块级单例——每个测试文件只能调用一次（见 persistence.*.test.ts 文件头注释）；jsdom 无 `matchMedia`（场景/DPR 代码已防御，测试需自行 defineProperty）。
