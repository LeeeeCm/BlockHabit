# BlockHabit 完整优化方案（详细设计）

- 日期：2026-09-30
- 范围：`src/` 全部模块、`src-tauri/`、仓库根目录卫生
- 基线：245 个测试（1 失败）、`tsc --noEmit` 零错误
- **硬约束：不改变现有视觉风格与审美**（纸白/墨黑双主题、琥珀唯一点缀色、圆润乐高积木、Fredoka+MiSans+站酷庆科黄油体）。本方案所有条目均为缺陷修复、数据安全加固、逻辑修正与性能优化，不引入新的视觉语言。

## 0. 问题总览与批次划分

审查确认的问题按"是否丢数据 → 是否功能错误 → 是否体验缺陷 → 是否性能 → 是否产品化"分为六批，每批独立可交付、独立可验证：

| 批次 | 主题 | 条目数 | 预估工作量 |
| --- | --- | --- | --- |
| 一 | 快速修复（破损点/死机制/收尾） | 10 | 0.5–1 天 |
| 二 | 数据安全与持久化加固 | 8 | 1.5–2 天 |
| 三 | 同步机制重设计（schema v2） | 5 | 2–3 天 |
| 四 | 体验一致性与 i18n 收口 | 10 | 2–3 天 |
| 五 | 渲染与列表性能 | 4 | 1–1.5 天 |
| 六 | 产品化 backlog（按需排期） | 6 | 不在本轮 |

依赖关系：批次三依赖批次二的迁移管线（2.8）与副作用出仓（2.5）；批次四的 a11y hook 不依赖其他批次；批次五独立。建议按批次顺序执行，批次一可立即开工。

---

## 1. 批次一：快速修复

### 1.1 BottomSheet 标题栏恢复 `display: 'flex'`

**问题**：`src/components/BottomSheet.tsx:196-204` 本次未提交修改中标题栏 div 的 `display: 'flex'` 被误删，`alignItems`/`justifyContent` 失效，移动端 HabitDialog/SettingsDialog 弹窗头部关闭按钮被挤到标题下一行。

**设计**：恢复该 style 属性，同时给 h3 补 `flex: 1, minWidth: 0`（保证长标题省略号生效，不换行挤压关闭按钮）。

**验收**：`BottomSheet.test.tsx` 新增断言——标题栏元素 `style.display === 'flex'`；移动端两个弹窗目视走查。

### 1.2 修复失败单测（根因已定位：测试自身日期错位）

**问题**：`HabitRowMobile.test.tsx` "counter step (+/-) buttons trigger haptic feedback" 失败，`triggerHaptic` 调用 0 次。

**根因（已实验证实）**：测试硬编码 `day="2026-09-24"`，而 store 的 `checkIn` 内部用 `todayKey()`（真实当天）。点击 +250 后打卡落在真实当天（09-30），组件按 `day="2026-09-24"` 计算 `counterVal` 仍为 0 → 减号按钮 `disabled` 未解除 → 第二次 `.click()` 被浏览器吞掉（disabled 按钮不派发 click）。产品代码无 bug。

**设计**：测试的三个用例统一改传 `day={todayKey()}`（从 `../logic/dates` 导入）；断言顺序保持不变。

**验收**：`npm test` 全绿 245/245。

### 1.3 复活连击奖励机制

**问题**：`appStore.ts:418` `return { ..., bonus: isStreakBonus || true, ... }` 恒真；"连击每满 7 天下一块为点缀色 bonus 积木"（README 已承诺、`blueprint.ts:14 awardBlock` 已实现）从未生效。

**设计**：
- `checkInDay()` 返回值改 `bonus: isStreakBonus`（`appStore.ts:418`）。
- 全勤块本身 `bonus: true` 保留（`appStore.ts:397`）——全勤奖励块自带点缀色是既有设计意图（原注释已说明），需要修正的只是"每 7 天连击里程碑"的返回值语义。
- 排查 `ClaimDayResult.bonus` 的 UI 消费点（Today 全勤卡）：若当前无差异化展示，本条仅修正返回值语义，UI 提示（"7 天连击！"toast）列入批次四 4.4 i18n 收口时一并接线，本批不改视觉。

**验收**：新增单测——`dayClaimStreak=7` 的连续 claim 返回 `bonus: true`，其余日返回 `false`；现有 `dayclaim-streak.test.ts` 全绿。

### 1.4 capabilities 补齐迷你摆件窗口权限

**问题**：`App.tsx:225-232` `toggleMini` 调用 `setSize`/`setAlwaysOnTop`/`setResizable`/`center`，但 `src-tauri/capabilities/default.json` 未声明对应权限，运行时被 Tauri 拒绝（"not allowed"），迷你摆件功能实际不可用。

**设计**：`default.json` permissions 追加 4 条：

```json
"core:window:allow-set-size",
"core:window:allow-set-always-on-top",
"core:window:allow-set-resizable",
"core:window:allow-center"
```

**验收**：桌面端 `toggleMini(true)` → 260×380 置顶小窗正常；`toggleMini(false)` 恢复正常（尺寸恢复逻辑在批次四 4.7 改进）。

### 1.5 静音设置持久化

**问题**：`sound.ts:23-27` `soundMuted` 是模块级变量，`AppSettings` 无对应字段，重启后静音丢失。

**设计**：
- `types.ts` `AppSettings` 增加 `soundMuted?: boolean`；`normalizeState` 补默认 `false`（`soundMuted: s.settings?.soundMuted === true`）。
- `SettingsDialog` 静音开关改走 `updateSettings({ soundMuted })`（自动获得防抖持久化）。
- `App.tsx` 增加一个 effect 订阅 `settings.soundMuted` → 调 `setSoundMuted(value)`（`sound.ts` 现有 API 不动）。
- 移除 `SettingsDialog` 内部的本地 muted useState。

