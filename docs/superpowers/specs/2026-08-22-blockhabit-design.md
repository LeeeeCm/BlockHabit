# BlockHabit 设计文档

日期：2026-08-22
状态：已批准（与实施计划一致）

## 1. 产品概述

**BlockHabit** 是一款极简黑白风格的桌面端习惯打卡应用。用户每日完成习惯打卡后，会掉落一块 2.5D 等距积木；积木按蓝图逐块拼建，最终形成**城堡、工厂**等建筑。以"亲手搭建"的成长可视化驱动坚持。

- 平台：Windows 桌面应用（Tauri 2）
- 技术栈：Tauri 2 + Vite + React + TypeScript
- 风格：黑白为主、灰阶层次、单一点缀色（琥珀色）用于高亮

## 2. 已确认决策

| 决策项 | 结论 |
|---|---|
| 项目名 | BlockHabit |
| 桌面壳 | Tauri 全程（VS 2022 已就绪，需补装 Rust） |
| 渲染 | Canvas 2D 手写等距投影，无重依赖 |
| 数据 | 本地优先，storage adapter 抽象（localStorage → Tauri fs JSON） |
| 状态管理 | zustand |
| 积木风格 | 2.5D 等距积木 |

## 3. 视觉设计

### 3.1 色板

| Token | 亮色主题 | 暗色主题 | 用途 |
|---|---|---|---|
| `--bg` | `#FAFAFA` | `#0A0A0A` | 页面背景 |
| `--surface` | `#FFFFFF` | `#161616` | 卡片/面板 |
| `--ink` | `#0A0A0A` | `#FAFAFA` | 主文字 |
| `--ink-2` | `#6B6B6B` | `#9A9A9A` | 次级文字 |
| `--line` | `#E5E5E5` | `#2A2A2A` | 分隔线/描边 |
| `--accent` | `#F5B301` | `#F5B301` | 点缀色 |

**点缀色纪律**：琥珀色只出现在三处——已完成状态的勾、今日新落积木的高亮、连击奖励积木。其余一切均为黑白灰。

### 3.2 积木着色（等距立方体三面）

| 面 | 亮色主题 | 暗色主题 |
|---|---|---|
| 顶面 | `#E8E8E8` | `#3A3A3A` |
| 左面 | `#BDBDBD` | `#242424` |
| 右面 | `#4D4D4D` | `#111111` |

特殊积木（旗帜/窗户/大门/烟囱）对应面使用点缀色或镂空。落块时有 240ms ease-out-bounce 下落动画 + 轻微落地尘土（灰色粒子）。

### 3.3 布局

极简三栏底部/侧边导航：**今日 / 建造 / 统计**，加一个设置入口（弹窗）。字体 Inter + 系统回退。界面大量留白，无阴影堆叠，用 1px 线条分割。

## 4. 信息架构与页面

### 4.1 今日（默认页）

- 日期 + 一句问候（极简）
- 习惯列表：每行 = 方块图标 + 名称 + 今日状态（未完成○ / 已完成●点缀色）
- 点击行 → 打卡确认动效（方块翻转）→ 触发积木掉落奖励动画（全屏等距场景浮现 3 秒，或跳转建造页）
- "+"按钮新建习惯

### 4.2 建造

- 主区域：等距积木场景 Canvas，支持滚轮缩放、拖拽平移
- 顶部：蓝图名称 + 进度 `X / Y 块` + 细进度条（灰底，点缀色填充）
- 蓝图完成后：落成仪式（灰白粒子 + 点缀色旗帜点亮），随后可选择下一蓝图
- 空状态：展示蓝图预览剪影（虚线积木轮廓），引导完成第一次打卡

### 4.3 统计

- 每习惯：当前连续天数、历史最长连击、总完成次数
- 日历热图（近 3 个月，灰阶=完成度，点缀色=全完成日）

### 4.4 设置（弹窗）

- 主题切换（亮/暗）
- 数据导出 / 导入（JSON 文件）
- 关于

## 5. 数据模型

```ts
interface Habit {
  id: string
  name: string
  frequency: { type: 'daily' } | { type: 'weekly'; times: number }
  createdAt: string        // ISO
  archivedAt?: string
}

interface CheckIn {
  id: string
  habitId: string
  date: string             // YYYY-MM-DD（本地时区）
  at: string               // ISO datetime
  rewardBlockId?: string   // 该次打卡获得的积木
}

type BlockType = 'basic' | 'flag' | 'window' | 'gate' | 'chimney'

interface BlockDef { x: number; y: number; z: number; type: BlockType }

interface Blueprint {
  id: string               // 'castle' | 'factory' | ...
  name: string
  blocks: BlockDef[]       // 拼建顺序 = 数组顺序（自下而上、由内向外）
}

interface PlacedBlock {
  id: string
  blueprintId: string
  index: number            // 在蓝图 blocks 中的序号
  placedAt: string
  fromHabitId: string
}

interface AppState {
  schemaVersion: 1
  habits: Habit[]
  checkIns: CheckIn[]
  builds: PlacedBlock[]
  activeBlueprintId: string
  completedBlueprintIds: string[]
  settings: { theme: 'light' | 'dark' }
}
```

