import { formatRemaining, type FocusView } from '../../logic/focusSession'
import type { MiniSize } from '../../platform/miniWindow'
import type { Habit } from '../../types'
import { useI18n } from '../../i18n'
import { IconClose } from '../Icons'
import { FocusRing } from './FocusRing'

interface FocusPanelProps {
  /** 主面板会话；空时渲染 null（与拆分前 renderFocusPanel 的早退一致） */
  focusView: FocusView | null
  focusHabit: Habit | undefined
  size: MiniSize
  /** 主面板之外仍在进行/待确认的会话数 */
  otherFocusCount: number
  /** 是否还能「再等 5 分钟」（已达上限时 false） */
  canExtend: boolean
  /** 放弃二次确认态由 MiniDeskToy 持有（切换会话时重置） */
  giveUpPending: boolean
  onConfirm: () => void
  onExtend: () => void
  onRequestGiveUp: () => void
  onCancelGiveUp: () => void
  onAbandon: () => void
}

/**
 * 专注面板：口袋档纵向铺满内容区；标准/展台档占底部固定高度（三档都不裁切）。
 * 纯展示 + 回调；会话、确认态等状态仍由 MiniDeskToy 持有。
 */
export function FocusPanel({
  focusView,
  focusHabit,
  size,
  otherFocusCount,
  canExtend,
  giveUpPending,
  onConfirm,
  onExtend,
  onRequestGiveUp,
  onCancelGiveUp,
  onAbandon
}: FocusPanelProps) {
  const { t } = useI18n()
  if (!focusView || !focusHabit) return null
  const compact = size === 'pocket'
  const focusing = focusView.phase === 'focusing'
  const remainingText = formatRemaining(focusView.remainingMs)
  const ringSize = size === 'display' ? 72 : 56
  const ringLabel = focusing ? remainingText : '100%'

  if (compact) {
    return (
      <div
        data-testid="focus-panel"
        data-focus-phase={focusView.phase}
        data-other-focus={otherFocusCount}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 4,
          padding: '6px 8px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            minWidth: 0
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              color: 'var(--ink)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {focusHabit.name}
          </span>
          {/* 口袋档 ready 态纵向空间已被按钮占满：「另有 N 个专注」放进标题行，避免被挤成 0 高 */}
          {!focusing && otherFocusCount > 0 && (
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {t.focusCompanion.moreSessions(otherFocusCount)}
            </span>
          )}
          {focusing && !giveUpPending && (
            <button
              className="btn ghost"
              onClick={onRequestGiveUp}
              title={t.focusCompanion.giveUp}
              style={{
                flexShrink: 0,
                padding: '2px 6px',
                minHeight: 24,
                fontSize: 'var(--fs-caption)'
              }}
            >
              {t.focusCompanion.giveUp}
            </button>
          )}
        </div>

        {giveUpPending ? (
          <>
            <div
              style={{ fontSize: 'var(--fs-caption)', color: 'var(--danger)', lineHeight: 1.35 }}
            >
              {t.focusCompanion.giveUpConfirm}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn ghost"
                onClick={onCancelGiveUp}
                style={{
                  flex: 1,
                  minHeight: 30,
                  padding: '2px 6px',
                  fontSize: 'var(--fs-caption)'
                }}
              >
                {t.common.cancel}
              </button>
              <button
                className="btn primary"
                onClick={onAbandon}
                style={{
                  flex: 1,
                  minHeight: 30,
                  padding: '2px 6px',
                  fontSize: 'var(--fs-caption)'
                }}
              >
                {t.focusCompanion.giveUp}
              </button>
            </div>
          </>
        ) : focusing ? (
          <>
            <div
              style={{
                fontSize: 'var(--fs-hero)',
                fontWeight: 700,
                lineHeight: 1.05,
                fontFamily: "'Rubik', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink)'
              }}
            >
              {remainingText}
            </div>
            <div
              style={{
                height: 3,
                background: 'var(--line)',
                borderRadius: 999,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: Math.round(focusView.progress * 100) + '%',
                  height: '100%',
                  background: 'var(--ink)',
                  borderRadius: 999,
                  transition: 'width var(--dur-lg) var(--ease-default)'
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', lineHeight: 1.35 }}>
              {t.focusCompanion.ready}
            </div>
            <button
              className="btn primary"
              onClick={onConfirm}
              style={{
                minHeight: 30,
                padding: '2px 8px',
                fontSize: 'var(--fs-caption)',
                flexShrink: 0
              }}
            >
              {t.focusCompanion.confirmCheckIn}
            </button>
            <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
              {canExtend && (
                <button
                  className="btn ghost"
                  onClick={onExtend}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 26,
                    padding: '2px 6px',
                    fontSize: 'var(--fs-caption)'
                  }}
                >
                  {t.focusCompanion.extendFive}
                </button>
              )}
              <button
                className="btn ghost"
                onClick={onRequestGiveUp}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 26,
                  padding: '2px 6px',
                  fontSize: 'var(--fs-caption)'
                }}
              >
                {t.focusCompanion.giveUp}
              </button>
            </div>
          </>
        )}
        {/* focusing 态空间足够：副行显示「另有 N 个专注」（ready 态见标题行） */}
        {focusing && otherFocusCount > 0 && (
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t.focusCompanion.moreSessions(otherFocusCount)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="focus-panel"
      data-focus-phase={focusView.phase}
      data-other-focus={otherFocusCount}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
        padding: compact ? '5px 8px 7px' : '8px 12px 10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 0 }}>
        <FocusRing progress={focusing ? focusView.progress : 1} size={ringSize} label={ringLabel} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 'var(--fs-body)',
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {focusHabit.name}
          </span>
          <span
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {focusing ? t.focusCompanion.focusing : t.focusCompanion.ready}
          </span>
          {otherFocusCount > 0 && (
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {t.focusCompanion.moreSessions(otherFocusCount)}
            </span>
          )}
          {size === 'display' && (
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                opacity: 0.75,
                lineHeight: 1.35,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {t.focusCompanion.persistedHint}
            </span>
          )}
        </div>
        {!giveUpPending && (
          <button
            className="icon-btn"
            onClick={onRequestGiveUp}
            title={t.focusCompanion.giveUp}
            aria-label={t.focusCompanion.giveUp}
            style={{ flexShrink: 0, width: 30, height: 28, borderRadius: 7 }}
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      {giveUpPending ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: 44 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 'var(--fs-caption)',
              color: 'var(--danger)',
              lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {t.focusCompanion.giveUpConfirm}
          </span>
          <button
            className="btn ghost"
            onClick={onCancelGiveUp}
            style={{
              flexShrink: 0,
              minHeight: 32,
              padding: '2px 10px',
              fontSize: 'var(--fs-caption)'
            }}
          >
            {t.common.cancel}
          </button>
          <button
            className="btn primary"
            onClick={onAbandon}
            style={{
              flexShrink: 0,
              minHeight: 32,
              padding: '2px 10px',
              fontSize: 'var(--fs-caption)'
            }}
          >
            {t.focusCompanion.giveUp}
          </button>
        </div>
      ) : focusing ? (
        <div
          style={{
            height: 3,
            background: 'var(--line)',
            borderRadius: 999,
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: Math.round(focusView.progress * 100) + '%',
              height: '100%',
              background: 'var(--ink)',
              borderRadius: 999,
              transition: 'width var(--dur-lg) var(--ease-default)'
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, minWidth: 0, flexShrink: 0 }}>
          <button
            className="btn primary"
            onClick={onConfirm}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 32,
              padding: '2px 10px',
              fontSize: 'var(--fs-caption)'
            }}
          >
            {t.focusCompanion.confirmCheckIn}
          </button>
          {canExtend && (
            <button
              className="btn ghost"
              onClick={onExtend}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 32,
                padding: '2px 8px',
                fontSize: 'var(--fs-caption)'
              }}
            >
              {t.focusCompanion.extendFive}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
