# AGENTS.md —— BlockHabit 协作规则（AI 代理与人类共同遵守）

> 本文件是仓库级**强制规则**。任何 AI 代理（Claude / Cursor / Qoder / Copilot / 自研 agent）与本仓库协作前，先读完本文件。
> 视觉与设计细则的**唯一入口**是 [`design/README.md`](design/README.md)。

---

## 0. 项目一句话

BlockHabit —— 极简黑白风格的桌面端习惯打卡应用（Tauri 2 + React 19 + TypeScript + Vite + zustand + 手写 Canvas 2D 等距渲染 + vitest）。
每次有效打卡掉落一块 2.5D 等距圆润积木，按蓝图逐块拼成建筑。**黑白灰为骨，琥珀为魂。**

---

## 1. 设计工作强制流程（**不可跳过**）

> 触发条件：任何会改变用户**看得见**的东西的改动——颜色、字体、圆角、间距、图标、布局、动效、文案、建筑数据、品牌资产。

```
① 读 design/README.md（唯一入口）+ §1 设计公理
② 按需读 TOKENS.md / ART.md / SURFACES.md / VOICE.md，参数必须抄令牌，禁止发明数值
③ 查 design/RECORDS.md，避免重复已否决方案
④ 在 design/records/ 新建记录（status: proposed），写清背景/决定/取舍/影响面/验收
⑤ 改代码实现
⑥ 在 design/RECORDS.md 与 design/index.json 登记
⑦ npm run design:check 通过
⑧ 提交人类审核；approved 之后才算"完成"
```

**记录先于代码。** 没有记录的视觉改动视为未完成工作。

---

## 2. 不可逆操作规则（**唯一铁律**）

1. **禁止删除** `design/` 下任何文件、章节、表格行、记录。想淘汰 → `status: deprecated` / `superseded`，全文保留。
2. 物理删除必须先写 `design/APPROVALS.md` 申请（`pending`），**由人类填 `approved`** 后才可执行；执行后填 `done` 并留墓碑。
3. 同样适用于设计性资产：`design/logo/**`、`src/theme.css` 的令牌、`src/logic/blueprints/generators.ts` 的建筑数据、`src-tauri/icons/**`。
4. `npm run design:check` 会对照 git 检测未审批删除；**任何情况下不得修改校验脚本来绕过它**（改校验脚本本身需要人类批准）。
5. 不得用 `git checkout`/`reset --hard`/`clean -fd` 清理他人的未提交成果。

---

## 3. 五条硬约束

| # | 约束 | 说明 |
|---|---|---|
| 1 | **不改视觉语言** | 黑白灰 + 唯一琥珀点缀色、圆润积木、1px 线、不用阴影堆叠。新增颜色/渐变/阴影/圆角档位必须先有记录并人工批准 |
| 2 | **不引入 UI 组件库** | `src/components/` + `ui.css` 就是设计系统；引入 Antd/MUI/Tailwind 等于换掉视觉语法 |
| 3 | **本地优先** | 任何新功能不得引入"必须联网"的主路径；无账号、无遥测上传 |
| 4 | **双语齐全** | 所有用户可见文案必须走 `src/i18n/`，zh 与 en 必须同时补齐；禁止 `lang === 'zh' ? a : b` 内联三元（画布绘制类例外需注释说明） |
| 5 | **数据诚实** | 完成态只能由规则函数（`habitMetOnDay`）判定；删除数据必须级联回收积木/连击/全勤 |

---

## 4. 工程约定

- **测试文化**：纯逻辑（`src/logic/**`）必须有 vitest 单测；修 bug 先写失败用例再修。不许用改测试的方式让测试变绿。
- **提交前自检**：`npx tsc --noEmit` 零错误 + `npm test` 全绿 + `npm run design:check` 通过。
- **提交信息**：沿用 conventional 前缀 `feat:` / `fix:` / `perf:` / `refactor:` / `chore:` / `docs:` / `test:`，中文描述，单次提交只做一件事。
- **不要**：`npm install` 新依赖（先问）、改 `package.json` 版本号、改 `src-tauri/target/`、提交 `dist/` 与 `.tmp*` 产物、格式化无关文件。
- **文件不要无限长大**：单文件超过 800 行时，新增逻辑应拆到新文件（大规模重构需先有设计记录）。
- **仓库结构导航**：`src/logic` 纯逻辑 / `src/render` 等距渲染 / `src/store` zustand / `src/storage` 存储适配 / `src/sync` WebDAV 合并 / `src/pages` 页面 / `src/components` 组件 / `src/platform` 平台能力 / `src-tauri` 桌面壳。
- **文档归口**：设计类 → `design/`；方案与计划 → `docs/superpowers/specs|plans/`；决策记录 → `design/records/`。

---

## 5. 常用命令

```bash
npm run dev              # 浏览器预览（Vite，端口 1420）
npm run tauri dev        # 桌面窗口（首次 Rust 编译 3-10 分钟）
npm test                 # vitest
npx tsc --noEmit         # 类型检查
npm run design:check     # 设计台账一致性 + 未审批删除检测
npm run tauri build      # 出安装包
```

> Git Bash 下跑 cargo 需把 MSVC `link.exe` 目录放到 PATH 最前，详见 README。

---

## 6. 违规处理

- 未登记的设计改动 → 视为未完成，需补记录（不是补口头的）。
- 删除设计记录 → 直接回滚并补 `APPROVALS.md` 流程。
- 修测试/改校验脚本让 CI 变绿 → 视为数据造假，回滚并记录。
- 改视觉语言而没有人工批准 → 回滚。
