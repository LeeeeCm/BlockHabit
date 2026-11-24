import type { TranslationSchema } from '../../i18n'
import { fmtRemaining } from './helpers'

interface Props {
  t: TranslationSchema
  isMobile: boolean
  /** 卡片已达标（如周配额满）：只保留取消计时的入口，不再显示完成按钮 */
  done: boolean
  running: boolean
  ended: boolean
  showFocusStart: boolean
  showEarlyConfirm: boolean
  remainingMs: number
  actualMinutes: number
  progressRatio: number
  targetMinutes: number
  onCompleteEarly: (e: React.MouseEvent) => void
  onToggleEarlyConfirm: (e: React.MouseEvent) => void
  onCancelTimer: (e: React.MouseEvent) => void
  onConfirmEarly: () => void
  onCancelEarlyConfirm: () => void
  onEndedComplete: (e: React.MouseEvent) => void
  onStartFocus: (e: React.MouseEvent) => void
  onStopCardClick: (e: React.MouseEvent) => void
}

/** 专注习惯的三种展示态：进行中（含提前结束确认）、到点待确认、未开始入口。 */
export function HabitFocusSection({
  t,
  isMobile,
  done,
  running,
  ended,
  showFocusStart,
  showEarlyConfirm,
  remainingMs,
  actualMinutes,
  progressRatio,
  targetMinutes,
  onCompleteEarly,
  onToggleEarlyConfirm,
  onCancelTimer,
  onConfirmEarly,
  onCancelEarlyConfirm,
  onEndedComplete,
  onStartFocus,
  onStopCardClick
}: Props) {
  return (
    <>
      {running && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                className="big-num"
                style={{
                  fontSize: 'var(--fs-display)',
                  color: 'var(--progress-blue)',
                  lineHeight: 1
                }}
              >
                {fmtRemaining(remainingMs)}
              </span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
                {t.today.focusedMinutes(actualMinutes)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {!done && progressRatio >= 0.8 ? (
                <button
                  className="pill-action success"
                  style={
                    isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined
                  }
                  onClick={onCompleteEarly}
                  title={t.today.readyToFinish}
                >
                  {t.common.complete}
                </button>
              ) : !done && progressRatio >= 0.2 ? (
                <button
                  className="pill-action"
                  style={
                    isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined
                  }
                  onClick={onToggleEarlyConfirm}
                  title={t.today.earlyFinish}
                >
                  {t.today.earlyFinish}
                </button>
              ) : null}

              <button
                className="pill-action danger"
                style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
                title={t.today.cancelTimer}
                onClick={onCancelTimer}
              >
                {t.today.cancelTimer}
              </button>
            </div>
          </div>

          {showEarlyConfirm && !done && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                borderRadius: 'var(--r-md)',
                fontSize: 'var(--fs-small)',
                animation: 'pop-in var(--dur-xs) var(--ease-out)'
              }}
              onClick={onStopCardClick}
            >
              <div style={{ color: 'var(--ink)', marginBottom: 6 }}>
                {t.today.earlyConfirmMsg(actualMinutes)}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  className="pill-action"
                  style={{
                    fontSize: 'var(--fs-caption)',
                    padding: isMobile ? '10px 14px' : '3px 10px',
                    ...(isMobile ? { minWidth: 44, minHeight: 44 } : undefined)
                  }}
                  onClick={onCancelEarlyConfirm}
                >
                  {t.common.cancel}
                </button>
                <button
                  className="pill-action success"
                  style={{
                    fontSize: 'var(--fs-caption)',
                    padding: isMobile ? '10px 14px' : '3px 10px',
                    ...(isMobile ? { minWidth: 44, minHeight: 44 } : undefined)
                  }}
                  onClick={onConfirmEarly}
                >
                  {t.today.earlyFinish}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {ended && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}
        >
          <span
            style={{ fontSize: 'var(--fs-body)', color: 'var(--progress-blue)', fontWeight: 600 }}
          >
            {t.today.timingTooltip}
          </span>
          {done ? (
            <button
              className="pill-action danger"
              onClick={onCancelTimer}
              title={t.today.cancelTimer}
              style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
            >
              {t.today.cancelTimer}
            </button>
          ) : (
            <button
              className="pill-action success"
              onClick={onEndedComplete}
              style={{
                background: 'var(--progress-green)',
                color: 'var(--surface)',
                ...(isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined)
              }}
            >
              {t.common.complete}
            </button>
          )}
        </div>
      )}
      {showFocusStart && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="pill-action"
            style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
            onClick={onStartFocus}
          >
            {t.today.focus} ({t.today.targetMinutes(targetMinutes)})
          </button>
        </div>
      )}
    </>
  )
}