**验收**：store 单测——`updateSettings({ soundMuted: true })` 后 exportData 含该字段；手测重启后静音保持。

### 1.6 counter 习惯的周配额语义统一

**问题**：`checkin.ts:44-47` counter+targetValue 提前返回、永不检查周配额，而 `canCheckIn`（68-71 行）对 weekly 一律执行 `weekly-full` 拦截 → "能否打卡"与"是否达标"（`habitMetOnDay`）判定矛盾。

**设计（产品语义决定）**：counter 习惯的"完成"以当日 `targetValue` 达成为准，周配额对 counter 无意义。`canCheckIn` 的 weekly-full 拦截增加 `habit.kind !== 'counter'` 前置条件。

**验收**：`checkin.test.ts` 新增用例——weekly counter 本周配额用尽但当日未达标时仍可步进；达标后全勤判定正确。

### 1.7 index.html 脚手架残留

**设计**：`title` 改为 `BlockHabit`；`<link rel="icon">` 指向 `/logo.svg`——将 `src/assets/logo.svg` 复制到 `public/logo.svg`（public 目前只有 vite.svg/tauri.svg）；删除 `public/vite.svg`、`public/tauri.svg`。

**验收**：浏览器标签页显示产品名与自有 logo；`npm run dev` 无 404。

### 1.8 用户可见文案修复

| 位置 | 问题 | 设计 |
| --- | --- | --- |
| `Stats.tsx:560` | 补签失败弹裸英文枚举 `'no-bricks'` | 建 reason→文案映射 `{ 'no-bricks': t.stats.noBricks, 'already': t.stats.alreadyCheckIn, 'no-habit': t.stats.noHabit }`；locales 补 3 组 key |
| `HabitRow.tsx:542` | 硬编码中文 tooltip"已满 80%，可直接完成打卡" | 加 `today.readyToFinish` locale key |
| `Today.tsx:372` | `t.today.emptyHint` 内含 `\n` 但不换行 | 容器加 `whiteSpace: 'pre-line'` |
| `BottomSheet.tsx:157,222`、`BottomTabBar.tsx:33,89` | aria-label 硬编码英文 | 接入 `t()`（补 `common.close`、`common.dismiss`、`a11y.unfinishedHabits`、`a11y.bottomNav`） |

**验收**：en 界面无中文泄漏、zh 界面无裸英文枚举；现有 i18n 类型检查保证 en/zh key 对齐。

### 1.9 迁移残留收口

- `ConfirmDialog.tsx:7-13`：删除 `confirmText/cancelLabel` 旧 prop，`Stats.tsx:551-552` 改用 `confirmLabel/cancelLabel`。
- `BottomSheet.tsx:26-49`：删除 `open` 旧 prop 兼容（grep 全部调用点确认无残留引用后删）。
- `reflections.engravedToast` 接线：`HabitRow.commitNote()` 与 `BlockDropModal` 镌刻保存成功后 `showToast(t.reflections.engravedToast)`（规划过的反馈补完）。
- `BlockDropModal.tsx:43,225`：落地动画完成回调里 `inputRef.current?.focus()`。
- `HabitDialog.tsx:15-35`：删除 `FieldLabel` 的 `'选填'` 死兜底（全部调用点已传 `optionalText`）。
- `timerStore.ts:34-36`：删除 `clear` 别名（grep 确认无调用）。

### 1.10 仓库卫生

- `.gitignore` 追加：`.tmp/`、`.tmp-*.ps1`、`*.zip`、`demo-state.json`、`.qoder/`。
- 删除根目录 15 个 `.tmp-*.ps1` UI 自动化脚本、`.tmp/` 截图目录、`src.zip`（11.7MB）。
- `demo-state.json`（184KB）：确认 `scripts/seed-demo.ts` 是否引用；若引用则移至 `scripts/fixtures/demo-state.json` 并在脚本中改路径，否则删除。
- `scripts/seed-demo.ts`：移除"验收后删除"自注；在文件头补用途说明（生成演示存档）。

**验收**：`git status` 仅剩有效文件；`npm test` 与 `npm run dev` 不受影响。

---

## 2. 批次二：数据安全与持久化加固

### 2.1 深度校验 `validateState`

**问题**：`adapter.ts:11-23` 只校验顶层数组，`frequency` 为字符串、`checkIns` 混入 `null` 均可通过；导入后 `checkin.ts` 直接抛 TypeError 白屏。

**设计**：`adapter.ts` 重构为两级：

```ts
/** 严格校验：导入/远程同步用——任一元素非法则整体拒绝 */
export function validateState(v: unknown): { ok: true; state: AppState } | { ok: false; error: string }

/** 宽松清洗：本地 load 用——丢弃非法元素，保留合法部分 */
export function sanitizeState(v: unknown): AppState | null
```

逐元素规则：
- `habit`：`id` 非空字符串、`name` 字符串、`frequency.type ∈ {daily, weekly, custom}`、`weekly.times > 0`、`custom.days ⊆ 1..7`、`createdAt` 可被 `new Date()` 解析；非法元素丢弃（sanitize）或整体拒绝（validate）。
- `checkIn`：`id`/`habitId` 非空、`date` 匹配 `/^\d{4}-\d{2}-\d{2}$/`、`at` 可解析；`value`/`actualMinutes` 数字或 undefined。
- `placedBlock`：`id`/`blueprintId` 非空、`index` 非负整数、`bonus` 布尔。
- `settings`：`theme`/`language` 枚举校验（现 normalizeState 已做，复用）。

`importData` 改走 `validateState` + `normalizeState`；`useSync.ts:98` 远程档校验同步替换。

**验收**：单测覆盖 6 类变形档（frequency 字符串、checkIns 含 null、date 格式错、builds 缺 blueprintId、settings.theme 非法、顶层缺字段）——validate 全拒、sanitize 丢坏留好。

