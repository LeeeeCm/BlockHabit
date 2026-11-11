# BlockHabit 第四轮：打开回路 · 提示 · 流畅度（2026-11-10）

> 本方案承接前三轮（缺陷/同步、体验修复、可靠性与视觉收口），目标从「能长期用」推进到「**用户愿意每天主动打开**」。
> 设计依据：`design/README.md` A1–A7、`design/AESTHETIC.md`、`design/VOICE.md`；所有记录：D-20261110-052 … -058。

## 0. 本轮要解决的三件事

1. **打开动机**：今日页只回答「有什么」，不回答「还剩几件、离落成多远、从哪开始」；也没有晚间收尾提醒把用户拉回来。
2. **提示缺失**：滚轮缩放/拖拽、展台点击看相纸、热图灰阶含义、数字键 1–4 切页——全靠误打误撞；空态建习惯仍要填表单。
3. **第一印象**：异步读档前先渲染空态造成闪变；Build/Showcase/Stats/MiniDeskToy 全部静态 import，首屏解析成本被抬高；渲染热路径缺可复现数字。

## 1. 实施范围（按文件所有权切分，避免并发写冲突）

| 工作流 | 负责人 | 写入范围 | 对应记录 |
| --- | --- | --- | --- |
| 今日简报 + 模板 + 水合门（页面静态 import / 仅 MiniDeskToy 懒加载）+ 晚间提醒 + i18n/设置 | Lead | `src/App.tsx`、`src/pages/Today.tsx`、`src/components/TodayBrief.tsx`、`src/components/HabitTemplates.tsx`、`src/components/ReminderWatcher.tsx`、`src/components/SettingsDialog.tsx`、`src/components/BlockDropModal.tsx`（如需要）、`src/logic/todayBrief.ts`、`src/logic/habitTemplates.ts`、`src/logic/eveningNudge.ts`、`src/types.ts`、`src/store/appStore.ts`、`src/storage/adapter.ts`、`src/i18n/**` | 052/053/055/056 |
| 页面提示系统 | guide-impl | `src/components/GuideTip.tsx`、`src/platform/guideTips.ts`、`src/pages/Build.tsx`、`src/pages/Showcase.tsx`、`src/pages/Stats.tsx` + 对应测试 | 054 |
| 渲染性能实测与优化 | perf-engineer | `src/render/**`、`.tmp-perf/**` | 057 |
| 竞品与差异化研究 | market-analyst | `docs/superpowers/specs/2026-11-10-blockhabit-competitive-and-innovation.md` | 058 |
| 集成验证 | verifier | `.tmp-verify-round/**`（不改 src） | 全部 |

**硬规则**：不新增依赖；不改视觉语言（只允许既有令牌）；所有用户可见文案进 i18n（zh/en 同时补）；不删除 design/ 下任何文件；不修改测试来放水；不动 `src-tauri/target`、`dist/`。

## 2. 交互与视觉规格

### 2.1 今日简报（TodayBrief）
- 位置：今日页标题行与分类过滤之间，存在在册习惯且未全部完成时渲染；全部完成后隐藏（全勤卡接管）。
- 结构：左侧两行文字 + 右侧一个胶囊主按钮；`padding: 12px 16px`；`border: 1px solid var(--line)`；`border-radius: var(--r-md)`；背景 `var(--surface)`；无阴影、无新颜色。
- 问候：5–10 早上好 / 11–13 中午好 / 14–17 下午好 / 18–22 晚上好 / 其余 夜深了（边界以纯函数为准）。
- 事实行与期待行（见记录 052）；CTA「开始第一个」→ 滚动到第一件未完成习惯并脉冲高亮（复用 `habit-focus-flash` 类）。
- 窄窗口（≤ 720px 内容宽）：CTA 换到第二行右侧，不遮挡文字。

