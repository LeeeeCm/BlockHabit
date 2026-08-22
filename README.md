# BlockHabit

极简黑白风格的桌面习惯打卡应用 —— 每次打卡掉落一块 2.5D 等距积木，积木按蓝图逐块拼成城堡、工厂。

![BlockHabit](src/assets/logo.svg)

## 特性

- **习惯打卡**：每天 / 每周 N 次两种频率，同日幂等，周频上限防刷块
- **积木奖励**：每次有效打卡掉落一块积木；连击每满 7 天，下一块为点缀色 bonus 积木
- **建造视图**：Canvas 等距渲染，滚轮缩放 / 拖拽平移，蓝图虚影预览，拼完触发落成仪式
- **蓝图**：灰岩城堡（161 块）、黑白工厂（169 块），拼完可开下一座
- **统计**：当前/最长连击、总次数、近 13 周日历热图（全完成日为琥珀色）
- **本地优先**：Tauri 环境存 `appDataDir/blockhabit.json`，浏览器回退 localStorage；支持导出/导入 JSON
- **主题**：纸白 / 墨黑，琥珀 `#F5B301` 唯一点缀色

## 技术栈

Tauri 2 · React 19 · TypeScript · Vite · zustand · Canvas 2D · vitest

```
src/
  logic/      纯逻辑：打卡规则 / 连击 / 蓝图（单测覆盖）
  render/     等距投影数学 + 立方体绘制 + 建造场景
  storage/    StorageAdapter 抽象（localStorage / Tauri fs）
  store/      zustand 全局状态 + 防抖持久化
  pages/      今日 / 建造 / 统计
```

## 开发

```bash
npm install
npm run tauri dev    # 桌面窗口（首次 Rust 编译约 3-10 分钟）
npm run dev          # 仅浏览器预览 http://localhost:1420
npm test             # vitest
npm run tauri build  # 出安装包 src-tauri/target/release/bundle/
```

> Git Bash 下跑 cargo 需把 MSVC `link.exe` 目录放到 PATH 最前（避免命中 coreutils link）：
> `export PATH="/c/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/<ver>/bin/Hostx64/x64:$HOME/.cargo/bin:$PATH"`

## 设计文档

- 规格：`docs/superpowers/specs/2026-08-22-blockhabit-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-22-blockhabit.md`
