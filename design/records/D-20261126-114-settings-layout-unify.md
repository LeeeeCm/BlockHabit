---
id: D-20261126-114
date: 2026-11-26
title: 建造页顶栏齐高、设置页按钮填满行宽、WebDAV 只留通用与积木上限统一
status: proposed
owner: Claude Code
surface: [build, settings]
axioms: [A1, A2, A4]
files: [src/pages/Build.tsx, src/components/SettingsPanels.test.tsx, src/components/ui-overlay.css, src/components/ArchiveDataPanel.tsx, src/components/ArchiveExportPanel.tsx, src/components/HabitImportPanel.tsx, src/components/WebdavPanel.tsx, src/components/settings/LabGroup.tsx, src/components/settings/PetSettingsGroup.tsx, src/components/settings/SettingsFooter.tsx, src/pet/types.ts, src/pet/types.test.ts, src/components/SettingsLayout.test.tsx]
supersedes: []
reviewer: pending
---

## 背景与问题

用户反馈五处设置/建造页一致性问题（附截图）：

1. 建造页顶栏比「今日 / 展台 / 统计」高。实测：建造页在**蓝图落成后**（多出「奠基 / 拍立得」两键）顶栏高 **65.1px**，其余三页 64px。
2. WebDAV 的「服务商」四选一（Nextcloud / 坚果云 / 群晖 / 通用）对用户是噪音 —— 四个预设只是 URL 拼接规则不同，直接填完整地址就能覆盖。
3. 设置页单个按钮只占内容宽度（「选择文件」「导出诊断包」「导出完整档案包」「重看页面提示」都是短按钮），与上面「导出备份 / 导入备份」的两列等宽行不齐。
4. 说明文字与按钮挤在同一行（诊断包的说明在按钮右侧，按钮被压窄）。
5. 设置页尾部「修复积木库存」写死 `x / 2`，统计页读 `REPAIR_MAX` 显示 `x / 4`，两处不一致。
6. 桌宠材质色只有 6 个且左对齐换行，右侧留出不齐的尾巴。

## 设计决定

- **顶栏齐高**：建造页落成态的「奠基 / 拍立得」补 `.block-action`（34px 倒角方块），与同页「透视考古 / 图鉴」及另三页动作同一高度体系；去掉它们各自的内联 padding/字号。实测 1084/900/820/780/740/700 宽下四页均为 64.0px，标题基线 y=77.1 一致。
- **WebDAV 只留通用**：移除服务商分段控件与 `applyProvider`；「WebDAV 地址」变为始终可编辑的通用地址输入（placeholder 沿用 `https://dav.example.com/sync/`）。旧存档里已是坚果云 / Nextcloud 端点的用户，地址原样显示且不被改写（有回归测试覆盖）。`src/sync/providers.ts` 的预设与 `detectProvider` 保留（存档识别与既有单测仍在使用），不删除代码。
- **按钮填满行宽**：新增 `.settings-actions` 行容器（`display:flex; gap:10px`，子 `.btn` 为 `flex:1 1 0; min-width:0` 且左右内距归零），单个按钮时独占整行、两个按钮时等分 —— 与「导出备份 / 导入备份」使用同一容器，因此任何数量都对齐同一左右边界。实测：两列各 193px、单列 396px，左右边界 352→748 完全一致。
- **说明文字独立成行**：新增 `.settings-hint`（`--fs-caption` / `--ink-2` / 行高 1.5 / `margin-top:4px`），诊断包、档案包进度、已选文件名等说明从按钮行里移出，落在按钮下方。按用户要求保留「立即同步」（状态行左、按钮右）与「检查更新」（关于组内右对齐按钮 + 左侧状态文案）的并排形式。
- **积木上限统一**：`SettingsFooter` 改为引用 `REPAIR_MAX`，显示 `x / 4`，与统计页 `StatsHeader` 同源，不再写死数字。
- **桌宠色板**：新增 `.settings-swatch-grid`（6 列等分网格）+ `.settings-swatch`（`width:100%`、`aspect-ratio:1`、8px 圆角）。`PET_COLORS` 从 6 色扩到 **11 色**（全部取自 D-067 已批准材质色板：`#94a3b8 #64748b #334155 #f1f5f9 #a89f91 #b4533c #854d0e #f59e0b #e9c46a #0284c7 #4f776a`），加「跟随主题」正好 12 格两整行。

