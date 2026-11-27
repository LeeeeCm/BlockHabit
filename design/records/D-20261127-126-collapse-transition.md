---
id: D-20261127-126
date: 2026-11-27
title: 设置分组与习惯弹窗「更多设置」的展开/收拢改为高度过渡动画
status: approved
owner: Claude Code
surface: [settings, habit-dialog]
axioms: [A2, A5]
files: [src/components/Collapse.tsx, src/components/Collapse.test.tsx, src/components/settings/Group.tsx, src/components/HabitDialog.tsx, src/components/ui-misc.css]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

用户反馈：新建/编辑习惯里的「更多设置」、设置弹窗里的可折叠分组，展开和收起都是瞬间出现/消失，视觉上生硬，和产品其余部分「积木掉在桌上」的物理感不一致。

现状（代码事实）：

- `src/components/settings/Group.tsx` 用 `{open && children}` 直接挂载/卸载；箭头有 140ms 旋转，但内容没有高度过渡。
- `src/components/HabitDialog.tsx` 的「更多设置」同样是 `{moreOpen && <>…</>}` 条件渲染。
- 主题已有动效令牌：`--dur-xs/sm/md/lg` 与 `--ease-default/standard/out/bounce`，并在 `prefers-reduced-motion: reduce` 下全部归零（`theme.css`）；无需新增令牌。

## 设计决定

- 新增通用组件 `src/components/Collapse.tsx`：`open` 变化时以 `grid-template-rows: 0fr → 1fr` 过渡高度，内容层同步做 0 → 1 透明度；展开完成后高度为 `auto`（由 `1fr` 承担），内容自身高度变化（例如打开时间滚轮）不被裁切。
- 动画参数全部走既有令牌：`grid-template-rows var(--dur-md) var(--ease-standard)`、`opacity var(--dur-md) var(--ease-standard)`；`.collapse` / `.collapse-inner` 样式落在 `ui-misc.css`，不新增颜色、阴影或圆角档位。
- **保留惰性挂载语义**：收起动画结束后（220ms，与 `--dur-md` 对齐）才卸载子内容；展开时先挂载、下一帧再展开。这样设置弹窗里 WebDAV / 备份 / 诊断等面板不会在弹窗打开时就提前挂载并触发 IPC/网络副作用（与现状一致）。
- 无障碍：折叠期间容器 `aria-hidden`，关闭态子树 `inert`，键盘焦点不会进入不可见内容；分组标题已有的 `aria-expanded` 与 Enter/Space 行为不变。`prefersReducedMotion()` 为真时跳过动画并立即挂载/卸载。
- 落地范围仅两处：`Group`（设置弹窗全部可折叠分组）与 `HabitDialog` 的「更多设置」。其它条件渲染不改。

## 取舍与被否方案

- **否掉「content-visibility / display:none + transition」**：`display` 不可过渡，`content-visibility` 在展开瞬间仍会跳变，达不到平滑高度。
- **否掉始终挂载 + `inert` 的纯 CSS 方案**：实现更简单，但会让设置弹窗打开时就挂载「数据与同步」里的备份列表（Tauri IPC）与 WebDAV 面板，改变现有惰性副作用时序，回归风险大于收益。
- **否掉 JS 逐帧测量 `scrollHeight`**：需要 ResizeObserver + 清理逻辑，抖动与边界更多；`grid-template-rows` 由浏览器直接补间，内容高度变化时也自然跟随。
- **否掉更长的 300–460ms**：A5 明确「超过 500ms 的等待动画」不可接受；220ms 与弹窗/卡片既有档位一致。

## 影响面

- 代码：新增 `Collapse.tsx`；`Group.tsx` 与 `HabitDialog.tsx` 的展开分支改用它；`ui-misc.css` 增加 `.collapse` 两条规则。
- 测试：新增 `Collapse.test.tsx`（关闭不渲染子内容、打开渲染、关闭动画后卸载、reduced-motion 立即卸载）；`SettingsPanels.test.tsx` 的「默认折叠 / 展开后挂载」断言应保持通过。
- 视觉走查：设置弹窗四个分组、习惯弹窗「更多设置」在四主题下的展开/收起；`prefers-reduced-motion` 下无过渡。
- 存档 / 同步 / schema：零改动。

## 验收标准

1. 设置分组与「更多设置」点击后在 ≈220ms 内平滑改变高度并淡入/淡出，箭头旋转与内容过渡同时结束。
2. 收起后子内容不再挂载（`container.textContent` 不含已收起分组内容），关闭动画期间不可聚焦。
3. `prefers-reduced-motion: reduce` 下立即切换，无过渡；令牌已有 0ms 覆盖。
4. `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过；四主题 zh/en 截图走查。

## 变更履历

- 2026-11-27 created (Claude Code)：按用户「设置和新建习惯的展开收拢要有过渡动画」提出，status=proposed，等待人类审核。

- 2026-11-28 human review approved (LeeCM)：按用户在会话中的明确确认，status proposed → approved，reviewer pending → LeeCM。
