---
id: D-20261127-127
date: 2026-11-27
title: 展台多沙盘 + 堆场 + 右键旋转/收拢，退役装饰模式与实验室微生态开关
status: approved
owner: Claude Code
surface: [showcase, settings]
axioms: [A1, A2, A4, A5, A6]
files: [src/types.ts, src/logic/showcase.ts, src/logic/showcase.test.ts, src/store/appStore.ts, src/store/appStoreTypes.ts, src/store/appStoreHelpers.ts, src/store/showcaseState.ts, src/store/showcaseSandbox.test.ts, src/store/showcasePlacement.test.ts, src/store/serializeState.ts, src/store/serializeState.test.ts, src/storage/adapter.ts, src/storage/adapter.test.ts, src/sync/merge.ts, src/sync/merge.test.ts, src/pages/Showcase.tsx, src/pages/Showcase.test.tsx, src/components/showcase/ShowcaseDrawer.tsx, src/components/showcase/SandboxList.tsx, src/components/showcase/BuildingYard.tsx, src/components/showcase/ModelContextMenu.tsx, src/components/ui-showcase.css, src/components/ui.css, src/render/ShowcaseScene.tsx, src/render/showcase/canvas.ts, src/render/showcase/derived.ts, src/render/isoGround.ts, src/render/buildscene/ecoStage.ts, src/render/BuildScene.tsx, src/render/buildSceneEco.test.tsx, src/logic/innovations.test.ts, src/components/settings/LabGroup.tsx, src/i18n/types.ts, src/i18n/locales/zh.ts, src/i18n/locales/en/build.ts, src/i18n/locales/en/settings.ts, design/SURFACES.md, design/ART.md, design/VOICE.md, design/RECORDS.md, design/index.json, design/records/D-20261111-068-free-decoration-mode.md]
supersedes: [D-20261111-068]
reviewer: LeeCM
---

## 背景与问题

用户本轮要求（原话拆解）：

1. 展台里新增一个「仓库 / 背包」类功能，但不要叫仓库或背包，需要重新取名；
2. 右键展台上的建筑，可以「收拢」或旋转角度；
3. 要有多个沙盘；删除实验室里的「建筑微生态」开关，改成每个沙盘自己的设计，不同沙盘要有区分度；
4. 沙盘切换和建筑背包放在展台主页面左右两边，用「<」「>」按钮展开对应列表；展开要有平滑过渡动画。

现状（代码事实）：

- `AppState.showcasePlacements` 只有一张 26×26 沙盘；`Showcase.tsx` 的区块全在单页内联样式里。
- 旋转只存在于 D-20261111-068 的「装饰模式」：全落成解锁、点击选中、工具条 ↺/↻、「换一组植被」；旋转与植被种子都是**本次会话 React state，不写存档**。
- 微生态植被是全局 `settings.enableEcoProps` 开关 + 最大连胜阶段（1/7/21/100 天），实验室分组里提供「孕育生态 / 纯粹积木」。
- 右键没有任何行为；未陈列建筑没有入口（建筑落成会自动找空位上沙盘，满了就静默跳过）。

## 设计决定

### 1. 命名：堆场 / Block Yard

- 新增功能命名 **「堆场」**（en: **Block Yard**）：已完成但当前没有陈列在任何沙盘上的建筑停放在这里。不用「仓库 / 背包 / 库存」——它们把人带向电商/游戏物品栏语汇；「堆场」仍属于积木与建造的实物隐喻（材料在场地上等待被放上桌）。
- 术语登记进 `VOICE.md` §2：沙盘 = Island（沿用现有 Showcase Island），堆场 = Block Yard，沙盘设计 = Island design。函数式文案全部走 i18n，zh/en 同步。

### 2. 数据模型：多沙盘 + 持久化旋转

