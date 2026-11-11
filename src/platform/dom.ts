/**
 * 用户是否要求「减少动态效果」（系统无障碍设置）。
 * canvas 侧动画必须据此降级为「瞬时落位」，无法判定时按「不减少」处理。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** body 滚动锁（引用计数，支持弹窗嵌套）——BottomSheet 与对话框共用 */
let lockCount = 0
let originalBodyOverflow = ''

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
}

export function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = originalBodyOverflow
  }
}

/** 测试专用：重置模块级计数 */
export function _resetBodyScrollLockForTest(): void {
  lockCount = 0
  originalBodyOverflow = ''
}
