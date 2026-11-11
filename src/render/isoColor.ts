/**
 * 等距渲染的「颜色域」：主题调色板、颜色派生、WCAG 对比度、时段环境光。
 *
 * 从 iso.ts 拆出（E4）：这段逻辑**不依赖任何几何/画布上下文**，是纯函数 + 两个 memo 缓存，
 * 单独成模块后既可单测、也不会被绘制代码的改动牵连。
 */

export interface IsoPalette {
  top: string
  left: string
  right: string
  ghost: string
  line: string
  accent: string
  /** 主题墨色（轮廓/交界线均按透明度派生自它） */
  ink: string
}

/* ---------------- 颜色派生（从主题 CSS 变量程序化调整，双主题通用） ---------------- */

/** 解析 #rgb / #rrggbb / rgb(r,g,b) 为 [r,g,b] */
export function parseColor(color: string): [number, number, number] | null {
  const s = color.trim()
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((ch) => ch + ch)
        .join('')
    if (hex.length !== 6) return null
    const n = parseInt(hex, 16)
    if (Number.isNaN(n)) return null
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  return null
}

/** 任意可解析颜色 + 透明度 → rgba() 字符串 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
}

/** 亮度乘法调整（HSL 的 L 通道 ×mult，钳制在 [0,1]），返回 rgb() 字符串 */
export function adjustLightness(color: string, mult: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  const r = rgb[0] / 255
  const g = rgb[1] / 255
  const b = rgb[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  const l2 = Math.min(1, Math.max(0, l * mult))
  // hsl → rgb
  if (s === 0) {
    const v = Math.round(l2 * 255)
    return `rgb(${v},${v},${v})`
  }
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s
  const pp = 2 * l2 - q
  const hue = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return pp + (q - pp) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return pp + (q - pp) * (2 / 3 - tt) * 6
    return pp
  }
  return `rgb(${Math.round(hue(h + 1 / 3) * 255)},${Math.round(hue(h) * 255)},${Math.round(hue(h - 1 / 3) * 255)})`
}

/* ---------------- 对比度工具（WCAG 2.x 相对亮度） ---------------- */

/** WCAG 相对亮度 */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color)
  if (!rgb) return 0
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

/** 两色对比度（1:1 ~ 21:1） */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 对比度地板：把块面颜色朝「远离背景」的方向逐级调整，直到与背景达到 minRatio。
 * 用途：环境光暗化后仍保证积木轮廓可辨（墨黑主题夜间曾把右脸压到 1.03:1，与背景几乎融为一体）。
 */
export function floorContrast(color: string, bg: string, minRatio: number): string {
  if (!parseColor(color) || !parseColor(bg)) return color
  // 只处理「暗底」：浅色底上块面即使变暗，对比度仍是上升的，无需兜底（也不该改动 oat/fog 的观感）
  if (relativeLuminance(bg) >= 0.2) return color
  if (contrastRatio(color, bg) >= minRatio) return color
  let out = color
  // 上限 64 步（乘数至 6.12）：此前 32 步（至 3.56）在「极暗块面 + 极暗背景」时
  // 可能穷尽循环仍达不到 minRatio，静默返回仍不达标的颜色（isoColor 单测抓到）。
  // 常规输入会在前几步就命中并提前返回，行为不变。
  for (let step = 1; step <= 64; step++) {
    out = adjustLightness(color, 1 + step * 0.08)
    if (contrastRatio(out, bg) >= minRatio) return out
  }
  return out
}

/** 积木三面派生色：以 CSS 变量为最亮缘（100%），按光照比例向暗缘渐变 */
export interface BlockShading {
  topA: string
  topB: string
  leftA: string
  leftB: string
  rightA: string
  rightB: string
  studTop: string
}

const paletteShadingCache = new Map<string, BlockShading>()

export function deriveShading(p: IsoPalette): BlockShading {
  const key = `${p.top}_${p.left}_${p.right}`
  const cached = paletteShadingCache.get(key)
  if (cached) return cached
  const topA = adjustLightness(p.top, 1.0)
  const result: BlockShading = {
    topA,
    topB: adjustLightness(p.top, 0.9), // 顶面：后缘 100% → 前缘 90%
    leftA: adjustLightness(p.left, 1.0),
    leftB: adjustLightness(p.left, 50 / 65), // 左面：上 65% → 下 50%
    rightA: adjustLightness(p.right, 1.0),
    rightB: adjustLightness(p.right, 22 / 35), // 右面：上 35% → 下 22%
    studTop: adjustLightness(topA, 1.08) // 凸点顶比块顶亮 +8%
  }
  paletteShadingCache.set(key, result)
  return result
}

