import type { TranslationSchema } from '../../i18n'
import type { CheckIn, MicroMood } from '../../types'
import { IconMood, IconMoodCustom, IconNote, IconPlus, IconStar } from '../Icons'

interface Props {
  t: TranslationSchema
  todayCheckIn: CheckIn | undefined
  editingNote: boolean
  noteVal: string
  moodVal: MicroMood | undefined
  moodNoteVal: string | undefined
  starVal: boolean
  onStartEdit: () => void
  onToggleMood: (m: MicroMood) => void
  onToggleStar: () => void
  /** 打开心境选择弹窗（D-20261126-118） */
  onOpenMoodPicker: () => void
  onNoteChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onNoteKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onCommit: () => void
  onStopCardClick: (e: React.MouseEvent) => void
}

/**
 * 已完成卡片底部：随笔 / 心境 / 收藏的展示与就地编辑。
 *
 * 编辑态的排布（D-20261126-118，按用户标注重排）：
 * `[★ 收藏] [心境胶囊…×4] [+]` 一行，`[输入框 ————————][完成]` 一行。
 * - ★ 收进心境选项行、固定在最左，样式与「平静」一致的倒角方块；
 * - 行尾的 `+` 打开心境选择弹窗；
 * - 输入框吃掉剩余宽度，「完成」是明确的短按钮，二者同高不同宽。
 */
export function HabitReflectionSection({
  t,
  todayCheckIn,
  editingNote,
  noteVal,
  moodVal,
  moodNoteVal,
  starVal,
  onStartEdit,
  onToggleMood,
  onToggleStar,
  onOpenMoodPicker,
  onNoteChange,
  onNoteKeyDown,
  onCommit,
  onStopCardClick
}: Props) {
  /** 摘要态展示的心境名字：自定义优先，其次预设 */
  const moodText = moodNoteVal?.trim() ? moodNoteVal.trim() : moodVal ? t.microMood[moodVal] : ''
  const hasReflection = Boolean(todayCheckIn?.note || todayCheckIn?.mood || moodNoteVal)

  return (
    <div style={{ marginTop: 8 }} onClick={onStopCardClick}>
      {editingNote ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* ★ 收藏：与「平静」同一倒角方块，固定在最左 */}
            <button
              type="button"
              className={`star-toggle-btn${starVal ? ' starred' : ''}`}
              onClick={onToggleStar}
              title={starVal ? t.reflections.unstarTooltip : t.reflections.starTooltip}
              aria-pressed={starVal}
            >
              <IconStar size={13} filled={starVal} />
            </button>
            <div className="micro-mood-group" style={{ gap: 6 }}>
              {/* 快选 4 个；若当前是弹窗里选的其它预设（感恩/专注/疲惫/自豪），
                  也把它显示成一个选中的胶囊，否则会「选了却看不见」*/}
              {(() => {
                const quick: MicroMood[] = ['energetic', 'hard', 'spark', 'calm']
                const extra = moodVal && !quick.includes(moodVal) ? moodVal : null
                return extra ? (
                  <button
                    type="button"
                    className="micro-mood-chip active"
                    onClick={() => onToggleMood(extra)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconMood mood={extra} size={12} style={{ flexShrink: 0 }} />
                    <span>{t.microMood[extra]}</span>
                  </button>
                ) : null
              })()}
              {(['energetic', 'hard', 'spark', 'calm'] as MicroMood[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`micro-mood-chip${moodVal === m && !moodNoteVal ? ' active' : ''}`}
                  onClick={() => onToggleMood(m)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <IconMood mood={m} size={12} style={{ flexShrink: 0 }} />
                  <span>{t.microMood[m]}</span>
                </button>
              ))}
            </div>
            {/* + 自定义心境：与心境胶囊同尺寸的倒角方块 */}
            <button
              type="button"
              className={`star-toggle-btn${moodNoteVal ? ' starred' : ''}`}
              onClick={onOpenMoodPicker}
              title={t.moodDialog.title}
              aria-label={t.moodDialog.title}
            >
              <IconPlus size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <input
              type="text"
              autoFocus
              className="micro-note-input"
              style={{ flex: 1, minWidth: 0, marginTop: 0 }}
              value={noteVal}
              placeholder={t.reflections.engravePlaceholder}
              onChange={onNoteChange}
              onKeyDown={onNoteKeyDown}
            />
            <button
              type="button"
              className="pill-action"
              onClick={onCommit}
              style={{ flex: '0 0 auto', padding: '0 12px', fontSize: 'var(--fs-caption)' }}
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
            color: hasReflection ? 'var(--ink)' : 'var(--ink-2)',
            opacity: hasReflection ? 0.95 : 0.6,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 6px',
            borderRadius: 'var(--r-sm)',
            background: hasReflection
              ? 'color-mix(in srgb, var(--ink) 3%, transparent)'
              : 'transparent'
          }}
          title={t.reflections.brickInspectEditHint}
        >
          {todayCheckIn?.starred && (
            <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          {moodText && (
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
              {moodNoteVal?.trim() ? (
                <IconMoodCustom size={11} style={{ flexShrink: 0 }} />
              ) : (
                <IconMood mood={moodVal as MicroMood} size={11} style={{ flexShrink: 0 }} />
              )}
              <span>{moodText}</span>
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
