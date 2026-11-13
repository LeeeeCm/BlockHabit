/**
 * 全局统一平滑阻尼鼠标滚轮控制器：
 * - 拦截 Windows / WebKit 原生单格滚轮粗暴瞬跳（±100~120px）
 * - 归一化为缓慢、均匀、一致的步进距离（每个滚轮齿槽步进 44px）
 * - 采用 requestAnimationFrame 物理缓动插值（lerp damping），实现平缓顺滑的恒速/缓动滚动
 * - 自动识别当前鼠标悬停的滚动容器（.dialog、.content 或任意 overflow-y 容器）
 * - 不干扰 Ctrl+滚轮缩放与 Canvas 3D 视角操作
 */

interface ActiveScroll {
  element: HTMLElement
  targetY: number
  currentY: number
  animId: number | null
}

let active: ActiveScroll | null = null

export function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let curr = el
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll') && curr.scrollHeight > curr.clientHeight) {
      return curr
    }
    curr = curr.parentElement
  }
  // 回退：主内容区 .content
  const content = document.querySelector('.content') as HTMLElement | null
  if (content && content.scrollHeight > content.clientHeight) return content
  return null
}

function tick() {
  if (!active) return
  const { element, targetY, currentY } = active
  const diff = targetY - currentY

  // 到达目标位置精度阈值，优雅对齐结束
  if (Math.abs(diff) < 0.6) {
    element.scrollTop = targetY
    active.animId = null
    active = null
    return
  }

  // 平缓恒定插值阻尼：每帧行进剩余距离的 16%，速度平缓、节奏一致且完全无顿挫
  const nextY = currentY + diff * 0.16
  active.currentY = nextY
  element.scrollTop = Math.round(nextY)

  active.animId = requestAnimationFrame(tick)
}

export function initSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onWheel = (e: WheelEvent) => {
    // 1. 如果已有事件阻止（如 3D 画布滚轮缩放、Ctrl+滚轮网页缩放），不拦截
    if (e.defaultPrevented || e.ctrlKey) return

    // 2. 找到当前鼠标悬停的可滚动容器
    const scrollable = findScrollableParent(e.target as HTMLElement | null)
    if (!scrollable) return

    const maxScroll = scrollable.scrollHeight - scrollable.clientHeight
    if (maxScroll <= 0) return

    // 3. 边界检查：若已在最顶部且往上滚，或已在最底部且往下滚，放行默认行为
    const direction = e.deltaY > 0 ? 1 : -1
    if (direction > 0 && scrollable.scrollTop >= maxScroll - 1) return
    if (direction < 0 && scrollable.scrollTop <= 1) return

    // 4. 拦截原生生硬跳动
    e.preventDefault()

    // 5. 归一化步进距离：
    // Windows 鼠标滚轮单格通常为 ±100~120px，归一化为缓慢而恒定的 44px
    const STEP = 44

    if (!active || active.element !== scrollable) {
      if (active?.animId) cancelAnimationFrame(active.animId)
      active = {
        element: scrollable,
        currentY: scrollable.scrollTop,
        targetY: scrollable.scrollTop,
        animId: null
      }
    }

    // 累加目标滚动高度，并钳制在 [0, maxScroll] 范围内
    active.targetY = Math.max(0, Math.min(maxScroll, active.targetY + direction * STEP))

    if (!active.animId) {
      active.animId = requestAnimationFrame(tick)
    }
  }

  window.addEventListener('wheel', onWheel, { passive: false, capture: true })

  return () => {
    if (active?.animId) cancelAnimationFrame(active.animId)
    window.removeEventListener('wheel', onWheel, { capture: true })
  }
}
