# BlockHabit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 极简黑白风格的 Tauri 桌面习惯打卡应用，打卡掉落 2.5D 等距积木拼建城堡/工厂。

**Architecture:** Tauri 2 壳 + Vite/React/TS 前端；纯逻辑层（打卡/连击/蓝图）与渲染层（等距 Canvas）分离，zustand 单 store，StorageAdapter 抽象持久化（localStorage → Tauri fs）。

**Tech Stack:** Tauri 2, React 18, TypeScript, Vite, zustand, vitest, Canvas 2D

**Spec:** `docs/superpowers/specs/2026-08-22-blockhabit-design.md`

---

## Task 0: Rust 工具链

- [ ] 安装 rustup（MSVC 工具链）并验证

```bash
cd /tmp && curl -sSLO https://win.rustup.rs/x86_64 && ./x86_64.exe -y --default-toolchain stable-msvc
export PATH="$HOME/.cargo/bin:$PATH" && cargo --version && rustc --version
```

Expected: cargo 1.7x.x 输出版本号。若链接器报缺 Windows SDK → 用 VS Installer 给 VS2022 补 "Windows 10/11 SDK" 组件后重试。

## Task 1: 项目脚手架

**Files:** Create: 项目根全部（package.json、src/、src-tauri/ 等）

- [ ] 在子目录生成 Tauri 模板后移到根（根目录已有 docs/ 非空，脚手架拒绝非空目录）

```bash
cd F:/PROJECT001/BlockHabit
npm create tauri-app@latest tmp-app -- --template react-ts --manager npm --identifier com.blockhabit.app -y
mv tmp-app/* tmp-app/.[!.]* . 2>/dev/null; rmdir tmp-app
```

- [ ] 安装依赖与工具

```bash
npm install && npm install zustand && npm install -D vitest
```

package.json scripts 增加 `"test": "vitest run"`。
- [ ] `npm run tauri dev` 首次编译跑通空白窗口（Rust 首编约 3-10 分钟）
- [ ] `git init && git add -A && git commit -m "chore: tauri+vite+react scaffold"`

## Task 2: 类型与主题

**Files:** Create: `src/types.ts`, `src/theme.css`；Modify: `src/main.tsx`(引入 theme.css), `src/App.tsx`

- [ ] `src/types.ts`：按 spec §5 定义 `Habit / CheckIn / BlockType / BlockDef / Blueprint / PlacedBlock / AppState / Theme`

```ts
export interface Habit {
  id: string
  name: string
  frequency: { type: 'daily' } | { type: 'weekly'; times: number }
  createdAt: string
  archivedAt?: string
}
export interface CheckIn { id: string; habitId: string; date: string; at: string; rewardBlockIndex?: number }
export type BlockType = 'basic' | 'flag' | 'window' | 'gate' | 'chimney'
export interface BlockDef { x: number; y: number; z: number; type: BlockType }
export interface Blueprint { id: string; name: string; blocks: BlockDef[] }
export interface PlacedBlock { id: string; blueprintId: string; index: number; placedAt: string; fromHabitId: string; bonus: boolean }
export interface AppState {
  schemaVersion: 1
  habits: Habit[]
  checkIns: CheckIn[]
  builds: PlacedBlock[]
  activeBlueprintId: string
  completedBlueprintIds: string[]
  settings: { theme: 'light' | 'dark' }
}
```

注意：`PlacedBlock.bonus` 替代 spec 中"特殊积木类型"表述——连击里程碑时下一次积木以点缀色描边渲染（见 Task 4 `awardBlock`）。
- [ ] `src/theme.css`：spec §3.1 CSS 变量（light 默认 + `[data-theme='dark']` 覆盖），`html,body,#root{height:100%}` 基础样式，Inter 字体栈
- [ ] Commit: `feat: types and theme tokens`

## Task 3: storage adapter（TDD）

**Files:** Create: `src/storage/adapter.ts`; Test: `src/storage/adapter.test.ts`