```ts
type SandboxDesign = 'moss' | 'stone' | 'bloom' | 'bare'
interface ShowcasePlacement { blueprintId; gridX; gridY; rotation?: 0|1|2|3 }
interface ShowcaseSandbox {
  id: string
  placements: ShowcasePlacement[]
  design?: SandboxDesign        // 缺省 moss（旧行为）
  vegetationSeed?: number       // 缺省 0（旧行为：固定锚点）
}
AppState += { showcaseSandboxes?: ShowcaseSandbox[]; activeSandboxId?: string }
```

- **一座建筑同一时间最多陈列在一个沙盘上**（实物隐喻 + A6）：落成建筑集合是唯一事实源；堆场按当前状态分两段——「待陈列」（不在任何沙盘）与「在其他沙盘」（显示所在沙盘，点击会移动到当前沙盘）。
- 沙盘上限 **4**，至少保留 1 个；新建沙盘自动轮换设计（苔庭 → 石径 → 花台 → 素盘），并给非首个沙盘一个确定性植被种子（`index × 37`），让默认摆放也有差异。新建 id 用 `sandbox-${uid()}`（全局唯一，避免两台设备离线各建第 2 个沙盘时撞号被同步合并）；`sandbox-1` 只作为旧档迁移常量。
- **兼容镜像**：`showcasePlacements` 继续保存为「当前沙盘 placements 的镜像」，并在写盘边界从 active 沙盘重新派生。旧客户端仍能读到当前沙盘；新客户端加载时若只有 legacy 字段，则迁移成 `sandbox-1`（moss / seed 0，旧 `enableEcoProps=false` 时为 bare）。混合写入（新客户端写过 sandboxes、旧客户端随后清空 active 只写镜像）时，若 active 为空且镜像非空，把镜像并回 active。
- 存档清洗：沙盘 id 去重、placement 只保留已知蓝图、rotation 归一化 0–3、design 白名单、seed 有限数；损坏条目逐条丢弃而不是整档拒绝；扫描上限 32 个沙盘 / 512 条落位。
- 同步：按沙盘 id 合并（本地优先，远端独有沙盘追加）；合并后丢弃未知蓝图、跨盘去重、按上限 4 确定性截断并保证 active 在保留集合内；`activeSandboxId` 本地有效则保留，否则远端/首个；所有沙盘的 placement 都要过「蓝图完成态」过滤。沙盘删除没有墓碑，删除后可能被远端旧数据复活——作为已知限制写进记录，不在本轮引入墓碑机制。
- **自动排列**只重排当前沙盘已有的陈列（保留各自 rotation），不把其他沙盘 / 堆场里的建筑拉进来，避免同一建筑同时出现在两个沙盘；放不下时保持原布局并 toast，不把建筑挤回堆场。

### 3. 交互：右键菜单 + 左右抽屉

- **右键建筑**：弹出小菜单「旋转 90°」「收拢回堆场」。旋转写入 `placement.rotation`（持久化）；先走 `canRotatePlacement`（不出界、不与邻居 AABB 重叠），失败 toast `rotateBlocked` 并保持原状。收拢 = 从当前沙盘移除 placement，建筑回到堆场「待陈列」。左键点击仍打开拍立得，拖拽仍换位。
- **左抽屉（沙盘）**：列表显示沙盘序号、设计名、陈列数量；当前沙盘高亮；底部「＋ 新建沙盘」；每个非唯一沙盘有删除入口（ConfirmDialog，说明建筑会回堆场、不会删除建筑）；当前沙盘下方是 4 个设计 chip（苔庭/石径/花台/素盘）与「换一组植被」。
- **右抽屉（堆场）**：待陈列建筑列表，使用现有 `BlueprintThumb` 小缩略图 + 名称；点击即放上当前沙盘（自动找第一个空位），沙盘满则 toast `yardFull`。其他沙盘上的建筑单独一段，点击移动过来。
- **抽屉形态**：左右各一枚 44px 宽的竖向标签（`‹/›` + 竖排「沙盘/堆场」+ 数量），与 252px 面板是同一块表面：统一 360px 高、同一背景与 1px 边框；标签侧圆角，贴窗口的外侧为尖角（左抽屉去左圆角，右抽屉去右圆角）；标签与面板之间无分割线、无独立底色。点击后容器以 `grid-template-columns: 0fr → 1fr` 平滑向外延伸（不做透明度淡入），默认收起。抽屉覆在画布两侧，不改变沙盘取景；切换沙盘时用 `viewFitKey` 重新取景。面板中去掉说明性长文案（设计说明 / 堆场说明），只保留列表、按钮与设计 chip。
- **已知可达性限制**：画布上的旋转/收拢仍以右键或长按为入口；键盘用户无法直接在画布上打开菜单（抽屉与菜单本身支持 Tab/Esc）。后续可在堆场或沙盘列表中补「选中建筑的操作行」，本轮不做。
- **动效**：布局过渡 `--dur-lg` + `--ease-standard`，内容淡入 `--dur-md`；`prefers-reduced-motion` 由令牌 0ms 与组件判断共同兜底；不使用循环动画、整页转场或新阴影档位（抽屉/菜单只用 1px `--line` + `--surface` 与一层极软阴影，A4）。
- **退役装饰模式**：全落成解锁的「装饰模式」不再存在；它的两项能力被提升为常驻交互——旋转走右键并持久化，植被重排变成每个沙盘自己的种子（持久化）。`isDecorationUnlocked` 及其测试随功能下线。