const shadingColorCache = new Map<string, BlockShading>()

/** 为任意自定义十六进制或 RGB 颜色派生符合等距立体光照的三面渐变色 */
export function deriveShadingForColor(baseColor: string): BlockShading {
  const cached = shadingColorCache.get(baseColor)
  if (cached) return cached
  const topA = adjustLightness(baseColor, 1.0)
  const result: BlockShading = {
    topA,
    topB: adjustLightness(baseColor, 0.88),
    leftA: adjustLightness(baseColor, 0.78),
    leftB: adjustLightness(baseColor, 0.62),
    rightA: adjustLightness(baseColor, 0.52),
    rightB: adjustLightness(baseColor, 0.36),
    studTop: adjustLightness(topA, 1.08)
  }
  shadingColorCache.set(baseColor, result)
  return result
}

/**
 * C4：环境光暗化后的「块面对比度地板」（相对页面背景 --bg）。
 * 只约束暗化的两个时段（黄昏/夜幕）：它们把背光面乘到 0.55–0.68，
 * 在墨黑主题下会与背景几乎同色，积木轮廓消失。
 */
const MIN_FACE_CONTRAST = 1.02

export type TimePeriod = 'dawn' | 'noon' | 'dusk' | 'night'

/** 获取当前时段（晨曦/正午/黄昏/夜幕） */
export function getTimePeriod(hour = new Date().getHours()): TimePeriod {
  if (hour >= 6 && hour < 10) return 'dawn'
  if (hour >= 10 && hour < 16) return 'noon'
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}

export function applyAmbientLighting(
  p: IsoPalette,
  period: TimePeriod,
  bg = '#ffffff'
): IsoPalette {
  /**
   * 地板：不低于「本主题标准光照（noon）」下该块面相对页面背景的对比度。
   * 也就是说环境光可以让块面更亮，但不允许比标准光照更看不清。
   */
  const floorFace = (base: string, dimmed: string): string =>
    floorContrast(dimmed, bg, Math.max(MIN_FACE_CONTRAST, contrastRatio(base, bg)))
  switch (period) {
    case 'dawn':
      // 晨曦：明显暖金晨光，顶面提亮、背光面微沉
      return {
        ...p,
        top: adjustLightness(p.top, 1.14),
        left: adjustLightness(p.left, 1.08),
        right: adjustLightness(p.right, 0.9)
      }
    case 'dusk':
      // 黄昏：日落暖橘，暗面明显加深、顶面留金
      return {
        ...p,
        top: adjustLightness(p.top, 1.1),
        left: floorFace(p.left, adjustLightness(p.left, 0.84)),
        right: floorFace(p.right, adjustLightness(p.right, 0.68)),
        ghost: adjustLightness(p.ghost, 0.9)
      }
    case 'night':
      // 夜幕：夜灯质感，块身整体沉稳变暗、顶面保留聚光。
      // C4：暗化后按对比度地板回收——墨黑主题右脸曾被压到 1.03:1（与背景几乎同色）。
      return {
        ...p,
        top: adjustLightness(p.top, 0.9),
        left: floorFace(p.left, adjustLightness(p.left, 0.68)),
        right: floorFace(p.right, adjustLightness(p.right, 0.55)),
        ghost: adjustLightness(p.ghost, 0.75)
      }
    case 'noon':
    default:
      // 正午：标准高对比度自然光
      return p
  }
}

let cachedThemeKey = ''
let cachedPalette: IsoPalette | null = null

/** 从 CSS 变量读取当前主题的调色板（支持时段感知昼夜环境光照与记忆化缓存） */
export function paletteFromDocument(doc: Document = document, enableAmbient = false): IsoPalette {
  const theme = doc.documentElement.getAttribute('data-theme') || 'light'
  const period: TimePeriod = enableAmbient ? getTimePeriod() : 'noon'
  const cacheKey = `${theme}_${enableAmbient ? period : 'std'}`
  if (cachedPalette && cachedThemeKey === cacheKey) {
    return cachedPalette
  }
  const s = getComputedStyle(doc.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  const basePalette: IsoPalette = {
    top: v('--block-top'),
    left: v('--block-left'),
    right: v('--block-right'),
    ghost: v('--block-ghost'),
    line: v('--line'),
    accent: v('--accent'),
    ink: v('--ink')
  }
  cachedThemeKey = cacheKey
  // 对比度地板需要知道页面背景色（--bg）：暗色主题的积木面与背景同色系
  cachedPalette = enableAmbient
    ? applyAmbientLighting(basePalette, period, v('--bg') || '#ffffff')
    : basePalette
  return cachedPalette
}
