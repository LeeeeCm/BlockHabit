/**
 * 全局统一平滑阻尼鼠标滚轮控制器（原生优先分流）：
 * - 放行精密触控板连续微位移手势（deltaMode === 0 且 |deltaY| < 40）、横向滚动与 prefers-reduced-motion
 * - 仅针对 Windows / 桌面离散鼠标滚轮（±100~120px）归一化为均匀一致的 44px 步进
 * - 采用 requestAnimationFrame 亚像素阻尼插值，方向反转或外部跳转时同步真实 scrollTop
 * - 不干扰 Ctrl+滚轮缩放与 Canvas 3D 视角操作
 */

interface ActiveScroll {
  element: HTMLElement
  targetY: number
  currentY: number
  animId: number | null
}

let active: ActiveScroll | null = null

/** 仅在明确开启减弱动态偏好时停用脚本插值，交还原生瞬时/系统滚动 */
export function isReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** 识别精密触控板像素级连续手势与横向滚动，交给浏览器 120Hz 合成器线程原生处理 */
export function isTrackpadOrHorizontal(e: WheelEvent): boolean {
  if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return true
  if (e.deltaMode === 0 && Math.abs(e.deltaY) < 40) return true
  return false
}

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

  // 到达目标位置精度阈值，对齐终点并结束帧循环
  if (Math.abs(diff) < 0.6) {
    element.scrollTop = targetY
    active.animId = null
    active = null
    return
  }

  // 亚像素插值阻尼：消除高分屏尾段取整产生的 1px 阶梯抖动
  const nextY = currentY + diff * 0.16
  active.currentY = nextY
  element.scrollTop = nextY

  active.animId = requestAnimationFrame(tick)
}

export function initSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onWheel = (e: WheelEvent) => {
    // 1. 已有阻止（如 3D 画布缩放）、Ctrl+缩放、减弱动态、触控板微位移或横向滚动均放行原生处理
    if (e.defaultPrevented || e.ctrlKey || isReducedMotion() || isTrackpadOrHorizontal(e)) return

    // 2. 找到当前鼠标悬停的可滚动容器
    const scrollable = findScrollableParent(e.target as HTMLElement | null)
    if (!scrollable) return

    const maxScroll = scrollable.scrollHeight - scrollable.clientHeight
    if (maxScroll <= 0) return

    // 3. 边界检查：若已在最顶部且往上滚，或已在最底部且往下滚，放行默认行为
    const direction = e.deltaY > 0 ? 1 : -1
    if (direction > 0 && scrollable.scrollTop >= maxScroll - 1) return
    if (direction < 0 && scrollable.scrollTop <= 1) return

    // 4. 拦截离散鼠标滚轮生硬跳动
    e.preventDefault()

    // 5. 归一化步进距离：Windows 鼠标滚轮单格通常为 ±100~120px，归一化为平缓的 44px
    const STEP = 44

    if (!active || active.element !== scrollable) {
      if (active?.animId) cancelAnimationFrame(active.animId)
      active = {
        element: scrollable,
        currentY: scrollable.scrollTop,
        targetY: scrollable.scrollTop,
        animId: null
      }
    } else {
      const prevDir = active.targetY - active.currentY
      // 外部拖动滚动条或方向反转时，立即与真实 scrollTop 对齐，避免反向滞后
      if (Math.abs(scrollable.scrollTop - active.currentY) > 2 || prevDir * direction < 0) {
        active.currentY = scrollable.scrollTop
        active.targetY = scrollable.scrollTop
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
    active = null
    window.removeEventListener('wheel', onWheel, { capture: true })
  }
}
