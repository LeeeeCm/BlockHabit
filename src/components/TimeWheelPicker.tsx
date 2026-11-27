import { useCallback, useEffect, useRef, useState } from 'react'
import { playSnapSound } from '../audio/sound'
import { prefersReducedMotion } from '../platform/dom'
import { triggerHaptic } from '../platform'

/**
 * 时间滚轮（D-20261126-116 取代 D-20261126-115 的常驻三行形态）。
 *
 * 交互形态：
 * - 常态只占一行：只显示当前时间，高度与旁边的分段按钮一致，不撑高设置页；
 * - 鼠标点一下 → 上下各展开一行（共 3 行），出现聚焦框，表示「此刻滚轮归我」；
 * - 展开后滚动中键滚轮即可逐行改时间，页面本身不跟着滚（滚轮事件在列内拦下）；
 * - 点别处 / 再点一次 / 按 Esc / 焦点离开（有 120ms 宽限，避免滚完立刻收起）→ 收回一行。
 *
 * 左轮 0–23 小时、右轮 00–59 分钟，两轮都首尾循环：内容复制三份，
 * 静止后把位移悄悄搬回中间那份（内容相同，视觉零跳变），于是永远能继续往下滚。
 *
 * 不用原生滚动 + scroll-snap：WebView2 里一格滚轮会被合成器放大成多行、
 * preventDefault 又拦不住 snap 的二次吸附（实测一格走两行且回跳）。
 * 这里自己驱动 translate3d + rAF：滚轮一格 = 一行，160ms 缓出；
 * 拖拽跟手 + 甩动惯性 + 吸附；每帧只给中心 ±3 行做 rotateX 圆柱投影。
 */

/** 行高默认值；实际以 CSS 的 --tw-row 为准（挂载时读取，避免两处数字漂移） */
const DEFAULT_ROW = 26
/** 展开后的可见行数（奇数，正中间那行即选中行） */
const VISIBLE_ROWS = 3
/** 中心行相对列顶部的行偏移：3 行时中心是第 1 行 */
const CENTER_OFFSET = (VISIBLE_ROWS - 1) / 2
/** 内容复制份数（三份即可上下都留一份余量） */
const REPEAT = 3
/** 单步动画时长 */
const STEP_MS = 160
/** 拖拽甩动的速度衰减 */
const FRICTION = 0.94
/** 低于这个速度就吸附落位（px/ms） */
const MIN_VELOCITY = 0.02
/** 失焦后收回一行的宽限：滚完最后一格鼠标还在列上时不该立刻收起 */
const BLUR_GRACE_MS = 120

const pad2 = (n: number) => String(n).padStart(2, '0')
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

interface ColumnProps {
  /** 取值个数：小时 24、分钟 60 */
  count: number
  value: number
  onChange: (value: number) => void
  /** 无障碍名称，例如「提醒时间 小时」 */
  ariaLabel: string
  disabled?: boolean
  /** 是否展开（true = 3 行 + 上下邻居可见；false = 只留当前一行） */
  expanded: boolean
  /** 把「走 n 行」交给父级统一调度（滚轮监听在组容器上，才能整组一致） */
  registerStep: (step: (delta: number) => void) => void
}