### 2.2 模板（HabitTemplates）
- 空态三步说明之后、按钮组之前；一行胶囊，可换行；点击即 `addHabit(name, { type: 'daily' }, { period })`。
- 5 个模板：water/read/walk/sleep/ledger（见记录 053）。

### 2.3 页面提示（GuideTip）
- 通用组件 props：`{ id, icon, title, body, onDismiss, variant?: 'fixed' | 'inline' }`。
- 固定态：`position: fixed; left: 20px; bottom: 84px; max-width: 320px; z-index: 60`（避开 tabbar 高 64px）；内联态：正常文档流，`margin: 12px 0`。
- 结构：图标 + 标题（`--fs-body` 600）+ 说明（`--fs-small`、`--ink-2`、line-height 1.6）+「知道了」文字按钮（`--fs-small`，下划线？不——用胶囊 ghost）。
- 白底 `var(--surface)`、1px `var(--line)`、`--r-md`、`box-shadow: 0 2px 8px rgba(0,0,0,0.06)`（与现有 Build 浮动条一致）；无新色相。
- 行为：挂载即标记已读（更简单，避免用户不点就永远重复）；Esc 关闭；不抢焦点。
- 三页接入条件：Build 已放置 ≥1 块；Showcase 已有摆放；Stats 有在册习惯。

### 2.4 晚间收尾提醒
- 一次性确认卡（仅当 `checkIns.some(!deletedAt)` 为真且 localStorage 无 consent 时，出现在简报位置下方）；两个按钮：开启提醒 / 暂时不用。
- 设置 → 提醒组：开关 + 时间（`<input type="time">` 沿用现有原生控件样式），副文案注明「应用运行中生效」。
- 通知正文只陈述事实；全局提醒开关关闭时不触发；每天最多一次。

### 2.5 启动性能（2026-11-10 实测修正）
- 水合完成前：渲染与主题一致的空白壳（背景 `var(--bg)`，`aria-busy`），不渲染今日空态、也不渲染可交互的标题栏/底栏，避免读档期间误点。
- Build / Showcase / Stats **保持静态 import**：实测 React.lazy 首次切页有 ~300ms 的 Suspense 延迟提交空白（`.tmp-perf/report.md` §5），比冷启动节省的几十毫秒更伤体验；只有 MiniDeskToy 懒加载（仅在迷你模式出现，3.4KB）。
- 切页不再需要 fallback；水合门本身保留。

## 3. i18n 契约（由 Lead 先落地，其他工作流只读）

新增顶层组：`todayBrief`、`templates`、`guide`、`eveningNudge`；`common` 增加 `shortcut(label, key)`。具体键名见 `src/i18n/types.ts` 落地后的定义。**guide-impl 不修改 i18n 文件**，直接使用 `t.guide.*` 与 `t.common.shortcut`。

## 4. 验收与证据

1. 门禁：`npx tsc --noEmit` 0 错误；`npm test` 全绿（含新增单测）；`npm run design:check` 通过；`npm run build` 通过。
2. 浏览器实测（agent-browser，dev 1420 + 生产 preview）：四主题 × 今日/建造/展台/统计/设置截图；关键流程录屏式步骤（空态→模板建习惯→打卡→简报变化→提示→设置重看→晚间提醒开关）。
3. 性能证据：启动/切页 long task、FPS、主 chunk 体积（页面静态 import 后 308.75KB / gzip 94.68KB）；渲染改造像素 diff 0。
4. 视觉证据：改动前（当前 HEAD 工作区）与改动后同视口截图对比；未计划变化的区域像素差 0。
5. 竞品文档：10+ 应用对比 + 来源链接 + 5 条以上差异化建议。

## 5. 时间盒

- 0–60min：方案/记录/i18n/契约 + 三路并行启动；
- 60–180min：实现与自测；
- 180–240min：集成、截图、门禁、修复；
- 240min+：验证与最终答复（含竞品分析与创新建议摘要）。

> 本文为执行计划，不替代设计记录。任何偏离需先更新记录再由 Lead 决定。