### 4. 每个沙盘的设计（取代实验室微生态开关）

- 删除 `AppSettings.enableEcoProps` 与实验室分组里的「建筑微生态彩蛋」一行；建造页微生态改为**始终按连胜阶段显示**（不再有全局关）。旧档 `enableEcoProps === false` 在迁移时映射为首个沙盘设计 `bare`，尽量保留「纯粹积木」的原偏好；建造页不再提供全局关闭，属本次明确的行为变更。
- 展台的设计决定微生态基调：绿 / 石沿用 ART §7 已批准的微生态调色板，花改用 ART §10 暖光材质族（`#e9c46a / #f59e0b / #d97706`），**不新增色相**；这也是对旧实现硬编码 `#f5b301`（点缀色越界）的收口。
  - 苔庭 moss：阶段 1–3 与旧输出逐像素一致（绿灌木 + 石点）；阶段 4 花砖由 `#f5b301` 改为暖光材质（A1 收口）；
  - 石径 stone：灌木与花改为石色，树冠保留绿色（石多绿少）；
  - 花台 bloom：灌木与树冠改用暖光族（花树），石点保留；
  - 素盘 bare：不画任何微生态（等同原「纯粹积木」的展台语义）。
- 设计只作用于沙盘画布内的微生态，不上页面 UI、沙盘底托或抽屉底色；左抽屉的设计色点也只用 ART §10 已批准材质色，同屏不会出现第二种点缀色相。
- 阶段仍由所有在册习惯的最大连胜决定（1/7/21/100 天），不伪造进度；设计只改变材质与分布，不改变阶段门槛。
- 区分度 = 设计调色板 + 植被种子布局 + 沙盘序号/设计名；不新增沙盘底座颜色、纹理或新装饰件。
- **主题即时重绘**：展台与建造画布订阅 `settings.theme`，主题切换后立即用新调色板重绘；此前画布只在环境光/摆放变化时重绘，切主题会短暂停留在旧色（实机走查发现）。

## 取舍与被否方案

- **否掉「每个沙盘各有一份完整建筑库、可重复陈列」**：背包会变成「每个沙盘都能放同一座建筑」的复制机，和「建筑是实物、收拢是对收进堆场」的直觉冲突；改为全局唯一陈列 + 堆场显示所在沙盘。
- **否掉「保留装饰模式，只额外加右键」**：会出现会话旋转与持久化旋转两套语义，同一模型在两种视觉状态间跳变；退役并提升能力更诚实。
- **否掉「新增沙盘专用色/纹理」**：A1 只允许既有材质色；现有微生态三套调色板已足够区分，新增色相需单独审批。
- **否掉「堆场里的建筑拖到画布」**：拖拽落位已有完整手势，但从抽屉拖出需要跨层命中与自动取景；本轮用「点击自动找空位」把交互压到最小，后续可加拖放。
- **否掉「沙盘删除墓碑」**：沙盘是陈列方案而非事实数据，墓碑会引入第三套同步语义；已知限制：删除的沙盘可能被远端旧数据复活。
- **否掉「新建沙盘时清空/复制当前布局」**：空沙盘从零开始，避免用户误以为建筑被复制；需要复用布局时可在新沙盘重新陈列。

