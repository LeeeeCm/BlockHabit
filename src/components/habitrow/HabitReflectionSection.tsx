import type { TranslationSchema } from '../../i18n'
import type { CheckIn, MicroMood } from '../../types'
import { IconMood, IconNote, IconStar } from '../Icons'

interface Props {
  t: TranslationSchema
  todayCheckIn: CheckIn | undefined
  editingNote: boolean
  noteVal: string
  moodVal: MicroMood | undefined
  starVal: boolean
  onStartEdit: () => void
  onToggleMood: (m: MicroMood) => void
  onToggleStar: () => void
  onNoteChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onNoteKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onCommit: () => void
  onStopCardClick: (e: React.MouseEvent) => void
}

/** 已完成卡片底部：随笔/心情/收藏的展示与就地编辑。 */
export function HabitReflectionSection({
  t,
  todayCheckIn,
  editingNote,
  noteVal,
  moodVal,
  starVal,
  onStartEdit,
  onToggleMood,
  onToggleStar,
  onNoteChange,
  onNoteKeyDown,
  onCommit,
  onStopCardClick
}: Props) {
  return (
    <div style={{ marginTop: 8 }} onClick={onStopCardClick}>
      {editingNote ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="micro-mood-group">
              {(['energetic', 'hard', 'spark', 'calm'] as MicroMood[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`micro-mood-chip${moodVal === m ? ' active' : ''}`}
                  onClick={() => onToggleMood(m)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <IconMood mood={m} size={12} style={{ flexShrink: 0 }} />
                  <span>{t.microMood[m]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`star-toggle-btn${starVal ? ' starred' : ''}`}
              style={{ padding: '3px 8px' }}
              onClick={onToggleStar}
              title={starVal ? t.reflections.unstarTooltip : t.reflections.starTooltip}
            >
              <IconStar size={13} filled={starVal} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              autoFocus
              className="micro-note-input"
              value={noteVal}
              placeholder={t.reflections.engravePlaceholder}
              onChange={onNoteChange}
              onKeyDown={onNoteKeyDown}
            />
            <button
              type="button"
              className="pill-action"
              onClick={onCommit}
              style={{ padding: '4px 10px', fontSize: 'var(--fs-caption)' }}
            >
              {t.common.complete}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={onStartEdit}
          style={{
            fontSize: 'var(--fs-small)',
            color: todayCheckIn?.note || todayCheckIn?.mood ? 'var(--ink)' : 'var(--ink-2)',
            opacity: todayCheckIn?.note || todayCheckIn?.mood ? 0.95 : 0.6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 6px',
            borderRadius: 'var(--r-sm)',
            background:
              todayCheckIn?.note || todayCheckIn?.mood
                ? 'color-mix(in srgb, var(--ink) 3%, transparent)'
                : 'transparent'
          }}
          title={t.reflections.brickInspectEditHint}
        >
          {todayCheckIn?.starred && (
            <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          {todayCheckIn?.mood && (
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                padding: '2px 7px',
                borderRadius: 'var(--r-xs)',
                background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                color: 'var(--ink)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <IconMood mood={todayCheckIn.mood as MicroMood} size={11} style={{ flexShrink: 0 }} />
              <span>{t.microMood[todayCheckIn.mood as MicroMood]}</span>
            </span>
          )}
          <IconNote size={13} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
          <span style={{ fontStyle: todayCheckIn?.note ? 'normal' : 'italic' }}>
            {todayCheckIn?.note || t.today.addReflectionPlaceholder}
          </span>
        </div>
      )}
    </div>
  )
}