### 2.2 导入确认 + 自动备份

**设计**：
- `StorageAdapter` 增加可选方法 `backup(state: AppState): Promise<void>`：
  - Tauri：写 `appDataDir/blockhabit-backup-<yyyyMMdd-HHmmss>.json`（保留最近 5 份，超出删除最旧）。
  - localStorage：写 `blockhabit-backup-latest`（单份覆盖）。
- `SettingsDialog.doImport` 流程改为：`file.text()` 包 try/catch → `validateState` 预检 → 失败则 toast 具体 error；通过则弹 `ConfirmDialog`（文案含现有数据规模："将覆盖 N 条习惯 / M 条打卡记录，当前数据会自动备份"）→ 确认后 `adapter.backup(exportData 解析)` → `importData`。
- `importData` 返回 boolean 不变。

**验收**：导入坏文件无 unhandled rejection 且状态不变；导入成功后备份文件存在且内容为导入前状态。

### 2.3 保存失败感知

**问题**：`tauriStorage.ts:47-49` 失败仅 `console.error`；`appStore.ts:564` `void adapter.save()` 吞掉 rejection；localStorage 配额超限静默。

**设计**：
- 两个 adapter 的 `save` 失败一律 throw（localStorage 包 try/catch 重抛）。
- `initPersistence` 的 `flushSave` 改 async：`adapter.save(...).catch(() => useAppStore.setState({ saveError: Date.now() }))`；成功后 `saveError: null`。
- `AppState`（store 运行时态，非持久化 schema）增加 `saveError?: number`——**注意**：不进 `exportData`/持久化字段列表（flushSave 已手动挑选字段，天然隔离）。
- UI：`App.tsx` 监听 `saveError`，非阻塞 toast"存档保存失败，请检查磁盘空间"（去抖 10s 内只提示一次）。

**验收**：单测 mock `adapter.save` reject → `saveError` 置位、成功后清除；手测模拟只读目录。

### 2.4 localStorage 损坏备份

**设计**：`createLocalStorageAdapter().load` 中，`JSON.parse` 失败或校验失败时，先把原文写入 `localStorage['blockhabit-state-corrupt-backup']`（内容 = `{ raw, at }`）再返回 null。与 Tauri 端 `.corrupt-backup` 行为对齐。

**验收**：单测——坏 JSON 加载后 backup key 存在原文；下次 load 正常。

### 2.5 store 副作用出仓（为迁移管线与同步重设计铺路）

**问题**：`appStore.ts:430-441`（DOM+Tauri emit）、`494-497`（importData 改 DOM）、`513-527`（demo 态内嵌）使 store 不纯，单测依赖 `document`。

**设计**：
- `updateSettings`/`importData` 移除 `document.*` 与 `emit` 调用，只改状态。
- `App.tsx` 增加 effect：订阅 `settings.theme` → `document.documentElement.dataset.theme` + Tauri `emit('theme-changed')`；订阅 `settings.language` → `document.documentElement.lang` + `emit('language-changed')`。
- `?demo-castle` 演示态逻辑移到 `main.tsx` 启动分支（`initPersistence` 之前判断）。
- `App.tsx:128-149`、`TrayMenu.tsx:39-58` 的 async `listen` 注册加 `disposed` 标志（见 4.7）。

**验收**：appStore 相关单测不再触碰 `document`（jsdom 下 stub document 断言不被调用）；行为由现有测试保护不变。

### 2.6 退出落盘与防抖策略

**问题**：300ms 防抖窗口内强杀丢数据；托盘 quit `app.exit(0)`（`lib.rs:49`）不等待前端 flush。

**设计**（两层）：
1. **变更即存**：`checkIn`/`uncheckIn`/`checkInDay`/`useRepairBrick`/`importData` 触发的订阅保存绕过防抖立即 flush（实现：这些 action 里 `set({ ...state, _persistHint: 'now' })`？——否，污染 schema。改为：subscribe 回调对比 state 引用集合不可行，直接采用**轻量方案**——防抖从 300ms 降到 150ms，且上述 5 个 action 调用后 store 外层包装 `scheduleSave('now')`。最终采用：`initPersistence` 暴露 `flushSave`；`useAppStore.subscribe` 内维护 `dirtyAt`；对 5 个关键 action 在其函数体末尾直接调用模块级 `requestFlush('immediate')`（闭包变量，initPersistence 时注入），防抖仅覆盖其余高频 action）。
2. **托盘退出握手**（`lib.rs`）：
   - `"quit"` 分支改为：`app.emit("app-quit-requested", ())`；`std::thread::spawn` 等待 `app.state::<QuitGate>()`（新增 `Mutex<bool>`），1.5s 超时强退；前端收到事件后 `flushSave()` 完成 → `invoke('confirm_quit')` 置位 QuitGate。
   - 前端 `App.tsx` 挂 `listen('app-quit-requested', ...)`（disposed 保护）。

```rust
// lib.rs 关键草图
"quit" => {
    let app2 = app.clone();
    let _ = app.emit("app-quit-requested", ());
    std::thread::spawn(move || {
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1500);
        while std::time::Instant::now() < deadline {
            if *app2.state::<QuitGate>().lock().unwrap() { break; }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        app2.exit(0);
    });
}
```

**验收**：单测——关键 action 后 pendingState 立即落盘（fake timer 推进 0ms）；手测托盘退出后 `blockhabit.json` 包含退出前最后一次打卡。

### 2.7 单实例保护

**设计**：`Cargo.toml` 加 `tauri-plugin-single-instance = "2"`；`lib.rs` 第一个注册：

```rust
.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
```

二次启动聚焦已有窗口，杜绝双实例并发写 `blockhabit.json`。

**验收**：手测双击两次 exe，仅一个进程、窗口聚焦。