## 影响面

- 数据：`types.ts` 新增 `ShowcaseSandbox`/`SandboxDesign`/`rotation`；`appStore` 新增沙盘 CRUD、旋转、收拢、陈列/移动、切换、设计、植被重排；打卡落成自动上当前沙盘。`showcasePlacements` 保留为镜像。
- 迁移/同步：`adapter.sanitizeState`、`serializeState`、`sync/merge.ts` 全部处理新字段；旧档单沙盘迁移；旧客户端只读写镜像。
- 渲染：`ShowcaseScene` 从 placements 派生旋转映射，移除会话语义；`drawEcoProps` 增加 variant；`drawShowcaseCubes` 去掉 selectedId；`computeEcoStage` 去掉开关参数。
- 界面：`Showcase.tsx` 结构重写 + 4 个新组件 + `ui-showcase.css`；设置实验室删一行；i18n 删 `ecoProps*`、删装饰模式文案、加沙盘/堆场/设计/右键菜单文案。
- 设计文档：`SURFACES.md` 展台与设置章节重写、`ART.md` §7 增加设计变体、`VOICE.md` 术语表新增三词、D-068 置 `superseded`。
- 测试：新增沙盘 store 测试与展台页交互测试；更新 `logic/showcase.test.ts`（删解锁测试）、`showcasePlacement.test.ts`（持久化旋转）、`serializeState/adapter/merge` 测试、`buildSceneEco.test.tsx`（去掉关闭分支）。

## 验收标准

1. 默认一个沙盘；新建/切换/删除沙盘正常，最多 4 个，删除最后一个被拒绝；每个沙盘只显示自己的 placements。
2. 右键建筑：旋转 90° 后刷新/导出导入仍保持；碰撞/越界时 toast 且不变。收拢后建筑出现在堆场「待陈列」。
3. 堆场点击建筑：放上当前沙盘并持久化；沙盘满时 toast；其他沙盘上的建筑点击后移动过来，原沙盘不再显示。
4. 四个设计分别画出绿/石/花/无微生态；`bare` 与旧「纯粹积木」一致；建造页微生态不受影响，实验室不再出现该开关。
5. 左右抽屉默认收起，点击标签平滑展开/收起；`prefers-reduced-motion` 下无过渡；切换沙盘后取景重新适配。
6. `npx tsc --noEmit`、`npm test`、`npm run design:check` 全绿；四主题 zh/en 走查。

## 变更履历

- 2026-11-27 created (Claude Code)：按用户本轮展台改造需求提出；status=proposed，等待人类审核。
- 2026-11-28 revised (Claude Code)：按实机走查反馈调整抽屉——左右同高 360px、标签与面板一体化（无分割线）、外侧去圆角、只做宽度延伸不做淡入；移除面板中的设计说明、堆场说明与重复标题（沙盘/堆场），只保留列表、按钮与设计 chip。
- 2026-11-28 refined（D-20261128-129）：沙盘「设计」收敛为纯颜色选择，移除展台植被与植被种子；本记录其余多沙盘/堆场/右键/抽屉决策不变。
- 2026-11-28 retired（D-20261128-130）：建造页逐建筑微生态也下线，本记录「建造页始终按连胜阶段显示微生态」的表述不再成立；多沙盘/堆场/右键/抽屉决策仍有效。

- 2026-11-28 human review approved (LeeCM)：按用户在会话中的明确确认，status proposed → approved，reviewer pending → LeeCM。
