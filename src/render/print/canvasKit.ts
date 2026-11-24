/**
 * 导出画布共享原语（D-20261124-082）。
 *
 * 年鉴 / 建筑档案 / 拍立得 / 月度画报四套印刷品共用：
 * 字体串、DPR 画布准备、按宽度截断与折行、字体就绪等待、主题令牌读取。
 * 这里只放**纯绘制辅助**，不放任何一张印刷品的版式与内容。
 */

export const FONT_SANS = '"Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
export const FONT_NUM = '"Rubik", "MiSans", sans-serif'

export type FontWeight = 400 | 500 | 600 | 700

export function setFont(
  ctx: CanvasRenderingContext2D,
  weight: FontWeight,
  size: number,
  family = FONT_SANS
): void {
  ctx.font = `${weight} ${size}px ${family}`
}

/**
 * 设定物理尺寸并返回已按 DPR 缩放的 2D context。
 * 与各导出模块原先的 `canvas.width = w*dpr; canvas.height = h*dpr; ctx.scale(dpr,dpr)` 等价。
 */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number
): CanvasRenderingContext2D | null {
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)
  return ctx
}

/** 读取一个主题 CSS 变量；缺失时回退到调用点给定的值 */
export function readCssVar(name: string, fallback: string, doc: Document = document): string {
  if (typeof document === 'undefined') return fallback
  const value = doc?.defaultView?.getComputedStyle?.(doc.documentElement)?.getPropertyValue(name)
  return value?.trim() || fallback
}

/** 年鉴/档案共用主题色快照（只含纸/墨/线/点缀，不引入新色相） */
export interface PrintPalette {
  bg: string
  surface: string
  ink: string
  ink2: string
  line: string
  accent: string
}

/** 从 document 读取印刷品主题色；缺变量时回退到纸白主题令牌值 */
export function readPrintPalette(doc: Document = document): PrintPalette {
  return {
    bg: readCssVar('--bg', '#fafafa', doc),
    surface: readCssVar('--surface', '#ffffff', doc),
    ink: readCssVar('--ink', '#0a0a0a', doc),
    ink2: readCssVar('--ink-2', '#6b6b6b', doc),
    line: readCssVar('--line', '#e8e8e8', doc),
    accent: readCssVar('--accent', '#f5b301', doc)
  }
}

export interface TruncateOptions {
  /** 最少保留的字符数（默认 1；相纸/画报历史上分别用 4 / 3） */
  minLength?: number
  /** 已确定溢出时，即使无法再缩短也补省略号（相纸/画报的既有语义；年鉴默认不补） */
  ensureEllipsis?: boolean
}

/** 单行文本按宽度截断（超出补 ...） */
export function truncateToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  options: TruncateOptions = {}
): string {
  if (maxWidth <= 0) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  const minLength = Math.max(1, options.minLength ?? 1)
  let out = text
  while (out.length > minLength && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1)
  }
  if (out.length < text.length) return out + '...'
  return options.ensureEllipsis ? out + '...' : out
}

/** 多行文本折行（按字符宽度折，末行超宽截断） */
export function wrapTextToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] {
  const lines: string[] = []
  let rest = text
  while (rest.length > 0 && lines.length < maxLines) {
    if (ctx.measureText(rest).width <= maxWidth) {
      lines.push(rest)
      rest = ''
      break
    }
    let cut = rest.length
    while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--
    const space = rest.lastIndexOf(' ', cut)
    if (space > 0 && space > cut * 0.6) cut = space
    if (lines.length === maxLines - 1) {
      lines.push(truncateToWidth(ctx, rest, maxWidth))
      rest = ''
      break
    }
    lines.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  return lines
}

/** 绘制前等待字体就绪 + 一帧（避免 CJK 掉字/字重回退） */
export async function waitForFonts(doc: Document | undefined = document): Promise<void> {
  const fonts = (doc as (Document & { fonts?: FontFaceSet }) | undefined)?.fonts
  if (fonts?.ready) {
    try {
      await fonts.ready
    } catch {
      // 字体加载失败时用回退字族继续绘制，不阻塞导出
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}