### 2.8 schema 迁移管线

**问题**：`adapter.ts:15` 硬校验 `schemaVersion === 1`，未来升版即全体判非法。

**设计**（本批搭好管线，v2 实际升级在批次三落地）：

```ts
export const SCHEMA_VERSION = 1 // 批次三升为 2
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2 由批次三填充
}
export function loadAndMigrate(parsed: unknown): AppState | null {
  // 1. schemaVersion 缺失视为 1；数字且 <= SCHEMA_VERSION 才放行
  // 2. while (v < SCHEMA_VERSION) parsed = MIGRATIONS[v](parsed), v++
  // 3. validateState 严格校验 → sanitizeState 宽松清洗 → normalizeState
  // 4. schemaVersion > SCHEMA_VERSION：返回 null 并标记 needsUpgrade（UI 提示"存档来自更新版本的应用"）
}
```

`isValidState` 放行条件改为 `typeof s.schemaVersion === 'number' && s.schemaVersion <= SCHEMA_VERSION`（兼容云端旧档）；`useSync` 远程档校验走 `loadAndMigrate`。

**验收**：单测——v1 档经管线输出与 `normalizeState` 一致；未来版本档返回 null 且不触发保存覆盖。

---

## 3. 批次三：同步机制重设计（schema v2）

### 3.1 删除墓碑 + builds 可推导重建

**问题**（当前最严重的数据正确性缺陷）：
- `merge.ts:33-89` `mergeCheckIns` 只做并集，撤销的打卡在下次同步"复活"。
- `merge.ts:94-118` builds 按 `${blueprintId}_${index}` 合并，而 `uncheckIn`（`appStore.ts:291-307`）会压实重排 index → 幽灵块。
- `dayClaims` 无删除语义；全勤块回收靠 `placedAt.startsWith(targetDay)` 启发式匹配（`appStore.ts:279-287`）。

**设计**（核心思想：**builds 是打卡与全勤记录的确定性投影，合并只针对事实层，投影层每次合并后重建**）：

**schema v2 字段**（全部向后兼容的可选字段 + 一处结构升级）：

```ts
// types.ts
interface CheckIn { ...; deletedAt?: string }        // 打卡墓碑
interface PlacedBlock { ...; deletedAt?: string }     // 积木墓碑（保留字段以便调试，不参与合并）
interface DayClaim { date: string; claimedAt: string; blockId: string }  // dayClaims: string[] → 结构升级
interface AppStateV2 { ...
  deletedDayClaims?: { date: string; deletedAt: string }[]  // 全勤领取墓碑
}
```

**事实层合并**（merge.ts 重写）：
1. `mergeCheckIns`：按 id 合并；任一侧带 `deletedAt` → 结果带 `deletedAt`（删除胜出，墓碑不可逆）。元数据（note/mood/starred）合并逻辑保留。
2. `mergeDayClaims`：claims 按 `date` 分组 LWW——`claimedAt` 与对应 `deletedDayClaims.deletedAt` 比较时间，新者胜（支持同日反复领取/撤销跨设备收敛）。
3. `mergeHabits`：增加 `updatedAt` LWW（见 3.2）。
4. `repairBricks`：维持 `Math.max`（已知取舍，见 §7）。

**投影层重建**（新函数，merge/import/load 后统一调用）：

```ts
// logic/builds.ts（新文件）
export function rebuildBuilds(
  liveCheckIns: CheckIn[],   // 已过滤 deletedAt
  claims: DayClaim[],
  blueprintId: string,
): PlacedBlock[] {
  // 事实来源：
  //   - liveCheckIns 中带 placedBlockId 的记录 → 普通块 { id: placedBlockId, fromHabitId: habitId, bonus: false }
  //   - 每条 DayClaim → 全勤块 { id: claim.blockId, fromHabitId: '__day__', bonus: true }
  // 排序：placedAt（day 块用 claimedAt）升序，tie-break id
  // index = 同 blueprintId 内的序号（0..N-1 连续，天然压实，无空洞）
}
```

- `uncheckIn` 简化：不再物理删除、不再手动压实——只墓碑化 checkIns（及全勤回收时墓碑化 dayClaim），然后调用 `rebuildBuilds` 刷新投影（改用 `claim.blockId` 精确匹配，废弃 `placedAt.startsWith` 启发式）。
- `checkIn`/`checkInDay` 保持增量 append（性能路径），末尾不变。
- v1→v2 迁移（`MIGRATIONS[1]`）：`dayClaims: string[]` → `DayClaim[]`（`claimedAt` 取 `date+'T12:00:00'` 近似值，`blockId` 在迁移时按 `placedAt` 匹配现有 `__day__` 块，匹配不到生成 `"migrated-"+date`）；补 `deletedDayClaims: []`。
- 墓碑 GC：`loadAndMigrate` 时删除 `deletedAt` 距今 > 90 天的 checkIn 墓碑（极端离线 90 天以上的设备已知限制，见 §7）。

**验收**（重点，参照 `userScenarios.test.ts` 风格写场景测试）：
- A 设备打卡→撤销→同步：撤销不复活。
- A 设备撤销 3 块中第 2 块→同步：B 设备城堡无空洞、index 连续、`nextSlot` 正确。
- A/B 各自全勤领取后 A 撤销→同步：全勤块回收且当日不能重新领取的判定一致。
- 同步前后 `builds` 与 `rebuildBuilds(liveCheckIns, claims)` 逐字段一致（不变量测试）。

### 3.2 Habit 字段 LWW

**问题**：`merge.ts:18-24` `{ ...existing, ...h }` 本地恒胜，两设备改名互覆。

**设计**：`Habit` 增加 `updatedAt?: string`；`addHabit`/`updateHabit`/`archiveHabit`/`restoreHabit`/`togglePinHabit` 统一 `updatedAt: new Date().toISOString()`。`mergeHabits` 改为：双方都有 `updatedAt` → 新者胜（ISO 字符串比较，同刻本地胜）；任一方缺失 → 沿用现有 spread 行为（兼容旧档）。

