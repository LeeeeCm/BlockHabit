---
id: D-20261110-048
date: 2026-11-10
title: 六项待决事项按建议决议：F4 批依赖并落地原生 HTTP、D1 公理改写、D2 保留装饰色、LICENSE=MIT
status: approved
owner: lead
surface: [settings]
axioms: [A1, A7]
files: [LICENSE, package.json, src/platform/http.ts, src/sync/webdav.ts, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, design/AESTHETIC.md, design/ART.md]
supersedes: []
reviewer: LeeCM
---

## 背景

`design/REVIEW-QUEUE.md` 第 5 节列出的 6 项决策，人类回复「都按照你的建议进行下一步修改」，本轮逐项落地。

## 决议与落地

| # | 事项 | 决议 | 落地动作 |
| --- | --- | --- | --- |
| 1 | **F4 依赖审批** | 批准 | 新增 `@tauri-apps/plugin-http` + Rust `tauri-plugin-http`；WebDAV 走原生 HTTP，绕开 WebView CORS |
| 2 | **D1 唯一点缀色** | 改为「唯一点缀色 = 该主题的 --accent」 | 改写 AESTHETIC §3 第 1 条；oat 赤陶 / fog 蓝成为合法点缀色，不再是公理违例 |
| 3 | **D2 装饰色** | 不动 | 在 ART.md 明确「蓝图装饰色是刻意保留的实物隐喻」，阻断后续审计重复误报 |
| 4 | **F2 下半内容** | 只保留诚实提示 | 已在 `D-038/041` 落地，本轮补记为正式决议，不再追加玩法 |
| 5 | **F6 updater** | 暂不接入 | 无代码改动；理由：无代码签名证书时接 updater 无法安全验证 |
| 6 | **LICENSE** | MIT | 新增 `LICENSE` + `package.json` 的 `license` 字段 |

## F4 实现细节

### 1) 平台层封装 `src/platform/http.ts`
```ts
export async function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) return tauriFetch(input, init)  // 原生 HTTP，无 CORS
  return fetch(input, init)                             // 浏览器预览保持原行为
}
```
用**运行时探测**（`'__TAURI_INTERNALS__' in window`）而不是编译期分支：同一份产物在桌面端与浏览器预览都能跑，jsdom 测试环境自动走标准 fetch。

### 2) 只替换 WebDAV 的 4 处请求
PROPFIND / GET / PUT / MKCOL 全部改为 `httpFetch`；其它潜在网络调用不做全局替身。

### 3) Rust 侧与能力声明
- `Cargo.toml`：新增 `tauri-plugin-http`（v2）；
- `lib.rs`：注册 `tauri_plugin_http::init()`；
- `capabilities/default.json`：声明 `http:default` 允许 `https://*` / `http://*`（WebDAV 地址由用户自填，无法预先收窄域名）。

## 取舍与被否方案

1. **否决「Rust 侧自写 WebDAV 命令」**：要自己实现 PROPFIND/MKCOL 与 XML 解析，而插件已给标准 HTTP 客户端，我们只需要绕开 CORS。
2. **否决「全局替换 `fetch`」**：隐式行为变化难追踪；只改 WebDAV 4 处。
3. **D1 不再迁移 accent 用法**：公理澄清后 oat/fog 的 accent 本就是该主题点缀色，约 30 处无需改；B5 视觉等级下一轮单独做。
4. **D2 明确「不动」并写进 ART.md**：阻断「每次审计都重新问一遍」。

## 影响面

- 依赖：+1 npm 包、+1 Rust crate（安装包体积下一轮出包实测）；
- 代码：新增 1 个平台模块、4 处调用点改名；
- 文档：AESTHETIC 公理改写、ART 补装饰色说明、LICENSE 新增；
- 用户可见：**桌面端 WebDAV 从此可用**（此前必被 CORS 拦）；浏览器预览行为不变。

## 验收标准

- `npx tsc --noEmit` 0 错误；`npm test` 全绿（604 例）；
- `cargo check` 通过（含新插件）；
- `npm run design:check` 通过；
- `LICENSE` 存在，`package.json` 的 `license` 为 MIT。

## 后续

- B5（全勤块 vs 连击块的视觉等级）在 D1 澄清后实施，需前后截图；
- F4 端到端验证需真实 WebDAV 服务器 + 桌面窗口，本环境只能验「编译/类型/单测」链路。

## 变更履历

- 2026-11-10 created (lead)

## 补充：版本对齐与体积实测（同一轮）

### 1) 首次构建失败：npm 与 crate 版本必须同 次版本
```
Error Found version mismatched Tauri packages:
tauri-plugin-http (v2.5.9) : @tauri-apps/plugin-http (v2.8.3)
```
Tauri CLI 要求两侧**同 major.minor**。处理：
- Rust 侧固定 `tauri-plugin-http = 2.8.3`（并用 2.7.1 / 2.5.1 等匹配 fs/autostart/notification/opener）；
- 把 `@tauri-apps/plugin-fs` 升到 ^2.7.1 与 cargo 解析结果对齐；
- 固定后 `cargo check` 与 `npm run tauri build` 均通过。

### 2) 体积代价（诚实记录）
| 产物 | F4 前 | F4 默认特性 | F4 最小特性（采用） |
| --- | --- | --- | --- |
| NSIS | 7.23 MB | 8.77 MB | **8.53 MB** |
| MSI | 8.34 MB | 10.48 MB | **10.13 MB** |
| exe | 16.11 MB | 21.61 MB | **20.68 MB** |

HTTP 客户端的 TLS 栈（rustls + 证书）是主要增量，无法靠裁剪特性消除；已把默认特性从 cookies/brotli/zstd/multipart/http2 收窄到仅 `rustls-tls`（省 0.24 MB）。
**相对优化前基线（11.34 / 12.36 MB）仍是 -25% / -18%**，E1 的收益没有被吃掉，但 CHANGELOG 已据实更新数字。

### 3) 验证边界
本环境只能证明「编译 / 类型 / 单测 / 出包」链路；**真实 WebDAV 连通性需要桌面窗口 + 一台 WebDAV 服务器**（如 Nextcloud）人工验证。

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。

## 履历补充：F6 决议已被取代（2026-11-14）

- 本记录第 5 项「F6 updater：暂不接入」的理由是「无代码签名证书时接 updater 无法安全验证」，该结论**已被取代**：
  D-20261111-069（approved）与 `docs/release/updater-and-keyring-assessment.md`（C4 评估）确认 Tauri 2 updater 用**自带 minisign 签名**即可验证更新包
  （不依赖 Windows Authenticode），并已落地 `@tauri-apps/plugin-updater` / `@tauri-apps/plugin-process` 与设置页「版本与更新」手动检查入口。
- 因此「F6 暂不接 updater」只记录了 2026-11-10 当时的判断，**不再是当前结论**；以 D-20261111-069 / C4 为准。
- 本条为追加式说明，不修改上文任何已写内容（AGENTS.md §2 禁止删除/改写既有记录）。