function TimeWheelColumn({
  count,
  value,
  onChange,
  ariaLabel,
  disabled,
  expanded,
  registerStep
}: ColumnProps) {
  const colRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const rafRef = useRef<number | null>(null)
  /** 当前位移（px）：0 = 第一行贴顶，选中行 = CENTER_OFFSET + index */
  const offsetRef = useRef(0)
  /** 行高（挂载后从 CSS 令牌读取） */
  const rowRef = useRef(DEFAULT_ROW)
  /** 最近一次回报给父级的值，用来区分「自己滚出来的」与「外部改的」 */
  const emittedRef = useRef(value)
  /** 拖拽状态 */
  const dragRef = useRef<{
    startY: number
    startOffset: number
    lastY: number
    lastT: number
    velocity: number
  } | null>(null)
  const total = count * REPEAT
  const maxOffset = (total - 1) * rowRef.current

  /** 中心 ±3 行的圆柱投影 + 远端淡出；只碰可见窗口，长列表也不掉帧 */
  const paint = useCallback(() => {
    const position = offsetRef.current / rowRef.current + CENTER_OFFSET
    const center = Math.round(position)
    for (let i = center - 3; i <= center + 3; i++) {
      const node = itemRefs.current[i]
      if (!node) continue
      const distance = i - position
      const abs = Math.abs(distance)
      const angle = clamp(distance * 16, -62, 62)
      const scale = (1 - Math.min(0.1, abs * 0.035)).toFixed(3)
      node.style.transform = `perspective(760px) rotateX(${angle}deg) scale(${scale})`
      // 收起时只有中心行可见：上下邻居整行淡出，不做位移（否则会看到「半行」卡在边上）
      const fade = expanded ? (1 - Math.min(0.55, abs * 0.16)).toFixed(3) : abs < 0.5 ? '1' : '0'
      node.style.opacity = fade
    }
    const track = trackRef.current
    if (track) track.style.transform = `translate3d(0, ${-offsetRef.current}px, 0)`
  }, [expanded])

  /** 把当前中心行换算成对外取值，变化时回报 */
  const report = useCallback(() => {
    const position = offsetRef.current / rowRef.current + CENTER_OFFSET
    const index = Math.round(position)
    const next = ((index % count) + count) % count
    if (next !== emittedRef.current) {
      emittedRef.current = next
      onChange(next)
      triggerHaptic('selection')
      playSnapSound()
    }
  }, [count, onChange])

  /** 停止后把位移搬回中间副本：内容相同，视觉零位移 */
  const recenter = useCallback(() => {
    const row = rowRef.current
    const index = Math.round(offsetRef.current / row + CENTER_OFFSET)
    if (index < count) offsetRef.current += count * row
    else if (index >= count * 2) offsetRef.current -= count * row
    paint()
  }, [count, paint])

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /**
   * 动画到目标位移并落位。
   * 用 rAF 而不是原生平滑滚动：位移完全由我们掌握，不会被吸附/惯性二次改写。
   */
  const animateTo = useCallback(
    (targetOffset: number, duration: number, onDone?: () => void) => {
      cancelAnimation()
      const start = offsetRef.current
      const delta = targetOffset - start
      if (duration <= 0 || prefersReducedMotion()) {
        offsetRef.current = targetOffset
        paint()
        report()
        onDone?.()
        return
      }
      let first: number | null = null
      const tick = (stamp: number) => {
        // rAF 的 timestamp 与 performance.now() 同源，但测试环境（jsdom）可能不同基准；
        // 以第一帧为锚点做相对计时，再夹在 0..1。
        if (first === null) first = stamp
        const t = clamp((stamp - first) / duration, 0, 1)
        offsetRef.current = start + delta * easeOut(t)
        paint()
        report()
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = null
          onDone?.()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [cancelAnimation, paint, report]
  )

  /** 走 n 行（正数向下 = 数值变大） */
  const stepBy = useCallback(
    (delta: number, duration = STEP_MS) => {
      if (disabled || delta === 0) return
      const row = rowRef.current
      const index = Math.round(offsetRef.current / row + CENTER_OFFSET)
      const targetIndex = clamp(index + delta, 0, total - 1)
      animateTo((targetIndex - CENTER_OFFSET) * row, duration, recenter)
    },
    [animateTo, disabled, recenter, total]
  )

  /** 挂载：读真实行高 → 定位到中间副本的当前值 → 画首帧 */
  useEffect(() => {
    const col = colRef.current
    if (!col) return
    const cssRow = parseFloat(getComputedStyle(col).getPropertyValue('--tw-row').trim())
    if (Number.isFinite(cssRow) && cssRow > 0) rowRef.current = cssRow
    offsetRef.current = (count + value - CENTER_OFFSET) * rowRef.current
    emittedRef.current = value
    const frame = requestAnimationFrame(() => {
      if (!rowRef.current) rowRef.current = DEFAULT_ROW
      paint()
    })
    return () => cancelAnimationFrame(frame)
    // 只在挂载 / 取值个数变化时定位；之后的取值由 report 推动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  /** 展开 / 收起时重画可见度（邻居该淡出还是该出现） */
  useEffect(() => {
    paint()
  }, [expanded, paint])

  /** 外部改值（例如别的入口写回设置）时平滑滚到对应行 */
  useEffect(() => {
    if (value === emittedRef.current) return
    emittedRef.current = value
    const row = rowRef.current
    const index = Math.round(offsetRef.current / row + CENTER_OFFSET)
    const copy = clamp(Math.floor(index / count), 0, REPEAT - 1)
    animateTo((copy * count + value - CENTER_OFFSET) * row, STEP_MS, recenter)
  }, [animateTo, count, recenter, value])

  useEffect(() => () => cancelAnimation(), [cancelAnimation])

  useEffect(() => {
    registerStep((delta) => stepBy(delta))
  }, [registerStep, stepBy])

  /** 拖拽：跟手位移 + 甩动惯性 + 吸附最近一行 */
  useEffect(() => {
    const col = colRef.current
    if (!col) return

    function onPointerDown(event: PointerEvent) {
      if (disabled || event.button !== 0) return
      cancelAnimation()
      dragRef.current = {
        startY: event.clientY,
        startOffset: offsetRef.current,
        lastY: event.clientY,
        lastT: performance.now(),
        velocity: 0
      }
      col?.setPointerCapture?.(event.pointerId)
    }

    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const now = performance.now()
      const dt = now - drag.lastT
      if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt
      drag.lastY = event.clientY
      drag.lastT = now
      offsetRef.current = clamp(drag.startOffset - (event.clientY - drag.startY), 0, maxOffset)
      paint()
      report()
    }

    function onPointerUp(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      col?.releasePointerCapture?.(event.pointerId)
      const row = rowRef.current
      // 惯性：按松手速度多滑一段，再吸附到最近一行
      const velocity = prefersReducedMotion() ? 0 : drag.velocity
      const glide = Math.abs(velocity) > MIN_VELOCITY ? (-velocity * row * 3) / FRICTION : 0
      const projected = clamp(offsetRef.current + glide, 0, maxOffset)
      const index = Math.round(projected / row + CENTER_OFFSET)
      animateTo((clamp(index, 0, total - 1) - CENTER_OFFSET) * row, 260, recenter)
    }

    col.addEventListener('pointerdown', onPointerDown)
    col.addEventListener('pointermove', onPointerMove)
    col.addEventListener('pointerup', onPointerUp)
    col.addEventListener('pointercancel', onPointerUp)
    return () => {
      col.removeEventListener('pointerdown', onPointerDown)
      col.removeEventListener('pointermove', onPointerMove)
      col.removeEventListener('pointerup', onPointerUp)
      col.removeEventListener('pointercancel', onPointerUp)
    }
  }, [animateTo, cancelAnimation, disabled, maxOffset, paint, recenter, report, total])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key
    // Esc 交给组容器统一处理（见 TimeWheelPicker 的 onKeyDown），这里不拦
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault()
      stepBy(key === 'ArrowUp' ? -1 : 1)
    } else if (key === 'PageUp' || key === 'PageDown') {
      event.preventDefault()
      stepBy(key === 'PageUp' ? -5 : 5)
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault()
      stepBy(key === 'Home' ? -count : count, STEP_MS * 2)
    }
  }

  /** 点某一行：把它滚到中心（距离超过一屏时瞬移，不做长动画） */
  function focusRow(index: number) {
    if (disabled) return
    const row = rowRef.current
    const current = Math.round(offsetRef.current / row + CENTER_OFFSET)
    const distance = index - current
    if (distance === 0) return
    const duration = Math.abs(distance) > 8 ? 0 : STEP_MS + Math.min(120, Math.abs(distance) * 12)
    animateTo((index - CENTER_OFFSET) * row, duration, recenter)
  }

  return (
    <div className={`tw-view${expanded ? ' is-expanded' : ''}`}>
      <div
        ref={colRef}
        className="tw-col"
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={value}
        aria-valuetext={pad2(value)}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
      >
        <div ref={trackRef} className="tw-track">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              ref={(node) => {
                itemRefs.current[i] = node
              }}
              className="tw-item"
              onClick={() => focusRow(i)}
            >
              {pad2(i % count)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PickerProps {
  /** "HH:mm" */
  value: string
  onChange: (value: string) => void
  /** 整组无障碍名称，例如「晚间收尾提醒时间」 */
  ariaLabel: string
  hourLabel: string
  minuteLabel: string
  disabled?: boolean
}

/**
 * 双列循环时间滚轮：左小时、右分钟，中间一根冒号。
 * 只产出合法的 "HH:mm"（小时 0–23、分钟 0–59）。
 *
 * 展开态由本组件统一持有：点任意一列即整组展开（两列同时露出上下邻居），
 * 这样「左列有焦点、右列还叠在原位」的错位感不会出现。
 * 收起时机：点外部 / Esc / 焦点离开（带宽限）。
 */
export function TimeWheelPicker({
  value,
  onChange,
  ariaLabel,
  hourLabel,
  minuteLabel,
  disabled = false
}: PickerProps) {
  const [hour, minute] = value.split(':').map(Number)
  const safeHour = Number.isFinite(hour) ? clamp(hour, 0, 23) : 0
  const safeMinute = Number.isFinite(minute) ? clamp(minute, 0, 59) : 0
  /** 两列在同一帧里各自改动时，另一列必须读到最新值而不是本次渲染前的旧值 */
  const latestRef = useRef(value)
  latestRef.current = value
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 两列各自的步进函数；滚轮按「指针在哪一列」分派 */
  const hourStepRef = useRef<((delta: number) => void) | null>(null)
  const minuteStepRef = useRef<((delta: number) => void) | null>(null)

  const cancelBlurTimer = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
  }

  /** 点外部即收起：用捕获阶段监听，任何父级 stopPropagation 都拦不住 */
  useEffect(() => {
    if (!expanded) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [expanded])

  useEffect(() => () => cancelBlurTimer(), [])

  /** 焦点离开整组才收起；滚轮滚完光标仍在列上时给一点宽限，不打断连续调整 */
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null
    if (next && rootRef.current?.contains(next)) return
    cancelBlurTimer()
    blurTimerRef.current = setTimeout(() => setExpanded(false), BLUR_GRACE_MS)
  }

  /**
   * 展开期间锁住祖先滚动容器。
   *
   * preventDefault 在合成器线程上并非总能拦住页面滚动（实测无头 Chromium 会照滚），
   * 所以再加一道硬保证：展开时把最近的可滚动祖先临时置为 overflow:hidden，
   * 收起时原样还原。项目全局隐藏滚动条，因此锁定不会引起任何布局跳动。
   */
  useEffect(() => {
    const root = rootRef.current
    if (!expanded || !root) return
    const locked: Array<{ el: HTMLElement; overflow: string; overscroll: string }> = []
    let node: HTMLElement | null = root.parentElement
    while (node) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY)) {
        locked.push({
          el: node,
          overflow: node.style.overflowY,
          overscroll: node.style.overscrollBehavior
        })
        node.style.overflowY = 'hidden'
        node.style.overscrollBehavior = 'contain'
      }
      node = node.parentElement
    }
    return () => {
      for (const item of locked) {
        item.el.style.overflowY = item.overflow
        item.el.style.overscrollBehavior = item.overscroll
      }
    }
  }, [expanded])

  /**
   * 滚轮监听挂在组容器上并用 passive:false 拦下默认滚动。
   *
   * 这样做的原因：设置弹窗本身是可滚动的，若只拦在列内，指针一旦偏出列几个像素
   * （列只有 40px 宽），滚轮就会去滚整个设置页。挂在组上能保证「指针在时间控件内
   * 就只改时间、页面绝不跟着动」。
   * 不是所有时候都吃滚轮：收起态还没聚焦时放行，避免悬停即改值。
   */
  useEffect(() => {
    const root = rootRef.current
    if (!root || disabled) return
    let acc = 0
    function onWheel(event: WheelEvent) {
      if (event.ctrlKey) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      // 必须「先点一下」才接管滚轮：只是把鼠标滑过控件时，滚轮属于页面，
      // 否则用户想往下翻设置页，却在路过时间控件时把时间悄悄改了（D-20261126-120）。
      if (!expanded) return
      // 监听挂在控件根节点上，滚轮只在指针位于控件之上时才会到这里，
      // 因此无需再做几何判断（展开后的浮层也是它的子节点）。
      event.preventDefault()
      const rect = root?.getBoundingClientRect()
      const minuteCol = root?.querySelectorAll('.tw-col')[1]
      const target = event.target as Node | null
      const minute = !!minuteCol && !!target && minuteCol.contains(target)
      // 指针在两列之间的冒号 / 内边距上时，就近归到分钟列（右半边）
      const inMinuteHalf =
        rect && rect.width > 0 ? event.clientX >= rect.left + rect.width / 2 : false
      const step = minute || inMinuteHalf ? minuteStepRef.current : hourStepRef.current
      if (!step) return
      const row = DEFAULT_ROW
      const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY
      if (Math.abs(delta) >= 40) {
        acc = 0
        const perNotch = Math.max(1, Math.round(Math.abs(delta) / 120))
        step(delta > 0 ? perNotch : -perNotch)
        return
      }
      acc += delta
      if (Math.abs(acc) < row) return
      const dir = acc > 0 ? 1 : -1
      acc -= dir * row
      step(dir)
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [disabled, expanded])

  const commit = (nextHour: number, nextMinute: number) =>
    onChange(`${pad2(nextHour)}:${pad2(nextMinute)}`)

  return (
    <div
      ref={rootRef}
      className={`tw${disabled ? ' is-disabled' : ''}${expanded ? ' is-open' : ''}`}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={() => {
        cancelBlurTimer()
        if (!disabled) setExpanded(true)
      }}
      onFocus={() => {
        cancelBlurTimer()
        if (!disabled) setExpanded(true)
      }}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        cancelBlurTimer()
        setExpanded(false)
      }}
    >
      {/* 尺寸占位：浮层是绝对定位，这里用一份看不见的同尺寸文本撑出常态宽高，
          让 .tw 在页面里始终只占「一行时间」的空间 */}
      <span className="tw-sizer" aria-hidden="true">
        <span>88</span>
        <span>:</span>
        <span>88</span>
      </span>
      {/* 浮层：常态一行高，展开时以中心行为锚点上下各长一行，
          绝对定位所以不参与设置页的布局，页面不会因此被推高或跳动 */}
      <div className="tw-panel">
        <div className="tw-band" aria-hidden="true" />
        <TimeWheelColumn
          count={24}
          value={safeHour}
          expanded={expanded}
          disabled={disabled}
          registerStep={(step) => {
            hourStepRef.current = step
          }}
          ariaLabel={hourLabel}
          onChange={(next) => {
            const [, m] = latestRef.current.split(':').map(Number)
            commit(next, Number.isFinite(m) ? m : 0)
          }}
        />
        <span className="tw-colon" aria-hidden="true">
          :
        </span>
        <TimeWheelColumn
          count={60}
          value={safeMinute}
          expanded={expanded}
          disabled={disabled}
          registerStep={(step) => {
            minuteStepRef.current = step
          }}
          ariaLabel={minuteLabel}
          onChange={(next) => {
            const [h] = latestRef.current.split(':').map(Number)
            commit(Number.isFinite(h) ? h : 0, next)
          }}
        />
      </div>
    </div>
  )
}