**验收**：单测——B 设备改名（updatedAt 更新）同步后 A 显示新名；旧档（无 updatedAt）合并行为与现状一致（回归保护）。

### 3.3 settings 全字段合并

**问题**：`merge.ts:166-169` 只保留 theme/language，音色等开关同步后丢失。

**设计**：`settings = normalizeState 兜底({ ...remote.settings, ...local.settings })`——本地优先、缺字段回退远端，其余开关低冲突可接受。

**验收**：单测——本地 `soundMaterial: 'walnut'`、远端 `enableGentleDecay: false` → 合并后两者均保留。

### 3.4 WebDAV 条件写与健壮性

**问题**：裸 PUT 无并发保护（lost update）；404 一律视为"远程无文件"可能覆盖真实云端档；15s 超时对大档案偏紧；错误提示硬编码中文；每键击落盘凭据。

**设计**：
1. **条件写**：`fetchRemoteState` 返回 `{ json: string | null, etag: string | null }`；`pushRemoteState` 带 `If-Match: <etag>`（服务器无 ETag 时退化为无条件 PUT，行为同现状）。PUT 返回 412 → 重新 GET→merge→PUT 重试 1 次 → 仍 412 报 `conflict` 错误。
2. **404 二次确认**：GET 404 后发 `PROPFIND`（Depth: 0）——201/207 说明目录可达、文件确实不存在 → 返回 null；PROPFIND 404 → 抛 `no-collection` 错误（路径不存在），**不进入"首次上传"分支**，避免把空本地档推到错误路径。PUT 409（父目录缺失）→ 先 `MKCOL` 父目录再重试一次。
3. **超时**：GET 15s、PUT 30s；PUT 失败（网络类）重试 1 次。
4. **URL 编码**：`getSyncUrl` 对路径段 `encodeURIComponent`（保留 `/` 与末段文件名）。
5. **守卫**：`syncNow` 入口 `if (!useAppStore.getState().hydrated) return false`；`useSync` 挂载与定时触发均 `await persistenceReady`（2.8/2.5 提供的 hydration promise）。
6. **启动即同步**：`enabled` 且距 `lastSyncAt` 超过间隔时，hydration 完成后延迟 2s 触发一次。
7. **错误 i18n**：`useSync` 内部错误改 error code（`no-endpoint`/`auth`/`parse`/`incompatible`/`network`/`conflict`/`no-collection`），`SettingsDialog` 映射 `t.settings.syncErrors.*` 展示。
8. **凭据**：`updateSyncConfig` 输入改为防抖 800ms 提交（不逐键落盘）；密码仍存 localStorage（keyring 进 backlog §7，README 安全说明补充"WebDAV 密码明文存储于本机"）。
9. 删除 `webdav.ts:26` 的 `btoa(encodeURIComponent(...))` 死代码分支。

**验收**：mock fetch 单测覆盖——ETag 412 重试成功/重试仍 412 报 conflict、GET 404+PROPFIND 207 返回 null、GET 404+PROPFIND 404 报 no-collection、PUT 409→MKCOL→重试成功、未 hydrated 时 syncNow 直接返回。

### 3.5 hydration 竞态

**问题**：`initPersistence` 的 `await adapter.load()` 期间 `syncNow` 可能已 `importData`，load 完成后旧磁盘档覆盖同步结果。

**设计**：`initPersistence` 模块级保存 `persistenceReady: Promise<void>`（load 完成后 resolve）；`useSync.syncNow` 与定时器触发前 `await persistenceReady`。`importData` 后若 load 尚未完成，load 结果到达时检查 `hydrated === true` 且状态非默认空 → 丢弃磁盘结果（以内存态为准）。

**验收**：单测——load pending 中 syncNow 写入 → load resolve 后磁盘旧档被丢弃。

---

## 4. 批次四：体验一致性与 i18n 收口

### 4.1 统一弹窗 a11y hook

**问题**：仅 BottomSheet 有 Esc/role/滚动锁；其余 7 个弹窗无 `role="dialog"`/焦点管理，Tab 穿透。

**设计**：新建 `src/components/useDialogA11y.ts`：

```ts
export function useDialogA11y(opts: {
  open: boolean
  onClose: () => void
  initialFocusRef?: React.RefObject<HTMLElement>
}): { ref: React.RefObject<HTMLDivElement> }
// 行为：Esc 关闭；Tab/Shift+Tab 焦点圈闭（面板内首尾循环）；
// 打开时聚焦面板容器或 initialFocusRef；关闭后恢复先前 activeElement；
// body 滚动锁复用 BottomSheet 的 lockBodyScroll（抽到 src/platform/dom.ts）
```

- 接入：HabitDialog、SettingsDialog、GalleryDialog、MonthlyPosterModal、PolaroidModal、FoundationNoteDialog、BlockDropModal、ConfirmDialog（各替换现有零散的 window keydown，保持其余视觉/逻辑零改动）。
- BottomSheet 改用同一 hook（保留拖拽手势，现有 12 个测试保护行为）。
- ConfirmDialog 移动端分支复用 BottomSheet 容器（桌面仍是居中卡片，视觉不变）。
- 顺带统一遮罩：BottomSheet 的 `rgba(0,0,0,0.45)` 与 `.overlay` 的 `0.32`（暗色 0.65）收敛为 CSS 变量 `--overlay`（theme.css 四主题各定义）。

**验收**：hook 单测（jsdom：Esc 触发 onClose、Tab 循环、关闭后焦点恢复）；手测各弹窗键盘可达。

### 4.2 快捷键弹窗守卫