## 取舍与被否方案

- **否掉把四页顶栏固定 `height:64px`**：落成态多两个按钮时窄窗口会横向溢出，且与 D-087 的整组换行冲突；本次治的是撑高源（按钮高度体系不统一），不是把高度钉死。
- **否掉给「奠基 / 拍立得」单独写 34px 内联高度**：`.block-action` 已经是全站顶栏动作的唯一尺寸入口，再写一遍内联值等于再造一份规格。
- **否掉保留服务商选择、只把默认值改成通用**：用户明确要求不出现其他服务商；保留控件会让「切过去又被固定端点覆盖」的老问题继续存在。
- **否掉删除 `providers.ts`**：旧存档仍可能带坚果云固定端点，`detectProvider` 与 URL 规范化仍被同步层与单测引用；删除是资产移除，无收益。
- **否掉给单按钮固定 `width:100%`**：多按钮行会退化成每个按钮各占一行；等分 flex 才能真正做到「和两列同边界」。
- **否掉自由取色扩色板**：A1 只允许既有材质色，扩色必须留在 D-067 色板内。
- **否掉把色板做成 4 列 3 行**：6 列时色块约 61px，桌宠材质是纯色块，4 列会显得过大且与设置页其他行的高密度不符。

## 影响面

- 代码：建造页顶栏两个按钮的 class；设置页 5 个面板与 2 个分组；`SettingsFooter`；`PET_COLORS`。
- 视觉走查：建造页落成态顶栏（需蓝图拼满才能看到两个按钮）、设置页数据与同步组、桌宠颜色行、设置页尾部库存数字。
- 存档：`PET_COLORS` 扩容向后兼容（旧值仍在白名单内），未知色仍回落主题；WebDAV 配置结构不变。
- 测试：`SettingsPanels.test.tsx` 中 3 条断言服务商预设的用例改为断言「不再提供服务商选择」+「旧端点原样保留」；新增 `SettingsLayout.test.tsx`（按钮行容器、说明独立成行、`x / 4` 上限、色板网格）与 `pet/types.test.ts` 的色板数量用例。

## 验收标准

- 四页 `.page-top-bar` 在 900 / 1000 / 1084 宽下高度均为 64.0px；建造页落成态（4 个动作）同样 64.0px，动作按钮高度统一 34.1px，标题 y=77.1。
- 设置页所有动作行：单按钮宽 = 双按钮行左右边界之和（实测 396px = 193+10+193）；说明文字在按钮下方独立成行。
- WebDAV 面板不再出现「服务商 / Nextcloud / 坚果云 / 群晖」；地址输入可编辑且回显旧端点。
- 设置页尾部显示 `x / 4`，与统计页 `修复积木: x / 4` 一致。
- 桌宠颜色行：6 列、两行、等宽填满，共 12 格（跟随主题 + 11 材质色）。
- `npx tsc --noEmit`、`npm test`、`npm run design:check` 通过。

## 变更履历

- 2026-11-26 created（Claude Code），按用户截图反馈一次性收敛五处不一致。
- 2026-11-26 verified（Claude Code）：CDP 实测四页顶栏 64.0px（含建造页落成态模拟两键）、按钮行 193/396px 边界一致、色板 12 格两行、footer 显示 2 / 4；`npx tsc --noEmit`、`npm test`（126 文件 / 1226 用例）、`npm run design:check` 全通过。
