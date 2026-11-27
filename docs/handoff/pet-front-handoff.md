# 交接：BlockHabit 桌宠「凹字形积木猫 + 机器人」正视图

> 接手者：Gemini。本文件是唯一的现状说明；仓库里其它记录可能落后于本文件。
> 仓库根：`F:\PROJECT001\BlockHabit`

---

## 1. 先跑这三条，确认起点是绿的

```bash
npx tsc --noEmit          # 应为 0 错误
npm test                  # 应为 130 文件 / 1264 用例全绿
npm run design:check      # 应为「124 条记录，设计中枢完整」
```

如果不绿，先别改代码，先问清楚。

---

## 2. 用户的最终需求（务必按这个，不要再自由发挥）

用户给了一张手绘草图（猫的正面 + 背面），要的是：

1. **猫的正面是一个连续的「凹」字形平面**。
   - 底边是平的横线。
   - 顶边**中间凹下去一块**，两侧各**立起一个方块耳朵**。
   - **耳朵和脸在同一个平面**上（不是耳朵立在身体后面），整只猫是**一块**积木，不是几块拼的。
   - 眼睛、三角鼻、「ω」嘴、左右各两根胡须，全部画在这张平面上。
2. **凸点共 4 枚**：左耳顶、凹口正中、右耳顶、**最右侧那格两格高的（尾巴）顶上**（最后一枚是用户后来补的，容易漏）。
3. **尾巴**是右侧独立的一块窄砖，大约 2 层高。
4. **不出现三角形**；耳朵、尾巴都是有宽有高的方块，只有小圆角。
5. **尺寸要和原来的手写积木桌宠（`petCanvas.ts` 的 cat/bot）一样大**。
6. **积木的视觉效果要和手写积木桌宠一致**（三面明暗、描边、圆角、凸点画法）。
7. 机器人也按同一套语言优化，不要诡异的深色屏幕脸。
8. 动作与表情两只都要有：跳跃抬升 + 阴影变淡、落地压扁、走动轻微侧倾、眨眼、happy / focus / ready。

**用户已经明确说过两次「不要三角形」「要凹字形」「耳朵和脸是同一个平面」——这是验收硬条件。**

---

## 3. 现在代码在哪、做了什么

主文件：`src/render/petBlueprint.ts`（约 700 行）
测试：`src/render/petBlueprint.test.ts`（14 例，全绿）
渲染入口：`src/pet/PetWindow.tsx` 里 `paintBlueprintPet(...)`（已接好，含 mood / blinking）

### 已实现且**正确**的部分

```ts
// 凹字形轮廓（格 x, 层 z）：底边平、两侧立耳、中间凹下去
export const CAT_OUTLINE = [
  [0, 0], [0, 3.6], [1, 3.6], [1, 2.55], [2, 2.55], [2, 3.6], [3, 3.6], [3, 0]
]
// 三枚凸点（耳顶 ×2 + 凹口 ×1）
export const CAT_STUDS = [[0.5, 3.6], [1.5, 2.55], [2.5, 3.6]]
// 尾巴：独立窄砖，顶上也有凸点（slab.stud = true）
export const CAT_TAIL_SLAB = { name:'tail', x0:3, x1:3.9, z0:0, z1:1.75, depth:0, stud:true }
```

- `traceCatOutline()`：把 8 个点描成**一条连续圆角路径**（整面只描一次边）。
- `paintCat()`：整面填充（上亮下暗）→ 三条顶边画窄檐 → 分界线 → 整面外轮廓 → 四枚凸点。
- `paintStudAt()`：凸点画法，参数抄 `petCanvas.paintStud`。
- 猫脸 `paintCatFace()`：竖胶囊眼 + 三角鼻 + ω嘴 + 胡须，坐标落在凹字形平面上。

### 已知还剩的问题（**接手后优先处理**）

1. **尺寸比例还没调准**。相关常量：
   - `PET_FRONT_WINDOW_FIT = 0.78`（整只形象占窗口比例）
   - `PET_FRONT_MAX_SCALE = 3`
   - `PET_STAGE_PAD = 2`
   我最后几次在 0.78 / 1.0 / 以及「按 tileW 锁宽」之间来回试，
   **`sz3.png` 那次截图没来得及看**。请先截图确认，再决定要不要动。
   参考基准：`petCanvas.petLayout()` 里 `ART_MAX_WIDTH = tileW = 48`、
   `MAX_SIZE_SCALE = 1.05`、`PAD = 2`、`MAX_STAGE_SCALE = 3`。
2. **`PET_FRONT_FIT` 已不再参与取景**（保留导出只是为了不破坏引用），
   如果确认没用就直接删掉，别留着误导后人。
3. **圆角/描边**已改成抄手写版（`min(3, tileW×0.0625)` 圆角、`ink@0.58/1.5px` 外轮廓、
   `ink@0.4/1px` 分界线），但**还没和手写版并排逐像素比对过**。
4. **机器人**目前是「2.2 格宽方身（3 层高）+ 两只方手 + 头顶一枚凸点」，
   用的是和猫同一套可爱五官（无深色屏幕）。用户只说了「你也优化一下」，
   需要自己判断是否已足够，**建议先截图给用户看再动**。
5. 实机还没验证最后一次改动：需要 `npm run tauri build -- --no-bundle` 后
   启动 `src-tauri/target/release/blockhabit.exe` 看 96×128 窗口。