**设计**：`App.tsx:240-247` 数字键 handler 开头：`document.querySelector('[role="dialog"][aria-modal="true"]')` 存在则 return；排除元素集合补 `select` 与 `[contenteditable]`。

**验收**：单测——模拟 HabitDialog 打开时按 `1` 不切换 tab。

### 4.3 主题色收口（唯一点缀色纪律）

**问题**：5 处硬编码 `#f59e0b`（oat/fog 主题下星标仍是另一种琥珀）；错误状态误用 accent。

**设计**（不改变亮色主题观感——`#f59e0b` 与亮色主题 `--accent #F5B301` 视觉近似，统一后 oat/fog 主题星标跟随主题点缀色，这正是"唯一点缀色"的原意）：
- `HabitRow.tsx:482`、`Stats.tsx:445-446,453`、`PolaroidModal.tsx:283`、`ui.css:991-993` → `var(--accent)`（半透明处用 `color-mix(in srgb, var(--accent) 10%, transparent)`）。
- `SettingsDialog.tsx:457` 错误状态 → `var(--danger)`。
- `ui.css:52-55` 窗口关闭按钮 hover → `var(--danger)`（现状误用 `--progress-green`）。
- `ui.css:853` 硬编码绿阴影 → `color-mix(in srgb, var(--progress-green) 30%, transparent)`。
- `HabitRow.tsx:632` 成功按钮 `color: '#ffffff'` → `var(--surface)`。

**验收**：四主题切换截图走查（星标、错误提示、成功按钮）；grep `#f59e0b` 归零。

### 4.4 i18n 收口（90 处内联三元）

**问题**：`lang === 'zh' ? … : …` 内联翻译绕过 t() 体系，types.ts 的 en/zh 对齐约束形同虚设。

**设计**（分两个 PR 控制体量）：
- **PR-A（高可见面）**：Today 全勤卡（`Today.tsx:273-314`）、WebDAV 表单（`SettingsDialog.tsx:405-472`）、统计标签（`Stats.tsx:225-335`）、Build 页文案（`Build.tsx:82-109,229-241`）、Gallery 弹窗。types.ts 新增分组：`today.fullCard.*`、`settings.webdav.*`、`stats.metric.*`、`build.xray.*`。
- **PR-B（低可见面）**：MonthlyPoster/Polaroid 画布文案、`Build.tsx:286` 全角冒号改 locale、`HabitRow.tsx:649` 复用 `t.today.targetMinutes()`、`Stats.tsx:253`/`Today.tsx:331` 复用现成 `t.reflections.brickInspectFrom`。
- **死键处置**：接线 `stats.bestStreak`（Stats 卡 tooltip）、`blockDrop.completedBlueprint`/`nextTargetUnlocked`（落成仪式已有对应时机则接线，否则删）；其余（`common.required`、`today.earlyConfirmTitle`、`build.exploreShowcase`、`gallery.*`、`stats.totalCount/totalFocusTime`、`tray.*`、`reflections.chronicle*`）确认无调用后删除。

**验收**：`grep -c "lang === 'zh'" src/` 从约 90 降至 < 15（剩余画布绘制类例外需注释说明）；i18n 类型检查保证 key 对齐；`npm test` 全绿。

### 4.5 跨天刷新与托盘判定统一

**问题**：App 层 `todayKey()` 无跨天刷新（过夜后托盘/红点停留昨天）；TraySync 裸查 checkIns 与 `habitMetOnDay` 判定不一致。

**设计**：
- 抽 `src/logic/useTodayKey.ts`：把 `Today.tsx:46-65` 的 10s interval + focus + visibility 逻辑上移为 hook，返回响应式 day。
- `App.tsx`（TraySync、`hasUnfinishedToday`）、`Stats.tsx` 换用该 hook。
- TraySync `done` 判定改 `habitMetOnDay(h, checkIns, day)`，与 Today 页一致。

**验收**：单测 mock 时间跨天 → hook 返回新值、TraySync 文案更新；手测挂机过午夜托盘 tooltip 正确。

### 4.6 移动端判定与 CSS 对齐

**问题**：`detect.ts:15-19` 触屏桌面窗口缩窄误切移动布局；`mobile.css:80` 的媒体查询与 JS 判定错位。

**设计**：
- `detect.ts`：`(w <= 768 && maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches)` ——粗指针才判 mobile，触屏笔记本（fine pointer）归 desktop。
- `mobile.css` 中字号/触控目标规则从 `@media (max-width: 768px)` 改挂 `.mobile-app-root` 后代选择器；`App.tsx` 根容器已有移动 class 的确认挂上 `mobile-app-root`（与现有 `.habit-card.mobile` 体系并存）。

**验收**：手测 Windows 触屏笔记本缩窄窗口不切移动布局；窄窗口移动布局样式不回归（现有 HabitRowMobile 测试保护 JS 侧）。

### 4.7 其余交互修缮（清单）

