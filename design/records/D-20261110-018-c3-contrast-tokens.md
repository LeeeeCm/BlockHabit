---
id: D-20261110-018
date: 2026-11-10
title: 实施 C3：彩色填充文字令牌与彩色文字令牌（WCAG AA 收口，14 处对比度不达标修复）
status: approved
owner: lead
surface: [today, build, stats, settings]
axioms: [A1, A4]
files: [src/theme.css, src/components/ui.css, src/themeContrast.test.ts, tsconfig.json]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

审计 U4（`D-20261110-004`）用 WCAG 公式实测出系统性文字对比度不达标：

| 场景 | 实测 | 标准 |
| --- | --- | --- |
| 白字压绿色胶囊（`.checkin-float-pill`） | 2.28:1 | 4.5:1 |
| 白字压完成按钮（`.day-check.done`，燕麦/雾灰） | 2.54:1 | 4.5:1 |
| 绿字压浅底（`.pill-action.success`） | 2.2–2.5:1 | 4.5:1 |
| 琥珀字压白底（`.card-action.active`） | 1.85:1 | 4.5:1 |
| 硬编码 `#ffffff` 两处（hover 态） | 随主题漂移 | — |

根因：**「填充色」和「填充上的文字色」被当成同一个令牌**（`--accent-ink` 在燕麦/雾灰是白色，而这两个主题的绿色填充偏暗），且「彩色文字」直接复用「彩色填充」令牌（`--progress-green` 既是进度条颜色又是文字颜色）。

## 设计决定

### 1. 新增两类令牌（每主题各一套，共 4×5 = 20 个值）
| 令牌 | 语义 | 约束 |
| --- | --- | --- |
| `--on-accent` / `--on-success` / `--on-danger` | **压在该色填充上的文字** | 对该填充 ≥ 4.5:1 |
| `--accent-text` / `--success-text` | **彩色文字本身**（在 surface 上） | 对 surface ≥ 4.5:1 |

取值不是拍脑袋，而是用 `contrastRatio()` 逐主题反解出来的（保持同色相、只调明度）：

| 主题 | on-accent | on-success | on-danger | accent-text | success-text |
| --- | --- | --- | --- | --- | --- |
| 纸白 | `#0a0a0a` (10.68) | `#0a0a0a` (8.69) | `#0a0a0a` (5.06) | `rgb(152,111,1)` (4.56) | `rgb(23,136,65)` (4.53) |
| 墨黑 | `#0a0a0a` (10.68) | `#0a0a0a` (10.01) | `#0a0a0a` (6.83) | `#f5b301` (9.67) | `#34d274` (9.06) |
| 燕麦 | `#0a0a0a` (4.68) | `#ffffff` (4.59) | `#ffffff` (4.83) | `rgb(187,90,59)` (4.53) | `#3a835b` (4.59) |
| 雾灰 | `#0a0a0a` (4.83) | `#0a0a0a` (7.80) | `#0a0a0a` (5.26) | `rgb(2,124,187)` (4.56) | `rgb(12,135,94)` (4.52) |

燕麦主题是唯一「success/danger 保留白字」的主题——因为它的绿/红填充本身比纸白主题更深（白字 4.59/4.83 达标，暗字只有 4.1）。

### 2. 应用点（全部是「换令牌」，不动布局/尺寸/圆角）
- `.pill-action.success:hover`：`#ffffff` → `var(--on-success)`
- `.pill-action.danger:hover`：`#ffffff` → `var(--on-danger)`
- `.checkin-float-pill`：`var(--surface)` → `var(--on-success)`
- `.day-check.done`：`var(--accent-ink)` → `var(--on-success)`
- `.pill-action.success`（非 hover）：`var(--progress-green)` → `var(--success-text)`
- `.habit-card .card-action.active`：`var(--accent)` → `var(--accent-text)`
- `::selection`：`var(--accent-ink)` → `var(--on-accent)`

### 3. 顺带补齐「墨黑主题未重声明 --accent」
审计与 `design/TOKENS.md` 都记录过：墨黑主题靠继承 `:root` 拿 `--accent`，令牌矩阵里这一格是空白。（也是本轮写测试时被这个坑绊了一跤。）现在显式写出 `--accent: #f5b301`，**值与继承值完全相同，观感零变化**。

## 取舍与被否方案

1. **否决「全站把所有 `color: var(--accent)` 都换成 `--accent-text`」**：这些用法大多出现在**图标、圆点、描边**上（图形元素只需 3:1），且「唯一点缀色」的观感强度由 D1 决策决定（`--accent` 在燕麦/雾灰到底该不该是琥珀，尚未拍板）。本轮只改**文字**，且只改 review 明确点名的 6 处。
2. **否决「统一给所有主题用暗字」**：燕麦的绿/红填充更深，暗字只有 4.1，白字 4.59 反而更好——必须逐主题取值。
3. **否决「直接调亮/调暗填充色」**：会改变品牌色与整体观感；本轮只动文字色。

## 影响面

- 代码：`theme.css`（4 个主题各 +5 个令牌，墨黑 +1 个 `--accent`）、`ui.css`（7 处颜色声明）、新增守门测试。
- 用户可见：**7 个文字颜色变化**（绿字更深、琥珀字更深、填充上的白字变暗墨）；布局、尺寸、圆角、动效、图标形状全部不变。
- 无障碍：上述 6 处从 1.85–2.54:1 提升到 4.52–10.68:1，达到 WCAG AA。

## 验收标准

### 自动化（已通过）
- 新增 `src/themeContrast.test.ts`（9 例）：四主题 × 「填充上的文字 ≥ 4.5」「彩色文字在 surface ≥ 4.5」；并反向断言旧的硬编码写法已消失。测试按浏览器级联规则「`:root` 打底 + 主题覆盖」解析，避免继承令牌漏检。
- 全量：`npx tsc --noEmit` 0 错误；`npm test` **58 文件 / 458 用例全绿**。

### 浏览器实测
- 逐主题读取 `getComputedStyle`：`--on-success` / `--success-text` / `--accent-text` / `--on-danger` 四主题值均与上表一致。
- 动态创建一个 `.pill-action success` 元素，四主题下 `color` 依次为 `rgb(23,136,65)` / `rgb(52,210,116)` / `rgb(58,131,91)` / `rgb(12,135,94)` —— 与 `--success-text` 完全对应（首次测得偏差是 `.pill-action` 的 150ms color transition 未结束，加 `transition:none` 后一致）。
- 纸白/燕麦主题今日页截图：`.tmp-verify/contrast-light.png` / `contrast-oat.png`，布局与观感无异常。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
