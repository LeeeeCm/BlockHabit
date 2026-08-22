import type { CSSProperties } from 'react'

/** 统一积木风图标：24 网格、圆头描边、圆润造型 */

interface IconProps {
  size?: number
  style?: CSSProperties
}

function Svg({
  size = 24,
  style,
  strokeWidth = 1.9,
  children,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** 今日：单块带凸点的积木 */
export function IconToday(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10" width="15" height="9.5" rx="3" />
      <rect x="9.5" y="6" width="5" height="4" rx="1.6" />
    </Svg>
  )
}

/** 建造：叠起来的积木（塔） */
export function IconBuild(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="15" width="17" height="5" rx="2" />
      <rect x="6.5" y="9" width="11" height="5" rx="2" />
      <rect x="10" y="4.5" width="4" height="3.5" rx="1.4" />
    </Svg>
  )
}

/** 统计：圆头柱状图 */
export function IconStats(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="13" width="4" height="6.5" rx="1.6" />
      <rect x="10" y="8.5" width="4" height="11" rx="1.6" />
      <rect x="15.5" y="4.5" width="4" height="15" rx="1.6" />
    </Svg>
  )
}

/** 待办：实线圆角方框 */
export function IconTodo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="4.5" />
    </Svg>
  )
}

/** 已完成：填充圆角方块 + 对勾（勾用背景色，叠在 accent 填充上） */
export function IconDone(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="4.5" fill="currentColor" stroke="none" />
      <path d="M9.2 12.3l2.1 2.1 4-4.4" stroke="var(--bg)" strokeWidth={2.2} />
    </Svg>
  )
}

/** 未完成：虚线圆角方框 + 小叉 */
export function IconMissed(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="4.5" strokeDasharray="3.2 2.6" />
      <path d="M10 10l4 4M14 10l-4 4" />
    </Svg>
  )
}

/** 设置：圆头滑杆 */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
      <circle cx="9.5" cy="7.5" r="2.1" fill="var(--bg)" />
      <circle cx="15" cy="12" r="2.1" fill="var(--bg)" />
      <circle cx="8.5" cy="16.5" r="2.1" fill="var(--bg)" />
    </Svg>
  )
}

/** 对勾 */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 12.5l4.2 4.2L18.5 7.5" />
    </Svg>
  )
}

/** 进行中：圆角方框 + 内部半填充小方块 */
export function IconInProgress(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="4.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 恢复：圆头回转箭头 */
export function IconRestore(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 9.5a7 7 0 117 7" />
      <path d="M5.5 5v4.5H10" />
    </Svg>
  )
}

/** 编辑：圆头铅笔 */
export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.5 5.5l3 3L8 19l-4 1 1-4L15.5 5.5z" />
      <path d="M13.8 7.2l3 3" />
    </Svg>
  )
}

/** 删除：圆头垃圾桶 */
export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7h14" />
      <path d="M9.5 7V5.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5V7" />
      <path d="M7 7l1 12a1.5 1.5 0 001.5 1.5h5A1.5 1.5 0 0016 19l1-12" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Svg>
  )
}

/** 加号 */
export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  )
}

/** 每日打卡：积木 + 对勾 */
export function IconDayCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="8.5" width="14" height="10.5" rx="3.2" />
      <path d="M9 13.4l2 2 4.2-4.4" />
    </Svg>
  )
}

/** 窗口控制：最小化 */
export function IconWinMin(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.7}>
      <path d="M6 12h12" />
    </Svg>
  )
}

/** 窗口控制：最大化 */
export function IconWinMax(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.7}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
    </Svg>
  )
}

/** 窗口控制：还原（双叠层） */
export function IconWinRestore(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.7}>
      <rect x="5.5" y="8.5" width="10" height="10" rx="2.5" />
      <path d="M9 5.5h7a2.5 2.5 0 012.5 2.5v7" />
    </Svg>
  )
}

/** 窗口控制：关闭 */
export function IconWinClose(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.7}>
      <path d="M7 7l10 10M17 7L7 17" />
    </Svg>
  )
}

/** 必填标记：填充小圆角块 */
export function IconRequired() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
      <rect width="9" height="9" rx="2.6" fill="var(--accent)" />
    </svg>
  )
}

/** 选填标记：空心小圆角块 */
export function IconOptional() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
      <rect x="1" y="1" width="7" height="7" rx="2" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
    </svg>
  )
}
