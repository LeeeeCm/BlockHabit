---
id: D-20261110-040
date: 2026-11-10
title: 生产构建分包：主 chunk 497 kB → 296 kB，消除 500 kB 告警（无视觉变化）
status: proposed
owner: lead
surface: []
axioms: []
files: [vite.config.ts]
supersedes: []
reviewer: pending
---

## 背景与问题

`D-20261110-039` 的端到端构建里出现告警 `Some chunks are larger than 500 kB`：主 JS chunk 实测 **497 kB**，紧贴阈值。虽然桌面端从本地读文件、不是弱网首屏问题，但有一个真实代价：
**应用代码任何一处小改动，都会让用户重下整个 497 kB 的 chunk**（升级安装包本身是整包替换，但开发期增量/将来若做在线更新，稳定 vendor chunk 能显著减小增量）。

## 设计决定

按「变更频率」把依赖拆成稳定 chunk（`vite.config.ts` 的 `build.rollupOptions.output.manualChunks`）：

| chunk | 内容 | 体积 |
| --- | --- | --- |
| `react` | react / react-dom / scheduler | **192.51 kB** |
| `index` | 应用代码 | **295.61 kB**（原 497 kB） |
| `tauri` | @tauri-apps/api 与各插件 | 30.90 kB |
| `state` | zustand | 0.65 kB |

用**函数式** `manualChunks(id)`（按 `node_modules` 路径判定）而不是对象式映射：对象式需要逐个写死入口名（`@tauri-apps/api/window` 这类子路径容易写错），函数式按目录归属更稳。

## 取舍与被否方案

1. **否决「只调 `chunkSizeWarningLimit` 把告警压掉」**：那只是让告警闭嘴，用户依然重下整包。
2. **否决「按页面路由做动态 `import()`」**：本项目是 4 个页面的桌面应用，页面切换无网络延迟，拆路由收益小且会引入 loading 态；拆「框架 / 平台 / 状态」这类几乎不变的依赖更划算。
3. **未动 `dist` 产物提交规则**：`dist/` 仍不提交（AGENTS §4）。

## 影响面

- 代码：仅 `vite.config.ts`，1 个配置块；**运行时代码零改动**。
- 用户可见：**无**（分块只影响加载方式，不影响渲染）。
- 构建：500 kB 告警消失（最大 chunk 296 kB）。

## 验收标准

### 构建
- `npx vite build` 成功（1.52s），产物：`react 192.51 kB` / `index 295.61 kB` / `tauri 30.90 kB` / `state 0.65 kB`；无 >500 kB 告警。

### 生产包运行时（决定性证据）
用 `vite preview` 起真实产物（不是 dev server）后实测：
- 应用外壳渲染：root 有子节点、`今日` 与三段导航文案存在；
- 切到建造页：canvas **1264×632**，采样非白像素 **8236**（与 dev 环境一致）——说明 iso 四模块 + 拆分后的 chunk 在打包产物里加载顺序正确；
- 截图 `.tmp-verify/chunk-split-prod.png` / `chunk-split-build.png`。

### 常规门禁
- `npx tsc --noEmit` / `npm test` / `npm run design:check` 保持全绿。

## 变更履历

- 2026-11-10 created (lead)
