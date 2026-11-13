---
id: D-20261110-014
date: 2026-11-10
title: 实施 E1：字体瘦身 —— 移除从未加载的 MiSans 两个字重与 Rubik 四个无用子集（dist 9.80→5.42 MB，逐像素零回归）
status: approved
owner: lead
surface: []
axioms: [A2]
files: [src/main.tsx]
supersedes: []
reviewer: LeeCM
---

## 背景与问题

`D-20261110-003`（C11）与 `-005`（C11）都指出：**安装包 11.47MB 里 90.5% 是字体**。实测 `dist` 9.80MB / 429 文件，其中字体 8.87MB，构成：

| 字体 | 体积 | 文件数 |
| --- | --- | --- |
| MiSans 四字重（Regular / Medium / Semibold / Bold） | 7.72 MB | 372 个 unicode-range 分片 |
| Rubik 四字重 × 6 子集 × 2 格式 | 0.58 MB | 48 个 |
| 阿里妈妈数黑体（标题） | 0.57 MB | 1 个 |

但**没有任何证据表明这四套字重的每一档都在用**。项目文档（`design/TOKENS.md`）只描述了「中文字重路由」的机制，没有实测过浏览器到底下载了哪些文件。

## 设计决定

### 第一步：用真实浏览器测「谁被真的加载了」
用 `performance.getEntriesByType('resource')` 抓字体请求（这比 `document.fonts` 更准：它记录的是真正下载过的分片），覆盖今日 / 建造 / 展台 / 统计 / 设置五个界面：

```
改动前：18 个字体请求
  Rubik latin 400 / 500 / 600 / 700   4
  AlimamaShuHeiTi                    1
  MiSans-Medium                      6   ← 在用
  MiSans-Bold                        7   ← 在用
  （MiSans-Regular / MiSans-Semibold：从未被请求）
```

结论：**MiSans Regular 与 Semibold 在全应用任何界面、任何字重下都没有被下载过一次**（中文字重分别由 Medium 承接 400/500、Bold 承接 600/700，标题由阿里妈妈承接）。

### 第二步：只删「测出来没被用过」的东西
- `src/main.tsx` 移除 `MiSans-Regular.min.css` 与 `MiSans-Semibold.min.css` 两行 import（保留 Medium + Bold）。
- Rubik 的四行全子集 import（`@fontsource/rubik/400.css` 等，各含 arabic / cyrillic / cyrillic-ext / hebrew / latin / latin-ext 六套）改为 **仅 latin + latin-ext** 的子集 CSS（8 行）。中文不走 Rubik，阿拉伯/西里尔/希伯来/越南语在这个中英双语桌面应用里没有任何文本会触发。
- **没有**改动任何 `@font-face` 声明、字族顺序、字号、字重、`unicode-range` 语义（阿里妈妈那一条保持原样）。

## 取舍与被否方案

1. **否决「引入 `@fontsource-variable/rubik` 变量字体」**：需要新增依赖（AGENTS 要求先问），且 Rubik 现在只剩 16 个文件 / 0.2MB，收益不足。
2. **否决「删掉整个 MiSans」**：Medium 与 Bold 实测在用（承接 400/500 与 600/700 的中文分片），删掉会掉到系统字体（Microsoft YaHei），属于真实视觉变更。
3. **否决「只保留阿里妈妈，中文全用它」**：字重路由与观感都会变（正文不再是 MiSans 的中性字形），违背「美术风格不变」。
4. **否决「用工具做字体子集化（pyftsubset）」**：用户习惯名是自由文本，子集化会在遇到生僻字时缺字；且 MiSans 的 unicode-range 分片本身已按需加载，运行时开销不是瓶颈——瓶颈是安装包体积，删无人使用的字重/子集即可解决。

## 影响面

- 代码：`src/main.tsx` 的 import 列表（4 行 → 8 行 subset CSS；4 行 MiSans → 2 行）。
- 产物：`dist` **9.80 MB / 429 文件 → 5.42 MB / 212 文件**（−4.38 MB，−45%）；字体 8.87 → 4.70 MB；Rubik 文件 48 → 16。
- 用户可见：**逐像素无变化**（见下方验收证据）。

## 验收标准

### 视觉回归（决定性证据）
在 `npm run dev` + agent-browser 下，用同一份存档（1 个习惯、同一语言/主题）分别截取 **今日 / 建造 / 展台 / 统计 / 设置** 五个界面，改动前后用 `sharp` 逐像素比对（阈值 ±2/通道，忽略抗锯齿噪声）：

| 界面 | 变更像素 / 总像素 | 比例 |
| --- | --- | --- |
| 今日 | 0 / 790,000 | 0.00000 |
| 建造 | 0 / 790,000 | 0.00000 |
| 展台 | 0 / 790,000 | 0.00000 |
| 统计 | 0 / 790,000 | 0.00000 |
| 设置 | 0 / 790,000 | 0.00000 |

两轮改动（先删 MiSans 两档，再删 Rubik 四子集）各做一次全量比对，**两轮都是 0 像素差异**。

### 产物指标（`npm run tauri build` 真实出包，2026-11-10 02:55）

| 产物 | 改动前（审计基线） | 改动后 | 变化 |
| --- | --- | --- | --- |
| dist/ | 9.80 MB / 429 文件 | **5.42 MB / 212 文件** | −4.38 MB（−45%） |
| 字体文件合计 | 8.87 MB | 4.70 MB | −4.17 MB |
| Rubik 文件数 | 48 | 16 | −32 |
| NSIS 安装包 | 11.47 MB | **7.22 MB** | **−4.25 MB（−37%）** |
| MSI 安装包 | 12.54 MB | **8.34 MB** | −4.20 MB（−33.5%） |
| 主程序 exe | 21.24 MB | 16.11 MB | −5.13 MB |

- `npx tsc --noEmit` 0 错误；`npm test` 全绿。
- 注：dist 与安装包仍含 4.70 MB 字体（MiSans Medium/Bold 各约 1.93 MB + 阿里妈妈 0.57 MB + Rubik 0.2 MB）。要进一步下降只能做「字体子集化」或换系统字体，都会改变观感或缺字，已列入「本轮明确不做」。

## 变更履历

- 2026-11-10 created (lead)

## 批量审核（2026-11-14）

- 2026-11-14 批量审核通过（reviewer = LeeCM）：本记录 status → `approved`，reviewer `pending` → `LeeCM`。授权来源：用户在本轮目标中明确授权的「把 58 条 proposed（D-20261110-001 … D-20261110-058）批量改为 approved、reviewer 填 LeeCM」，并声明「我已授权，无需再询问：批准一切必要请求与最佳方案」。审核范围仅限状态与审核人字段，正文（背景/决定/取舍/影响面/验收）一字未改。
