interface Props {
  counterVal: number
  targetVal: number
  counterRatio: number
  done: boolean
  stepVal: number
  unit?: string
  isMobile: boolean
  onStepDown: (e: React.MouseEvent) => void
  onStepUp: (e: React.MouseEvent) => void
  onStopCardClick: (e: React.MouseEvent) => void
}

/** 计数习惯区块：进度条 + 步进增减按钮。 */
export function HabitCounterSection({
  counterVal,
  targetVal,
  counterRatio,
  done,
  stepVal,
  unit,
  isMobile,
  onStepDown,
  onStepUp,
  onStopCardClick
}: Props) {
  return (
    <div style={{ marginTop: 8 }} onClick={onStopCardClick}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 'var(--fs-small)'
        }}
      >
        <span style={{ fontWeight: 600, color: done ? 'var(--progress-green)' : 'var(--ink)' }}>
          {counterVal} / {targetVal} {unit ?? ''}
        </span>
        <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)' }}>
          {Math.round(counterRatio * 100)}%
        </span>
      </div>
      <div className="counter-track">
        <div
          className={`counter-fill${done ? ' done' : ''}`}
          style={{ width: `${Math.round(counterRatio * 100)}%` }}
        />
      </div>
      {!done && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            className="pill-action"
            disabled={counterVal <= 0}
            onClick={onStepDown}
            title={`-${stepVal} ${unit ?? ''}`}
            aria-label={`-${stepVal} ${unit ?? ''}`}
            style={{
              ...(isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : {}),
              opacity: counterVal <= 0 ? 0.4 : 1,
              cursor: counterVal <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            -{stepVal} {unit ?? ''}
          </button>
          <button
            className="pill-action success"
            onClick={onStepUp}
            title={`+${stepVal} ${unit ?? ''}`}
            aria-label={`+${stepVal} ${unit ?? ''}`}
            style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
          >
            +{stepVal} {unit ?? ''}
          </button>
        </div>
      )}
    </div>
  )
}
