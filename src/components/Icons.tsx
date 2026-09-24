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

/** 展台：底座上陈列着微缩积木模型 */
export function IconShowcase(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="17" width="18" height="3.5" rx="1.6" />
      <rect x="5" y="9" width="6" height="6.5" rx="1.8" />
      <rect x="13" y="6" width="6" height="9.5" rx="1.8" />
      <rect x="7" y="6.5" width="2" height="2" rx="0.8" />
      <rect x="15" y="3.5" width="2" height="2" rx="0.8" />
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

/** 顺时针旋转 90° */
export function IconRotateCw(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18.5 9.5a7 7 0 10-7 7" />
      <path d="M18.5 5v4.5H14" />
    </Svg>
  )
}

/** 逆时针旋转 90° */
export function IconRotateCcw(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 9.5a7 7 0 117 7" />
      <path d="M5.5 5v4.5H10" />
    </Svg>
  )
}

/** 置顶图钉：与编辑（铅笔）、删除（垃圾桶）风格完全统一的几何线条图钉 */
export function IconPin({ pinned = false, ...props }: IconProps & { pinned?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M12 15.5v5" />
      <path
        d="M7 6.5h10M9.5 6.5V4a1 1 0 011-1h3a1 1 0 011 1v2.5M7.5 6.5l1 6.5h7l1-6.5"
        fill={pinned ? 'currentColor' : 'none'}
      />
      <path d="M6 13h12" />
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

/** 随笔笔记：与编辑、删除风格一致的圆头便签线条 */
export function IconNote(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4.5" width="14" height="15" rx="3.2" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5" />
    </Svg>
  )
}

/** 画报海报：极简相框与山峦日出线条 */
export function IconPoster(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M4 15.5l5-4.5 4 3.5 3-2.5 4 3.5" />
    </Svg>
  )
}

/** 闪耀星芒：极简四角几何星芒，替代彩色 Emoji ✦ */
export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c0 4.5 4.5 9 9 9-4.5 0-9 4.5-9 9 0-4.5-4.5-9-9-9 4.5 0 9-4.5 9-9z" fill="currentColor" stroke="none" />
    </Svg>
  )
}
/** 收藏星标：五角星圆头几何轮廓与填充 */
export function IconStar({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.5l2.8 6.2 6.8.8-5 4.6 1.4 6.7L12 17.4l-6 3.4 1.4-6.7-5-4.6 6.8-.8L12 2.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** 修复积木：与今日、编辑、删除风格一致的圆头线条积木 + 内部十字标记 */
export function IconRepair(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="9.5" width="16" height="10" rx="2.8" />
      <path d="M8.5 7v2.5M15.5 7v2.5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </Svg>
  )
}

/** 历史回响：与编辑、删除风格一致的圆头时钟与回响指针 */
export function IconEcho(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v4.5l3 2" />
      <path d="M3.5 12a8.5 8.5 0 0114.5-6" />
      <path d="M18 3.5v3h-3" />
    </Svg>
  )
}

/** 建筑奠基石：与编辑、删除风格一致的建筑基石与立柱线条 */
export function IconFoundation(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8l8-4 8 4M3 20h18M4 17h16" />
      <path d="M6.5 10v7M10 10v7M14 10v7M17.5 10v7" />
    </Svg>
  )
}

/** 导出手账：与编辑、删除风格一致的圆头便签剪贴板 */
export function IconExport(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="6" width="14" height="14" rx="2.8" />
      <path d="M9 4.5h6a1 1 0 011 1v1.5H8V5.5a1 1 0 011-1z" />
      <path d="M9 11h6M9 15h4" />
    </Svg>
  )
}

/** 随机轮换：与整体风格一致的圆头交叉双向箭头 */
export function IconShuffle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 17h4l7-10h5M17 7h3v3M4 7h4l2.5 3.5M15 13.5l1.5 2.5h3.5M17 17h3v-3" />
    </Svg>
  )
}

/** 翻转相纸：与整体风格一致的圆角卡片与翻转回旋箭头 */
export function IconFlip(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="5" width="12" height="15" rx="2.5" />
      <path d="M5 8.5H3.5a1.5 1.5 0 00-1.5 1.5v7a1.5 1.5 0 001.5 1.5H12" />
      <path d="M4 6.5l-2 2 2 2" />
    </Svg>
  )
}


/** 灯泡灵感提示：圆头灯泡线条，替代彩色 Emoji 💡 */
export function IconBulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 00-4 10.5V16a1 1 0 001 1h6a1 1 0 001-1v-2.5A6 6 0 0012 3z" />
    </Svg>
  )
}

/** 相机：圆头相机线条，替代彩色 Emoji 📸 */
export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8a2 2 0 012-2h2.5l1.5-2h4l1.5 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  )
}

/** 键盘：极简圆角键盘线条，替代彩色 Emoji ⌨️ */
export function IconKeyboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M10 10h.01M14 10h.01M17 10h.01M7 13h.01M17 13h.01M10 14h4" />
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

/** 图鉴：四枚圆角小方块 */
export function IconGallery(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="2" />
      <rect x="13" y="4.5" width="6.5" height="6.5" rx="2" />
      <rect x="4.5" y="13" width="6.5" height="6.5" rx="2" />
      <rect x="13" y="13" width="6.5" height="6.5" rx="2" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 放弃：圆头圆圈叉 */
export function IconCancel(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </Svg>
  )
}

/** 迷你摆件模式（画中画/小窗） */
export function IconMiniWidget(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.8}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <rect x="11.5" y="11.5" width="7" height="7" rx="1.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 展开还原全屏主窗口 */
export function IconExpand(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={1.8}>
      <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />
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
      <rect width="9" height="9" rx="2.6" fill="var(--progress-green)" />
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