| 项 | 位置 | 设计 |
| --- | --- | --- |
| `.dialog h3` 规则覆盖 | `ui.css:267-270` vs `204-210` | 删除通用 `.dialog h3` 规则，恢复 header 间距 |
| setTimeout 泄漏 | `Today.tsx:122`、`HabitRow.tsx:155-158,174-178`、`App.tsx:76`、`BlockDropModal.tsx:49` | ref 收集 timer id，unmount cleanup 清空 |
| async listen 泄漏 | `App.tsx:128-149`、`TrayMenu.tsx:39-58`、TitleBar | `let disposed = false`；resolve 后若已卸载立即 unlisten |
| toggleMini 丢窗口尺寸 | `App.tsx:220-234` | 进 mini 前 `win.outerSize()` 存 ref，退出恢复原尺寸（无记录时才用 1100×760 兜底） |
| 掉落动画重播 | `BlockDropModal.tsx:54` | `handleAnimated` 包 `useCallback`；`BuildScene` 动画 effect 依赖收窄为 `[placedCount, animateIndex]`，draw 经 ref 读取 |
| 展台满位静默重叠 | `showcase.ts:133`、`Showcase.tsx:20-28` | `findNextAvailablePlacement` 满位返回 `null`，自动排列改走 `updateShowcasePlacement` action，满位 toast 提示 |
| 补签热图键盘不可达 | `Heatmap.tsx:76-89` | 单元格改 `<button>` + aria-label（日期+状态），样式保持 |
| useRepairBrick 校验 | `appStore.ts:334-353` | 拒绝归档习惯与未来日期（`date > todayKey()` → `{ok:false, reason:'future'}`，补 locale key） |
| custom 连胜 365 上限 | `streak.ts:48` | 删除 365 硬上限（days 集合有限循环天然终止），补边界单测 |
| AudioContext 挂起积压 | `sound.ts:17-27` | `ctx.state === 'suspended'` 时 `await resume()` 成功后再调度，失败静默跳过本次 |
| smoothScroll 归位 | `logic/smoothScroll.ts` | 移至 `platform/smoothScroll.ts`（纯移动，测试同步移动） |
| O(n²) 周计数重复 | `checkin.ts:17-26` vs `streak.ts:17-24` | `streak.ts` 改 import `weekCountFor`，删除重复实现 |
| Reward 死字段 | `types.ts:54 rewardBlockIndex` | 本批标注 `@deprecated`（merge 兼容读取），批次三 v2 迁移时删除 |

**验收**：`npm test` 全绿；逐项手测走查。

---

## 5. 批次五：渲染与列表性能

### 5.1 HabitRow/Today 订阅与 memo 修正

**问题**：任意打卡令全部卡片重渲染（订阅整表）；`Today.tsx:73-103` 的 `active` 每次 render 新数组导致下游 5 个 useMemo 全部失效；`Stats.tsx` rows 同。

**设计**：
- `Today.tsx`：`const active = useMemo(() => habits.filter(...), [habits])`——下游 `categories/filteredActive/metCount/grouped` 连锁生效；`Stats.tsx` rows 的 `now` 依赖改为 hook 内 state。
- `HabitRow`：`React.memo` 包裹；`checkIns` 整表订阅改为精确 selector：

```ts
const EMPTY: CheckIn[] = []
const useTodayCheckIns = (habitId: string, day: string) =>
  useAppStore((s) => {
    // 返回稳定引用：命中返回原数组切片缓存，未命中返回模块级 EMPTY
  })
```

  实现为 store 层提供 `selectTodayCheckIns(state, habitId, day)`（内部 Map 缓存按 `state.checkIns` 引用失效），保证 zustand 浅比较通过——只有本习惯当日记录变化才重渲染该卡片。
- `todayCheckIn` 的 `[...checkIns].reverse().find()` 一并并入上述 selector。

**验收**：selector 稳定性单测（无关打卡后 selector 引用不变）；手测 60+ 习惯演示数据打卡流畅。

### 5.2 BuildScene 每帧热路径

**问题**：`BuildScene.tsx:202-215,230-231` 每帧重建 `indexAt` Map、cubes 数组并 sort；循环内 `find(...)` 逐块线性扫描。

**设计**：派生数据（排序后的 cubes、indexAt、build→checkIn 映射）移入 `useMemo([builds, checkIns, blueprints])` 结果存 ref；rAF 循环只读 ref。动画期间的增量（新块）通过 `animateIndex` 单独处理，不触发全量重算。

**验收**：功能回归（现有渲染测试/手测落块动画）；DevTools 火焰图无每帧 GC 尖峰。

### 5.3 iso.ts 块精灵缓存（最大性能抓手）

**问题**：`iso.ts:447-489` `drawCube` 每块每帧新建 5 个 CanvasGradient + clip，大建筑级联动画每帧数百次渐变分配。

**设计**：按 `(colorKey, type, dpr, tileW)` 缓存单块预渲染位图：

```ts
const spriteCache = new Map<string, OffscreenCanvas | HTMLCanvasElement>()
function getCubeSprite(color: string, type: BlockType, cfg: IsoConfig, dpr: number): CanvasImageSource
// 首次绘制：离屏 canvas 上执行现有三面渐变+描边+凸点全套矢量绘制；之后 drawCube 直接 drawImage
// 缓存上限：蓝图 169 块 × 配色 ≤ 8 种 × dpr 2 = 全量缓存体积可控；LRU 512 兜底
```

- AO 压痕、落地阴影、bonus 点缀描边（依赖邻块状态）保持矢量叠加层，不进精灵。
- 主题切换时清空缓存（colorKey 含从 CSS 变量派生的实际色值，天然失配）。

**验收**：手测 161 块城堡全量落成动画帧率（目标 60fps 中端核显）；各主题/bonus 块视觉逐像素比对无回归（截图 diff）。

### 5.4 ShowcaseScene 与 DPR

- `ShowcaseScene.tsx:244-273`：拖拽 pointermove 不再全量重建 `allCubes`（ref 读取 + 脏区标记重绘）；`draw` 依赖收窄（placements 走 ref），监听只绑一次。
- 静态底座（托盘+网格线）缓存离屏层。
- 两场景补 DPR 变化监听：`matchMedia(`(resolution: ${dpr}dppx)`)` change → 重设画布尺寸（跨显示器拖动不再模糊）。

**验收**：跨 DPI 屏拖动窗口清晰度；展台拖拽流畅度手测。

---

## 6. 批次六：产品化 backlog（按需排期，不在本轮）

