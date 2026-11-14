/** 环形进度（B2）：SVG 描边进度，不用渐变/阴影，reduced-motion 下时长令牌自动归零 */
export function FocusRing({
  progress,
  size,
  label
}: {
  progress: number
  size: number
  label: string
}) {
  const stroke = size >= 64 ? 5 : 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, progress))
  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}
          style={{ transition: 'stroke-dashoffset var(--dur-lg) var(--ease-default)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size >= 64 ? 'var(--fs-small)' : 'var(--fs-caption)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink)'
        }}
      >
        {label}
      </div>
    </div>
  )
}
