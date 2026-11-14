import type { Habit } from '../../types'
import { MINI_PRESETS, type MiniSize } from '../../platform/miniWindow'
import { getBlueprintName, useI18n } from '../../i18n'
import { IconCheck } from '../Icons'

interface MiniFooterProps {
  size: MiniSize
  blueprintId: string
  placedCount: number
  total: number
  percent: number
  remaining: number
  activeHabitCount: number
  doneCount: number
  pendingHabits: Habit[]
  onQuickCheckIn: (habitId: string, habitName: string) => void
}

/** 底部：按尺寸档切换信息密度（进度条 + 今日清单 / 快捷打卡胶囊） */
export function MiniFooter({
  size,
  blueprintId,
  placedCount,
  total,
  percent,
  remaining,
  activeHabitCount,
  doneCount,
  pendingHabits,
  onQuickCheckIn
}: MiniFooterProps) {
  const { lang, t } = useI18n()
  const preset = MINI_PRESETS[size]
  const compact = size === 'pocket'
  return (
    <div
      style={{
        padding: compact ? '5px 8px 7px' : '8px 12px 10px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--fs-caption)',
          marginBottom: 4
        }}
      >
        {!compact && (
          <span
            style={{
              fontWeight: 600,
              color: 'var(--ink)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {getBlueprintName(blueprintId, lang)}
          </span>
        )}
        <span style={{ color: 'var(--ink-2)', flexShrink: 0, marginLeft: compact ? 'auto' : 0 }}>
          {preset.showProgressText
            ? placedCount + '/' + total + ' (' + percent + '%)'
            : t.mini.nextMilestone(getBlueprintName(blueprintId, lang), remaining)}
        </span>
      </div>

      <div
        style={{
          height: 3,
          background: 'var(--line)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: compact ? 5 : 8
        }}
      >
        <div
          style={{
            width: percent + '%',
            height: '100%',
            background: placedCount >= total ? 'var(--progress-green)' : 'var(--ink)',
            borderRadius: 999,
            transition: 'width var(--dur-lg) var(--ease-default)'
          }}
        />
      </div>

      {preset.showTodayList ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 96,
            overflowY: 'auto'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              marginBottom: 2
            }}
          >
            <span>{t.mini.todayLabel}</span>
            <span>
              {doneCount}/{activeHabitCount}
            </span>
          </div>
          {pendingHabits.length > 0 ? (
            pendingHabits.map((h) => (
              <button
                key={h.id}
                onClick={() => onQuickCheckIn(h.id, h.name)}
                title={t.mini.habitCheckInTip(h.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '4px 6px',
                  minHeight: 32,
                  borderRadius: 'var(--r-sm)',
                  background: 'transparent',
                  color: 'var(--ink)',
                  fontSize: 'var(--fs-caption)',
                  textAlign: 'left'
                }}
              >
                <IconCheck
                  size={12}
                  style={{ color: 'var(--ink-3, var(--ink-2))', flexShrink: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {h.name}
                </span>
              </button>
            ))
          ) : (
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--progress-green)',
                fontWeight: 600,
                padding: '2px 0'
              }}
            >
              {t.mini.allDone}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pendingHabits.length > 0 ? (
            pendingHabits.map((h) => (
              <button
                key={h.id}
                className="pill-action"
                style={{
                  fontSize: 'var(--fs-caption)',
                  padding: '4px 10px',
                  minHeight: 32,
                  background: 'color-mix(in srgb, var(--ink) 8%, transparent)'
                }}
                onClick={() => onQuickCheckIn(h.id, h.name)}
                title={t.mini.habitCheckInTip(h.name)}
              >
                {h.name}
              </button>
            ))
          ) : (
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--progress-green)',
                fontWeight: 600,
                padding: '2px 0'
              }}
            >
              {t.mini.allDone}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