| 项 | 要点 |
| --- | --- |
| 自动更新 | `tauri-plugin-updater` + 更新清单签名 + `createUpdaterArtifacts` |
| CSP | `default-src 'self'` + `style-src 'self' 'unsafe-inline'`；注意 WebDAV 任意用户域名意味着 `connect-src` 只能放宽到 `https:`（写明取舍）；`frame-ancestors 'none'` |
| fs scope 最小化 | 删 `fs:allow-appdata-*-recursive`，精确 scope 到 `blockhabit*.json`（含 backup/corrupt 后缀） |
| 音量滑杆 | `sound.ts` 主 `GainNode` + `settings.volume`（0-100）+ 设置页滑杆（沿用现有 UI 语言） |
| WebDAV 凭据 keyring | `tauri-plugin-stronghold` 或系统 keyring；依赖批次三的 error code 体系 |
| 周起始日配置 | `settings.weekStart: 'mon' | 'sun'`，`dates.ts` weekStart/weekCountFor 贯通，统计热图列头联动 |

---

## 7. 已接受的取舍（明确不做/暂不做）

1. **repairBricks 合并维持 `Math.max`**：双设备同时消费修复砖最多凭空多出 1 块额度（补卡本身有"该日无打卡"幂等约束，最坏多补一卡，低危）。严格化需引入消费事件账本，性价比不足，记录为已知限制。
2. **墓碑 GC 90 天**：离线超过 90 天的设备参与合并时，超期墓碑已被清理，对应删除可能复活一次。桌面应用场景概率极低。
3. **WebDAV 密码仍存 localStorage（明文）**：本轮仅做防抖落盘 + README 风险说明；keyring 在 backlog。
4. **schema 混版本同步**：v2 档被旧版应用拉取时报"结构不兼容"安全失败（不覆盖本地）；旧版推 v1 覆盖云端后，新版迁移会丢失墓碑 → 已删打卡复活一次。发布 v2 后旧版共存期短（本地优先、无强制升级通道），接受。
5. **CSP 本轮不动**：`connect-src` 与用户自配 WebDAV 域名冲突，需产品决策，进 backlog。
6. **PolaroidModal 硬编码米白色板**：视为设计意图（拍立得实体隐喻），代码补注释说明，不改行为。
7. **打卡合并的日键语义边界（v2 实现期记录）**：非 counter 打卡按 `habitId+date` 日键合并——A 撤销后，B 离线期间同习惯同日新建的打卡（不同 id）合并时会被并入墓碑记录。符合"删除不可逆"原则，但与全勤领取的 LWW（支持重领）不对称；如需对等语义需引入操作日志，v3 再议。
8. **习惯硬删除（deleteHabit）的同步语义**：习惯本体无墓碑，双设备并集合并会使"硬删除的习惯"在下次同步时复活（v1 行为如此，未回归）。软删除（归档）有 LWW 保护，产品语义上推荐归档；硬删除复活问题记入 backlog。
9. **墓碑 GC 位于合并路径**（mergeAppState 内），从不参与同步的设备其墓碑不清理——量级极小（每条 < 200B），接受。
10. **同步窗口残留竞态**：syncNow 在网络往返后现场读取 store 快照（而非预取快照），合并覆盖窗口从整个 RTT 缩小到合并瞬间；彻底消除需操作日志版本化合并，超出本轮范围。
11. **i18n 全量收口分阶段实施**：本轮完成统一弹窗 a11y、主题色收口、跨天刷新、触屏判定、showcase/repair 校验、性能 memo 等批次四主体；90 处 `lang === 'zh'` 内联翻译中，剩余低频面（画布绘制文案、Build 页次级文案等）按 PR-B 仍为后续机械重构项——行为正确（双语均正确显示），仅是可维护性债务。
12. **Canvas 热路径优化（5.2/5.3）延后**：BuildScene 每帧 Map 重建/全量排序与 iso.ts 每帧渐变分配的精灵缓存（OffscreenCanvas 预渲染）需要配套像素级视觉回归验证（四主题 × bonus 块 × AO 叠加），本轮未实施；rAF 清理与 DPR 补偿已就位。延后至有视觉 diff 工具时实施。
13. **HabitRow 精确订阅（5.1 部分）**：已完成 reverse 拷贝消除、谓词复用与 Today/Stats 侧 memo 修复；完整的"无关打卡零重渲染"需 React.memo + 父层 useCallback 链路稳定化（Today 的 onCheck 内联箭头）+ store 层内容等价缓存 selector 三件套，超出本轮机械改造的安全边界，延后实施。
14. **音效 resume 策略**：`getAudioContext` 保持 eager `void resume()`（触发多来自用户手势、挂起窗口极短），未按"await 成功后再调度"实现；suspended 期间事件齐发的理论风险记录在案。
15. **遮罩统一/ConfirmDialog 移动容器/移动端 16px 规则**：`--overlay` 变量、ConfirmDialog 移动端 BottomSheet 化、mobile.css 16px 规则移挂 `.mobile-app-root` 三项未实施（行为无回归，纯一致性收尾，随 PR-B 处理）。

## 8. 验证与交付策略

- **每条目**：先补/改测试再实现（项目已有 vitest 单测文化）；批次结束 `npm test` 全绿 + `tsc --noEmit` 零错误。
- **批次三结束**：新增 `userScenarios.test.ts` 同步场景组（§3.1 验收清单）；手工双实例（single-instance 关闭的 dev 构建）+ 本地 WebDAV（docker nknika/nginx-dav）端到端验证合并正确性。
- **批次四结束**：四主题 × zh/en 截图走查（星标/错误态/弹窗焦点/空态）；键盘全流程走查（Tab/Esc/快捷键）。
- **批次五结束**：`?demo-castle` 扩展为 161/169 块全量数据，录制落块动画帧率前后对比。
- **提交切分**：每批次 1 个分支，按条目小步提交（`fix:`/`feat:`/`refactor:`/`chore:` 前缀与仓库现有风格一致）；批次三含 `schemaVersion` 升级单独成 commit 以便回滚定位。