## 6. 核心机制

### 6.1 打卡规则

- 每习惯每天最多一次打卡；`date` 取本地时区 `YYYY-MM-DD`
- 周频习惯：自然周（周一起）内完成 `times` 次即达标；超出仍可打卡（多打的卡**不**额外掉积木，避免刷块）
- 当日所有未归档习惯达标 → 日历热图记为"全完成"（点缀色）

### 6.2 积木奖励

- 每次有效打卡（当日该习惯首次且未超周频上限）→ 掉落 1 块积木
- 积木位置：取 `activeBlueprint.blocks[builds.length]`（蓝图数组顺序即拼建顺序：自下而上、由内向外，保证结构稳定美观）
- 连击奖励：该习惯连续打卡每满 7 天 → 下一次掉落的积木标记 `bonus: true`，以点缀色描边渲染并计入统计（保持蓝图位置完整性，不做跳位）
- 蓝图拼满 → 记入 `completedBlueprintIds`，触发落成仪式，用户选择下一个蓝图

### 6.3 连击（streak）

- 按习惯计算：连续每个"应打卡日"都有记录（日频=每天；周频=每周满 times 次）
- 断签即清零；不设补签（保持极简）

## 7. 架构

```
src/
  main.tsx                 # React 入口
  App.tsx                  # 路由/页面切换（无需 router，三页 tab 状态即可）
  store/appStore.ts        # zustand 状态 + actions（打卡、习惯 CRUD、蓝图推进）
  storage/
    adapter.ts             # StorageAdapter 接口 + localStorage 实现
    tauriStorage.ts        # Tauri fs JSON 实现（M3 接入）
  logic/
    checkin.ts             # 打卡有效性、周频达标判断
    streak.ts              # 连击计算
    blueprint.ts           # 蓝图顺序、下一空位、完成判断
    blueprints/
      castle.ts            # 城堡蓝图数据
      factory.ts           # 工厂蓝图数据
  render/
    iso.ts                 # 等距投影数学 + 立方体绘制 + 排序
    BuildScene.tsx         # 建造页 Canvas 组件（缩放/平移/动画）
  pages/
    Today.tsx / Build.tsx / Stats.tsx
  components/              # HabitRow、Dialog、ThemeToggle 等
  theme.css                # CSS 变量（亮/暗）
src-tauri/                 # Tauri 壳
```

- **渲染**：`iso.ts` 提供 `worldToScreen(x,y,z)` 与 `drawCube(ctx, ...)`；绘制前按 `x+y+z` 排序（画家算法）。只绘制视口内积木。
- **数据流**：组件 → store action → logic 纯函数计算 → 写状态 → storage 持久化（订阅式自动保存）。
- **依赖**：react、zustand、@tauri-apps/api、vitest。不引入 UI 库与图表库（热图自绘）。

## 8. 错误处理

- 存储读取失败/版本不符：备份旧文件为 `backup-v{n}.json`，从默认空状态启动，界面提示
- 导入 JSON：schema 校验（字段/类型），失败则明确报错不落库
- 打卡幂等：同日重复请求静默忽略

## 9. 测试策略

- **vitest 单测**（纯逻辑层全覆盖）：`checkin.ts`（日频/周频/幂等/跨时区日期）、`streak.ts`（连续/断签/周频达标）、`blueprint.ts`（顺序、完成判断、特殊积木分配）
- **手动验收**：Tauri 窗口内走查三页 + 落成仪式
- 浏览器端可用 browser-use 做 UI 冒烟（M3 后可选）

## 10. 里程碑

- **M0 环境**：rustup + Tauri 脚手架跑通空白窗口
- **M1 核心闭环**：习惯 CRUD + 打卡（含单测）+ 单块积木掉落动画
- **M2 建造视图**：等距渲染 + 蓝图系统 + 城堡 + 落成仪式
- **M3 完整体验**：统计热图 + 工厂蓝图 + 连击特殊积木 + 导入导出 + 主题切换 + Tauri fs 持久化
- **M4 品牌与打包**：SVG 吉祥物 logo（ip-as-logo 方法论）+ 应用图标 + `tauri build` 安装包