- [ ] 失败测试：load 空/损坏返回 null；save→load 往返；损坏数据触发备份回调

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalStorageAdapter } from './adapter'
describe('localStorage adapter', () => {
  beforeEach(() => localStorage.clear())
  it('returns null when empty', async () => {
    expect(await createLocalStorageAdapter().load()).toBeNull()
  })
  it('roundtrips state', async () => {
    const a = createLocalStorageAdapter()
    const s = { schemaVersion: 1, habits: [], checkIns: [], builds: [], activeBlueprintId: 'castle', completedBlueprintIds: [], settings: { theme: 'light' } } as any
    await a.save(s); expect((await a.load())!.activeBlueprintId).toBe('castle')
  })
  it('returns null on corrupt json and backs up', async () => {
    localStorage.setItem('blockhabit-state', '{oops')
    const a = createLocalStorageAdapter()
    expect(await a.load()).toBeNull()
  })
})
```

- [ ] 实现：`createLocalStorageAdapter(): StorageAdapter`，`load()` 内 try/catch + JSON.parse 校验 `schemaVersion===1`，失败返回 null；`save()` JSON.stringify
- [ ] `npx vitest run` 通过；Commit `feat: storage adapter`

## Task 4: 纯逻辑层（TDD，核心）

**Files:** Create: `src/logic/dates.ts`, `src/logic/checkin.ts`, `src/logic/streak.ts`, `src/logic/blueprint.ts`; Tests: 同目录 `*.test.ts`

- [ ] `dates.ts`：`todayKey(d=new Date())`（本地 YYYY-MM-DD）、`weekStart(d)`（返回周一 00:00 Date）、`addDays(d,n)`、`dateKey(d)`
- [ ] **checkin.test.ts → checkin.ts**：
  - `canCheckIn(habits, checkIns, habitId, day)` → `{ok, reason?: 'no-habit'|'archived'|'already'|'weekly-full'}`
  - 日频：同日重复 → `already`；周频(3)：本周已有 3 条 → `weekly-full`，2 条 → ok
  - `weekCheckIns(checkIns, habitId, day)` 只统计 `weekStart(day)` 起 7 天
- [ ] **streak.test.ts → streak.ts**：
  - `currentStreak(habit, checkIns, today)`：日频连计/断日清零/今日未打从昨起算；周频按"连续达标整周"计数（本周已达标也计入）
  - `bestStreak(habit, checkIns)`：全历史最长
- [ ] **blueprint.test.ts → blueprint.ts**：

```ts
export function nextSlot(blocks: BlockDef[], placedCount: number): BlockDef | null
export function isComplete(blocks: BlockDef[], placedCount: number): boolean
export function awardBlock(streakAfterCheckIn: number): boolean  // streak>0 && streak%7===0 → bonus
```

  - 测试：nextSlot 越界返回 null；isComplete 边界；awardBlock(7)=true, (6)=false, (14)=true
- [ ] `npx vitest run` 全绿；Commit `feat: checkin/streak/blueprint logic`

## Task 5: 蓝图数据（程序化生成）

**Files:** Create: `src/logic/blueprints/castle.ts`, `factory.ts`, `src/logic/blueprints/index.ts`; Test: `src/logic/blueprints/blueprints.test.ts`

- [ ] `castle.ts`：导出 `castleBlueprint: Blueprint`。9×9 地基：周边墙高 2（basic）、四角塔 5×5？→ 四角 2×2 塔高 5 顶层 flag、正面门中 2 宽 gate(z=0..1)、中心主楼 3×3 高 4 带 window。生成顺序**自下而上、由内向外**（按 z 升序、`x+y` 距中心升序排序）保证视觉稳定
- [ ] `factory.ts`：11×7 厂房：围墙高 2、双烟囱高 6（chimney 顶）、屋顶 window 天窗、正面 gate。同规则排序
- [ ] 测试（两蓝图共用）：块数 100~250、无悬空块（每个 z>0 块正下方存在块或 z===0）、无重复坐标、排序满足 z 升序
- [ ] `index.ts`：`blueprints: Record<string, Blueprint>`、`getBlueprint(id)`；Commit `feat: castle and factory blueprints`

## Task 6: zustand store

**Files:** Create: `src/store/appStore.ts`

- [ ] `createAppStore(adapter)`：state=AppState 默认值（activeBlueprintId:'castle'）+ actions：
  - `addHabit(name, freq)` / `updateHabit(id, patch)` / `archiveHabit(id)`
  - `checkIn(habitId): { placed?: BlockDef; bonus: boolean; complete: boolean } | null`——纯函数来自 Task4，写 CheckIn + PlacedBlock，蓝图完成时把 id 移入 completedBlueprintIds
  - `chooseBlueprint(id)`（重置 builds 中该蓝图?否——builds 保留，activeBlueprintId 换新）
  - `setTheme(t)`（同步 `document.documentElement.dataset.theme`）
  - `exportData(): string` / `importData(json): boolean`（schemaVersion 校验）
- [ ] 订阅 debounce 300ms `adapter.save(state)`；启动 `await adapter.load()` 恢复
- [ ] Commit `feat: app store with persistence`

## Task 7: 等距渲染（TDD 数学 + 绘制）

**Files:** Create: `src/render/iso.ts`; Test: `src/render/iso.test.ts`

- [ ] 数学测试：`worldToScreen` 纯函数

```ts
export interface IsoConfig { tileW: number; tileH: number; blockH: number }
export function worldToScreen(x: number, y: number, z: number, c: IsoConfig) {
  return { sx: (x - y) * (c.tileW / 2), sy: (x + y) * (c.tileH / 2) - z * c.blockH }
}
export const depth = (x: number, y: number, z: number) => x + y + z
```

  - 测试 (0,0,0)→(0,0)；(1,0,0) 与 (0,1,0) 对称；z 抬升 sy
- [ ] `drawCube(ctx, sx, sy, c, colors)`：以 (sx,sy) 为立方体**顶面中心**画菱形顶 + 左右平行四边形，1px 描边 `--line` 色；`drawFlag/drawWindow/drawGate` 在对应面上叠加点缀色小图形
- [ ] Commit `feat: isometric renderer`

## Task 8: App 骨架与今日页

**Files:** Create: `src/App.tsx`(改), `src/pages/Today.tsx`, `src/components/HabitRow.tsx`, `src/components/HabitDialog.tsx`

- [ ] App：底部三 tab（今日/建造/统计）+ 右上设置齿轮；`setTheme` 初始化
- [ ] Today：日期头 + 习惯列表 + "+"悬浮按钮；HabitRow 显示名称、频率、今日状态（未○灰/已●点缀色）、streak 徽标；点击已归档习惯不显示
- [ ] HabitDialog：新建/编辑（名称必填、频率 daily|weekly+n 次滑条 1-7）
- [ ] 打卡交互：点击行 → `store.checkIn()` 返回 placed → 行内方块翻转动效（CSS transform 240ms）+ 底部 toast "🏰 +1 积木"（仅文案，无 emoji 也可）
- [ ] Commit `feat: today page with check-in`

## Task 9: 建造视图

**Files:** Create: `src/render/BuildScene.tsx`, `src/pages/Build.tsx`

- [ ] BuildScene：Canvas 全区，DPR 适配；wheel 缩放 (0.5~2)、pointer 拖拽平移；每帧绘制 = 已放积木（按 blueprint 顺序）+ 未放位置虚线剪影（alpha 0.15）；落块动画：新块从 +6z 落下 ease-out-bounce 300ms（requestAnimationFrame，仅动画期间重绘 + dirty flag）
- [ ] Build 页：蓝图名 + 进度 `X / Y` + 进度条；完成后落成仪式覆盖层（灰白粒子 canvas 2s + 点缀色标题"落成！"）→ 选择下一蓝图按钮列表（排除已完成）；空状态引导文案
- [ ] Commit `feat: build scene with ceremony`

## Task 10: 统计页

**Files:** Create: `src/pages/Stats.tsx`, `src/components/Heatmap.tsx`

- [ ] Stats：每习惯卡（current/best streak、总次数，纯 Task4 函数）
- [ ] Heatmap：近 13 周列网格，日格灰阶 = 当日完成比例，全完成日点缀色；无图表库
- [ ] Commit `feat: stats page`

## Task 11: 设置 + Tauri 持久化

**Files:** Create: `src/components/SettingsDialog.tsx`, `src/storage/tauriStorage.ts`; Modify: `src/main.tsx`

- [ ] SettingsDialog：主题切换（亮/暗）、导出（`@tauri-apps/plugin-dialog` save + `plugin-fs` writeFile，浏览器回退 a[download]）、导入（file input + `importData` 校验，成功/失败 toast）
- [ ] tauriStorage：同 adapter 接口，读写 `appDataDir/blockhabit.json`，损坏时备份 `blockhabit.backup-v{n}.json`（spec §8）
- [ ] 启动时 `adapter = window.__TAURI_INTERNALS__ ? tauriStorage : localStorageAdapter`
- [ ] Commit `feat: settings and tauri persistence`

## Task 12: Logo 与图标

**Files:** Create: `src/assets/logo.svg`, `src-tauri/icons/*`

- [ ] 按 ip-as-logo 方法论手绘 SVG 吉祥物：小方块角色（4-7 大形状、黑白 + 点缀色 3 色内、下角构图）——一个头上顶着积木的方形小家伙；同时作应用内关于页形象
- [ ] 由 logo.svg 派生 32/128/128@2x/icon.ico（`npx @tauri-apps/cli icon src/assets/logo-square.png`，先从 SVG 导出 png）
- [ ] Commit `feat: logo and app icons`

## Task 13: 打包与验收

- [ ] `npm run tauri build` 出 NSIS 安装包（src-tauri/target/release/bundle/）
- [ ] 手动走查：新建 2 习惯 → 打卡看掉块 → 连点验证进度 → 落成仪式 → 换工厂蓝图 → 重启验证持久化 → 导出/导入 → 暗色主题
- [ ] `npx vitest run` 全绿；Commit `chore: release build config`

---

## Self-Review 结论

- **Spec 覆盖**：spec §3 视觉→Task2/7/12；§4 页面→Task8-11；§5/6 数据与机制→Task2/4/6；§7 架构→Task1-7 文件结构一致；§8 错误处理→Task3/11；§9 测试→Task3-5/13；§10 里程碑→Task 划分对应 M0-M4
- **偏差说明**：spec §6.2"特殊积木按类型优先"简化为 `bonus` 标记（点缀色描边渲染）——保持蓝图位置完整性，避免跳位破坏建筑结构；需回写 spec
- **类型一致**：`PlacedBlock.bonus` 在 Task2 定义、Task6 写入、Task7/9 渲染消费，命名一致
