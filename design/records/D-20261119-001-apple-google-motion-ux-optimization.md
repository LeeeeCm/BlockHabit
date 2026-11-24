---
id: D-20261119-001
date: 2026-11-19
title: Apple HIG 与 Google M3 轻量化交互与动效精修：触控板原生滚动分流、零字族跳变、Grid 0fr/1fr 抽屉、等宽数字与快捷视角复位
status: proposed
owner: Antigravity
surface: [global, today, build, stats, settings]
axioms: [A1, A2, A4, A5]
files: [src/platform/smoothScroll.ts, src/platform/smoothScroll.test.ts, src/theme.css, src/components/ui-base.css, src/components/ui-overlay.css, src/components/ui-cards.css, src/components/ui-drop.css, src/components/ui-misc.css, src/components/BlockDropModal.tsx, src/components/Icons.tsx, src/components/settings/Group.tsx, src/components/HabitDialog.tsx, src/components/HabitRow.tsx, src/components/habitrow/HabitRowHeader.tsx, src/components/habitrow/HabitCounterSection.tsx, src/pages/today/TodayHeader.tsx, src/pages/Build.tsx, src/render/BuildScene.tsx, src/render/buildscene/SceneStage.tsx, src/render/isoGround.ts, src/App.tsx, src/themeMotion.test.ts, src/App.test.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

对现有设计体系与代码实现做全量审阅后，在不改变「黑白灰为骨、唯一点缀色、2.5D 等距积木、1px 细线留白」核心美学与本地优先原则的前提下，发现以下可明显提升流畅度、易用性与视觉精致度的轻量化改进点：

1. **精密触控板与无障碍滚动阻塞**：`src/platform/smoothScroll.ts` 无条件拦截 `wheel` 并把每次事件强制放大为 44px 固定步进，导致精密触控板连续手势暴走、横向滚动被拦、未尊重 `prefers-reduced-motion: reduce`，且 `Math.round(nextY)` 在尾段产生 1px 阶梯感。
2. **中文字族因字重切换产生跳变与布局抖动**：`theme.css` 将阿里妈妈数黑体限定在 `font-weight: 600 700`，而 `400/500` 走 MiSans。`ui-misc.css` 的 `.apple-segmented-item.active`、`ui-cards.css` 的 `.pill-action.success`、`ui-drop.css` 的 `.micro-mood-chip.active` 以及 `HabitDialog.tsx` 的星期按钮在激活态把字重从 500/400 跳到 600/700，导致中文在两个截然不同的字族之间突然变形与重排。
3. **非合成/粗粒度 CSS 过渡与布局动画**：`BlockDropModal.tsx` 镌刻抽屉使用 `max-height: 0 -> 150px` 固定裁剪高度；`ui-drop.css`（2 处）与 `HabitDialog.tsx`（1 处）仍存在 `transition: all`；`.habit-card:hover` / `.gallery-card:hover` 等位移悬停缺少 `@media (hover: hover) and (pointer: fine)` 门控，触摸设备点击后会卡在浮起态。
4. **折叠指示符旋转偏心与数字宽度抖动**：`Group.tsx`（`›`）和 `HabitDialog.tsx`（`⌄`）使用字符旋转表达展开状态，基线不居中导致旋转时明显偏移；计时、计数与分段控件未全面启用 `font-variant-numeric: tabular-nums`。
5. **快捷操作与基础令牌收尾**：建造页拖拽/旋转后缺少极简的视角复位（双击画布回正、点击旋转角度归零）；桌面端缺少 `Ctrl/Cmd+,` 打开设置的系统级惯例快捷键，桌面底栏缺少 `aria-current="page"` 语义，习惯卡片状态按钮缺少习惯名称的完整 `aria-label`；`isoGround.ts` 地基填充仍存在一处硬编码 `rgba(128, 128, 128, 0.05)`。

## 设计决定

借鉴 Apple HIG 的克制质感、触感响应与 Google M3 Expressive 的轻量结构化微交互，全部采用原生 Web/CSS 能力零依赖落地：

1. **原生态优先滚轮分流（`smoothScroll.ts`）**：
   - 保留对 Windows/桌面离散鼠标滚轮（`|deltaY| >= 40` 或非像素模式）的 44px 阻尼平滑；
   - 精密触控板连续微位移（`deltaMode === 0 && Math.abs(deltaY) < 40`）、横向滚动（`|deltaX| > |deltaY|`）及 `prefers-reduced-motion: reduce` 直接放行交由浏览器原生 120Hz 合成器处理；
   - 取消 `Math.round(nextY)` 以支持高分屏亚像素插值，并在方向变化或外部滚动时同步真实 `scrollTop`。
2. **零字族跳变与全站显式过渡**：
   - `.apple-segmented-item`、`.pill-action`、`.micro-mood-chip` 与 `HabitDialog` 星期格在切换选中态时保持字重恒定（500 或 600），靠表面对比（白底浮起/墨黑反色/细描边/柔和阴影）传递选中语义；
   - 清零全仓剩余 3 处 `transition: all`，全部替换为显式 CSS 属性列表，并纳入 `themeMotion.test.ts` 回归守门；
   - 悬停位移（`.habit-card:hover`、`.pill-action:hover`、`.gallery-card:hover`、`.chronicle-card:hover`）统一门控在 `@media (hover: hover) and (pointer: fine)` 内；桌面端卡片操作组 `.card-actions-group` 默认 `opacity: 0.68`，hover/focus-within 时升至 `1`，减少网格视觉噪点。
3. **CSS Grid `0fr -> 1fr` 抽屉与等宽数字**：
   - `BlockDropModal` 镌刻抽屉改用 `.drop-engrave-drawer`（`grid-template-rows: 0fr -> 1fr` + `opacity` + `padding`），消除 150px 硬编码上限；
   - 为 `.big-num, .tabular-nums`、`.tabbar button`、`.seg button`、`.pill-action` 及关键数字胶囊/进度文本启用 `font-variant-numeric: tabular-nums`。
4. **桌面底栏分层与折叠动效**：
   - `.tabbar` 增加 `border-top: 1px solid var(--line)`、半透明背景与 `var(--backdrop-filter)`，与主滚动区形成清晰边界，并补齐 `aria-current="page"`；
   - 新增几何严格居中（viewBox 中心 `(12, 12)`）的 `IconChevronDown`，替换 `Group.tsx` 与 `HabitDialog.tsx` 中的裸字符箭头；可折叠设置组展开内容包裹 `.apple-group-body` 做 `4px -> 0` 轻量化入场。
5. **高效直觉的快捷操作与令牌对齐**：
   - 建造页：双击 `BuildScene` 画布自动调用 `fitSceneView` 复位平移缩放；点击旋转胶囊中间的角度数字（`rotation !== 0` 时）一键回 `0°`（不增加顶栏控件，严守 `SURFACES.md` 上限）；
   - 全局快捷键：无模态弹窗时支持 `Ctrl/Cmd + ,` 打开设置；
   - `HabitRowHeader` 状态按钮 `aria-label` 组合习惯名与状态文案；
   - `isoGround.ts` 地基填充改用 `withAlpha(p.ink, 0.04)`。

## 取舍与被否方案

- **否掉引入 Framer Motion / GSAP 等第三方动效库**：项目已有 7 档时长 + 4 档缓动令牌与 `themeMotion.test.ts` 守门机制，引入运行时库会显著膨胀包体且破坏零额外依赖策略；CSS Grid `0fr/1fr` 与合成器 `transform`/`opacity` 已能零依赖覆盖全部 UI 微交互。
- **否掉使用 CSS `linear()` 替换 `--ease-bounce` 令牌值**：虽然现代 CSS 支持 `linear()` 弹簧曲线，但为避免对既有 7+4 令牌契约和四主题截图基线产生不可控扰动，本轮保留既有令牌数值，先做机制层与零重排精修。
- **否掉彻底移除 `smoothScroll.ts`**：Windows 桌面鼠标原生 120px 档位滚轮在长列表和弹窗里仍偏生硬，分流方案既保留桌面鼠标阻尼手感，又彻底释放触控板与减弱动态用户。
- **否掉将 `card-actions-group` 完全隐藏（`opacity: 0`）**：完全隐藏会违背「不能把核心编辑/置顶/删除藏在仅悬停可见中」的可访问性底线；默认 `0.68` 既降低视觉噪声，又保证任何用户都能一眼发现操作按钮。

## 影响面

- **代码与样式**：涉及滚动控制、主题与组件 CSS（5 个拆分样式文件）、习惯卡/弹窗/设置分组/建造页/App 壳层，不涉及存档 schema、i18n schema 键增删、数据逻辑或蓝图坐标变更。
- **兼容性与行文规范**：严守 `themeMotion.test.ts`（无裸时长/缓动/无 `transition: all`）、`themeTypography.test.ts`（字号全走 `--fs-*` 令牌）及所有文件 `< 800` 行约定。

## 验收标准

1. `npm run design:check` 通过（台账与索引完整，无未审批删除）。
2. `npx tsc --noEmit` 零错误。
3. `npm test` 全量通过（含新增 `smoothScroll.test.ts`、`themeMotion.test.ts`、`App.test.tsx` 断言，不修改任何既有业务断言）。
4. `npm run format:check` 与 `npm run check:versions` 全绿。

## 变更履历

- 2026-11-19 created (Antigravity)：完成全量设计审阅与 Apple HIG / Google M3 轻量化交互优化方案记录，待人类审核。
