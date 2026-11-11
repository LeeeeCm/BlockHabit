# 设计记录台账（Records Ledger）

> 一条设计 = 一行。**只允许追加与改状态，不允许删除行**（删除规则见 `README.md` §5）。
> 每条记录正文在 `records/<id>-<slug>.md`；机器索引 `index.json` 由 `npm run design:check` 保证与本表一致。

## 状态说明

| 状态 | 含义 | 谁可以设置 |
|---|---|---|
| `proposed` | 已提出，等待审核 | 任何人（含 AI） |
| `approved` | 人类已批准，可以实施 | **仅人类** |
| `implemented` | 已实现并通过验收 | **仅人类**（AI 可提交待审） |
| `superseded` | 被更新的设计取代（全文保留） | 任何人 |
| `deprecated` | 不再推荐，但未删除（全文保留） | 任何人 |
| `revoked` | 人类否决 | **仅人类** |

## 台账

| id | 日期 | 标题 | 状态 | 表面 | 审核人 |
|---|---|---|---|---|---|
| D-20261110-001 | 2026-11-10 | 建立设计中枢：唯一入口、追加式记录、删除需人工审核 | proposed | — | pending |
| D-20261110-002 | 2026-11-10 | 设计基线抽取：四主题令牌 / 积木美术 / 界面表面 / 文案语气（`design/TOKENS|ART|SURFACES|VOICE.md`） | proposed | — | pending |
| D-20261110-003 | 2026-11-10 | 审计：工程与数据正确性（34 条 / P0×2、P1×9） | proposed | — | pending |
| D-20261110-004 | 2026-11-10 | 审计：视觉与体验（33 条 / P1×9，含浏览器实测） | proposed | today, build, stats | pending |
| D-20261110-005 | 2026-11-10 | 审计：产品与工程运营（22 条 / P0×1、P1×6） | proposed | — | pending |
| D-20261110-006 | 2026-11-10 | 全面优化方案（合并 89 条审计为 46 条，A–G 七批落地） | proposed | — | pending |
| D-20261110-007 | 2026-11-10 | 实施批次 A（A1/A2/A3 三个 P0）+ B2 counter 刷块 | proposed | today, settings | pending |
| D-20261110-008 | 2026-11-10 | 实施 A4 兜底三件套 + A5a 旧档导入 + A6 损坏档提示 | proposed | today, build, stats, settings | pending |
| D-20261110-009 | 2026-11-10 | 实施 A5b/A7 撤销保块 + A8 容量钳制 + A9 删除清理 + A12 补签下限 + CI | proposed | build, stats | pending |
| D-20261110-010 | 2026-11-10 | 实施 B1：连击里程碑奖励块全链路接回（数据→投影→渲染→反馈）+ 两主题截图验证 | proposed | build, showcase, today | pending |
| D-20261110-011 | 2026-11-10 | 实施 C1 减少动态 + C2 键盘焦点环 + C8 消除启动主题闪变 | proposed | 全局 | pending |
| D-20261110-012 | 2026-11-10 | 实施 C6 不抢 autoFocus + C7 十弹窗可访问名称 + C10 原生控件收口 | proposed | today, stats, settings | pending |
| D-20261110-013 | 2026-11-10 | 实施 C5 热图 roving tabindex + C9 习惯弹窗关闭前保护 | proposed | stats, today | pending |
| D-20261110-014 | 2026-11-10 | 实施 E1 字体瘦身：dist 9.80→5.42MB，五个界面逐像素零回归 | proposed | 全局 | pending |
| D-20261110-015 | 2026-11-10 | 实施 D10 建造页自适应取景（开荒期 1.5×，地基虚线不裁切） | proposed | build | pending |
| D-20261110-016 | 2026-11-10 | 实施 E2 展台热路径零分配化（离屏底座复用 / footprint 缓存 / 偏移预计算） | proposed | showcase | pending |
| D-20261110-017 | 2026-11-10 | 实施 C4 环境光对比度地板（仅墨黑 dusk/night 生效，其余 14 组合不变） | proposed | build, showcase | pending |
| D-20261110-018 | 2026-11-10 | 实施 C3 彩色填充/文字令牌：6 处 1.85–2.54:1 → 4.52–10.68:1 | proposed | 全局 | pending |
| D-20261110-019 | 2026-11-10 | 实施 A10 OS 关机关存握手 + 迷你悬浮件关闭恢复尺寸（cargo check 通过） | proposed | today | pending |
| D-20261110-020 | 2026-11-10 | 实施 E3 精灵缓存 LRU + 24MB 字节预算（高分屏内存封顶） | proposed | 全局 | pending |
| D-20261110-021 | 2026-11-10 | 实施 D5/D6/D8 清理：8 个死 i18n 键、Blueprint.name 死数据、9 条死 CSS | proposed | 全局 | pending |
| D-20261110-022 | 2026-11-10 | 实施 F3 数据主权：应用内备份列表 + 一键恢复 + 打开数据目录 | proposed | settings | pending |
| D-20261110-023 | 2026-11-10 | 实施 F1 上半：首启三步引导 + 首块积木专属说明 | proposed | today | pending |
| D-20261110-024 | 2026-11-10 | 实施 F11 文档校准 + F4 上半：WebDAV 跨域不再误报网络错误（完整修复待依赖审批） | proposed | settings | pending |
| D-20261110-025 | 2026-11-10 | 实施 D9：emoji 清零 + 背景模糊收敛单令牌（像素零变化） | proposed | 全局 | pending |
| D-20261110-026 | 2026-11-10 | 实施 D3 动效令牌收口：17 时长 + 7 缓动 → 7 档 + 4 档，裸值归零 | proposed | 全局 | pending |
| D-20261110-027 | 2026-11-10 | 实施 F8 修复积木宽口径（月 2 块 + 连击 30 天 + 窗口 30 天，上限 4） | proposed | stats | pending |
| D-20261110-028 | 2026-11-10 | 实施 D7 字号阶梯收口：20 档 → 8 档语义令牌，裸字号归零 | proposed | 全局 | pending |
| D-20261110-029 | 2026-11-10 | 实施 D4 设置面板 IA：可折叠分组，3.6 屏 → 2.7 屏 | proposed | settings | pending |
| D-20261110-030 | 2026-11-10 | 实施 F9 本地诊断包（崩溃日志+数据体量+帧率）+ F7 提醒自启自检 | proposed | settings | pending |
| D-20261110-031 | 2026-11-10 | 实施 F1 下半：新建习惯表单选填项默认折叠（首屏 4 个控件） | proposed | today | pending |
| D-20261110-032 | 2026-11-10 | 实施 E4 第一步（颜色域拆出 isoColor.ts）+ F5 收尾（CHANGELOG） | proposed | 全局 | pending |
| D-20261110-033 | 2026-11-10 | 实施 E4 二/三步：iso.ts 拆为 geometry/color/cube/ground，barrel 保接口 | proposed | 全局 | pending |
| D-20261110-034 | 2026-11-10 | 实施 E4 收尾：ui.css 拆为 5 个按序入口，四页逐像素零差异 | proposed | 全局 | pending |
| D-20261110-035 | 2026-11-10 | 实施 B3 热图灰阶化（回归 AESTHETIC）+ B4 领取反馈按结果分支 | proposed | stats, today | pending |
| D-20261110-036 | 2026-11-10 | 实施 D5 遗留：useTransient 收口 15 处瞬时提示，修掉重叠计时器 bug | proposed | 全局 | pending |
| D-20261110-037 | 2026-11-10 | 自审计与审核摘要：核验 36 条记录声明，产出 REVIEW-QUEUE 与决策清单 | proposed | 全局 | pending |
| D-20261110-038 | 2026-11-10 | 实施 F2 上半：全蓝图落成显式完成态 + 打卡不产块时说明原因 | proposed | build, today | pending |
| D-20261110-039 | 2026-11-10 | 端到端集成验证：完整 tauri build 通过，E1/E4 声明复核无回退 | proposed | 全局 | pending |
| D-20261110-040 | 2026-11-10 | 生产构建分包：主 chunk 497→296 kB，消除 500 kB 告警 | proposed | 全局 | pending |
| D-20261110-041 | 2026-11-10 | 把「打卡无掉块」原因判别抽为纯逻辑并补 5 例单测（F2 收尾） | proposed | today | pending |
| D-20261110-042 | 2026-11-10 | 测试覆盖体检：给积木投影（builds）与蓝图注册表补 18 例单测 | proposed | 全局 | pending |
| D-20261110-043 | 2026-11-10 | 渲染数学底座补测（几何 18 / 颜色 18 例），修掉 floorContrast 契约漏洞 | proposed | 全局 | pending |
| D-20261110-044 | 2026-11-10 | 实施 E5：BuildScene 906→786 行（动画/取景/气泡拆分），逐像素零差异 | proposed | build | pending |
| D-20261110-045 | 2026-11-10 | 实施 E5 第二步：ShowcaseScene 890→796 行（纯几何派生拆出），逐像素零差异 | proposed | showcase | pending |
| D-20261110-046 | 2026-11-10 | 最终集成验证：E5/分包/测试补强后再出包，体积与分包指标达标 | proposed | 全局 | pending |
| D-20261110-047 | 2026-11-10 | F5 收尾：CHANGELOG 与 46 条记录对齐；方案「不需决策」部分全部完成 | proposed | 全局 | pending |
| D-20261110-048 | 2026-11-10 | 六项待决按建议决议：F4 批依赖落地原生 HTTP、D1 公理改写、D2 保留装饰色、LICENSE=MIT | proposed | settings | pending |
| D-20261110-049 | 2026-11-10 | 实施 B5：奖励块分两级（连击单环 / 全勤双环），同一枚点缀色 | proposed | build, showcase | pending |
| D-20261110-050 | 2026-11-10 | F10 平台范围决议（移动端=实验）+ F5 收尾（Prettier 作用域化，ESLint 不接的理由） | proposed | 全局 | pending |
| D-20261110-051 | 2026-11-10 | 优化方案收尾验收：46 条 + 6 项决策全部有结论，出包与门禁全绿 | proposed | 全局 | pending |
| D-20261110-052 | 2026-11-10 | 今日简报：打开即看到今天要做什么 + 离落成还差几块 + 一键开始 | proposed | today | pending |
| D-20261110-053 | 2026-11-10 | 习惯模板：空态 5 个一键起步选项，降低首次创建门槛 | proposed | today | pending |
| D-20261110-054 | 2026-11-10 | 页面提示系统：首次进入三页各一条可关闭提示 + 设置内重看 | proposed | build, showcase, stats | pending |
| D-20261110-055 | 2026-11-10 | 晚间收尾提醒：首次打卡后自愿开启，每天最多一次 | proposed | today, settings | pending |
| D-20261110-056 | 2026-11-10 | 启动流畅：水合门 + 页面懒加载 + 空闲预取 | proposed | global | pending |
| D-20261110-057 | 2026-11-10 | 渲染层性能实测与零视觉回归优化 | proposed | build, showcase | pending |
| D-20261110-058 | 2026-11-10 | 竞品格局与差异化策略文档 | proposed | — | pending |
| D-20261110-059 | 2026-11-10 | 桌面摆件三档形态（口袋/标准/展台）+ 置顶开关 | approved | mini-widget, settings | LeeCM |
| D-20261110-060 | 2026-11-10 | 落成年鉴：按年汇总的年度回顾与可保存作品 | approved | stats, yearbook | LeeCM |
| D-20261110-061 | 2026-11-10 | WebDAV 服务商预设 + 分步连接自检 | approved | settings | LeeCM |
| D-20261110-062 | 2026-11-10 | 一键档案包：可读、可校验、可导入的本地档案馆 | approved | settings | LeeCM |
| D-20261110-063 | 2026-11-10 | 内容二期：免费扩展蓝图包与内容版本门 | approved | build, gallery, stats, settings | LeeCM |
| D-20261110-064 | 2026-11-10 | 桌面专注陪伴：摆件倒计时，到点确认落块，不监控 | approved | mini-widget, today | LeeCM |
| D-20261110-065 | 2026-11-10 | 建筑即编年史：图鉴里的建筑档案卡 | approved | build, gallery | LeeCM |
| D-20261110-066 | 2026-11-10 | 创新路线图与优先级：三波次（每天看见 / 陪伴与带走 / 长期故事） | approved | — | LeeCM |
| D-20261111-067 | 2026-11-11 | 蓝图色彩系统：18 座模型逐座配色与材质母题 | approved | build, gallery, showcase, archive | LeeCM |
| D-20261111-068 | 2026-11-11 | 自由装饰模式：全落成后的展台补充玩法（最小方案） | approved | showcase | LeeCM |
| D-20261111-069 | 2026-11-11 | 手动检查更新入口（关于页） | approved | settings | LeeCM |
| D-20261111-070 | 2026-11-11 | 内容包 v3：城市与生活续章 5 座（约 500 块）与 CONTENT_VERSION=3 | approved | build, gallery, stats, settings | LeeCM |
| D-20261112-071 | 2026-11-12 | P3 收尾：移动端触控目标 44px、图鉴未开始容量口径、装饰会话态说明 | approved | showcase, gallery, settings | LeeCM |

> 后续设计请按 `README.md` §3 模板新增记录，并在此表追加一行。