---

## 4. 怎么截图（这台机器上的可行做法）

Dev server：`npm run dev` → `http://localhost:1420`
（**截图前先 `curl -s -o /dev/null -w "%{http_code}" http://localhost:1420/`，
返回 200 才行；它中途挂过好几次，挂了就重启。）**

浏览器无头截图（Chrome 在这台机器上偶发失败，**用 Edge**）：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --no-sandbox --no-first-run --hide-scrollbars \
  --force-device-scale-factor=4 --virtual-time-budget=12000 \
  --window-size=320,200 \
  "--user-data-dir=F:\PROJECT001\BlockHabit\.tmp-shot\p$RANDOM" \
  "--screenshot=F:\PROJECT001\BlockHabit\.tmp-shot\out\x.png" \
  "http://localhost:1420/?pet-preview=1&skin=cat&blueprint=pet-cat"
```

- 无头截图**经常第一次失败**，务必写重试循环（试 5 次，`sleep 2` 后再判断文件存在）。
- `?pet-preview=1&skin=cat` → 手写积木桌宠（**尺寸/画风的基准**）
- `?pet-preview=1&skin=cat&blueprint=pet-cat` → 新的凹字形猫
- `&blueprint=pet-bot` → 机器人
- 想一次看多个姿态：在 `.tmp-petlab/` 下放一个自己的 html + ts，直接 import
  `paintBlueprintPet` / `paintPet` 渲染到多个 canvas（vite 会直接服务该目录）。

**实机窗口截图**（96×128 透明窗，PrintWindow 会丢透明通道，把近黑当透明即可）：
用 `ctypes` 的 `EnumWindows` 找尺寸正好 `(96,128)` 的可见窗口，
再用 `PrintWindow(hwnd, mdc, 2)` + `GetDIBits` 取像素。

---

## 5. 硬规则（违反等于白做）

来自仓库 `AGENTS.md` / `design/README.md`：

1. **视觉改动必须先写设计记录**：`design/records/D-YYYYMMDD-NNN-*.md`（`status: proposed`），
   然后登记 `design/RECORDS.md` 与 `design/index.json`，再 `npm run design:fix` + `npm run design:check`。
   本轮记录是 `D-20261127-124-pet-block-style-front.md`（**接着它追加，不要新建重复的**）。
2. **不要删 `design/` 下任何文件**；不要改 `package.json` 版本号（现在是 `0.2.4`）。
3. **不要** `git checkout` / `reset --hard` / `clean -fd`。
   仓库有 **67 个未提交改动**，是用户多轮劳动的成果，不是你该清理的东西。
4. 每个设计记录 `append-only`：正文写定后只允许改 `status` 与「变更履历」。
5. 提交前必须：`npx tsc --noEmit` 0 错误 + `npm test` 全绿 + `npm run design:check` + `npm run format:check`。
6. `vite.config.ts` 里 vitest 的 `exclude` 加了 `**/.claude/**`——这是**故意**的
   （`.claude/worktrees/` 下有 3 个平行 worktree，各自带 node_modules，混出两份 React 会让 60 个测试假失败）。
   **不要删这条**，也不要删掉别人那 3 个 worktree。
7. 不许 `npm install` 新依赖（先问）。这机器上**没有 playwright / puppeteer**，
   vitest 的 browser mode 也没装 provider——截图只能走上面的无头浏览器路线。

---

## 6. 键盘输入在实机不可靠（踩过的坑）

在 Tauri WebView2 里，用 `SendInput` / `keybd_event` 往输入框打字**不生效**
（焦点拿不到）。如果要在实机验证「新建习惯」这类流程：

- 要么改用**数据结构等价**的方式造数据（改
  `C:\Users\LeeCM\AppData\Roaming\com.blockhabit.app\blockhabit.json`，**改前先备份**，
  **验证完必须还原**）；
- 要么直接看真实渲染结果，别硬闯输入。

`dayClaims` / `habits` / `checkIns` 的 schema 见该 json 本身。

---

## 7. 今天就做完这些就算交付

- [ ] 猫：凹字形一整面 + 4 枚凸点（含尾巴顶上那枚）+ 耳与脸同平面 + 无三角
- [ ] 猫与机器人的**大小**和 `?pet-preview=1&skin=cat`（手写版）在同一个 96×128 窗里**目测一致**
- [ ] 三面明暗 / 描边 / 圆角 / 凸点画法与手写版**并排比对无差异**
- [ ] 机器人同样可爱、不诡异
- [ ] 两只的 8 种姿态（静止/跳跃/压扁/happy/眨眼/focus/ready/侧倾）都正常
- [ ] `npm run tauri build -- --no-bundle` 后实机 96×128 窗口确认，走动无 1px 细线
- [ ] 设计记录追加「变更履历」+ `design:check` / `tsc` / `test` / `format:check` 全绿

---

## 8. 现成的临时产物

- `design/evidence/pet-block-front-live.png` —— 上一轮实机截图（**已过期**，重做后覆盖它）
- `.tmp-shot/` —— 我自己的截图脚本与中间图（`.gitignore` 已忽略，可随便删）
- `src-tauri/target/release/blockhabit.exe` —— 上次编译产物，源码改动后需重新 `tauri build`
