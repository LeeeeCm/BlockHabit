import type { CheckIn, Habit, MicroMood } from '../../types'
import type { TranslationSchema } from '../../i18n/types'
import { IconExport, IconMood, IconMoodCustom, IconStar } from '../../components/Icons'
import { SelectMenu } from '../../components/SelectMenu'
import { MOOD_PRESETS } from '../../components/MoodPickerDialog'
import { triggerHaptic } from '../../platform'

interface Props {
  t: TranslationSchema
  habits: Habit[]
  items: CheckIn[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  filterHabitId: string
  onFilterHabitIdChange: (value: string) => void
  filterMood: string
  onFilterMoodChange: (value: string) => void
  onlyStarred: boolean
  onToggleOnlyStarred: () => void
  visibleCount: number
  onLoadMore: () => void
  onExportMarkdown: () => void
  onToggleStar: (checkInId: string) => void
}

/** 手账长廊视图：检索/筛选栏 + 随笔卡片流 + 加载更多 */
export function StatsChronicleView({
  t,
  habits,
  items,
  searchQuery,
  onSearchQueryChange,
  filterHabitId,
  onFilterHabitIdChange,
  filterMood,
  onFilterMoodChange,
  onlyStarred,
  onToggleOnlyStarred,
  visibleCount,
  onLoadMore,
  onExportMarkdown,
  onToggleStar
}: Props) {
  return (
    <div>
      {/* 筛选与检索栏 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '12px 14px',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t.reflections.searchPlaceholder}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)',
              background: 'color-mix(in srgb, var(--ink) 2%, transparent)',
              fontSize: 'var(--fs-body)',
              color: 'var(--ink)',
              outline: 'none'
            }}
          />
          <button
            className="btn ghost"
            onClick={onExportMarkdown}
            style={{
              fontSize: 'var(--fs-small)',
              padding: '7px 12px',
              borderRadius: 'var(--r-sm)',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
            title={t.reflections.exportMarkdown}
          >
            <IconExport size={13} style={{ flexShrink: 0 }} />
            <span>{t.stats.exportMd}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SelectMenu
            ariaLabel={t.stats.filterByHabit}
            value={filterHabitId}
            onChange={onFilterHabitIdChange}
            options={[
              { value: 'all', label: t.reflections.filterAll },
              ...habits.map((h) => ({ value: h.id, label: h.name }))
            ]}
            style={{ minWidth: 132 }}
          />

          <div className="micro-mood-group">
            <button
              type="button"
              className={`micro-mood-chip${filterMood === 'all' ? ' active' : ''}`}
              onClick={() => onFilterMoodChange('all')}
            >
              {t.stats.allMoods}
            </button>
            {MOOD_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`micro-mood-chip${filterMood === m ? ' active' : ''}`}
                onClick={() => onFilterMoodChange(filterMood === m ? 'all' : m)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <IconMood mood={m} size={13} style={{ flexShrink: 0 }} />
                <span>{t.microMood[m]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`pill-action${onlyStarred ? ' active' : ''}`}
            style={{
              fontSize: 'var(--fs-small)',
              padding: '3px 10px',
              color: onlyStarred ? 'var(--accent)' : 'var(--ink-2)',
              background: onlyStarred
                ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                : undefined
            }}
            onClick={() => {
              triggerHaptic('selection')
              onToggleOnlyStarred()
            }}
          >
            <IconStar
              size={12}
              filled={onlyStarred}
              style={{ color: onlyStarred ? 'var(--accent)' : 'currentColor' }}
            />
            <span>{t.reflections.onlyStarred}</span>
          </button>
        </div>
      </div>

      {/* 列表流 */}
      {items.length === 0 ? (
        <div
          style={{
            color: 'var(--ink-2)',
            fontSize: 'var(--fs-body)',
            textAlign: 'center',
            padding: '36px 0'
          }}
        >
          {t.reflections.emptyChronicle}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.slice(0, visibleCount).map((item) => {
              const h = habits.find((x) => x.id === item.habitId)
              return (
                <div key={item.id} className="chronicle-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 'var(--fs-small)',
                          fontWeight: 700,
                          color: 'var(--ink)'
                        }}
                      >
                        {item.date}
                      </span>
                      <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                        【{h?.name || '—'}】
                      </span>
                      {item.actualMinutes && (
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
                          · {t.stats.metric.minutes(item.actualMinutes)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(item.moodNote?.trim() || item.mood) && (
                        <span
                          style={{
                            fontSize: 'var(--fs-caption)',
                            padding: '2px 8px',
                            borderRadius: 'var(--r-xs)',
                            background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                            color: 'var(--ink)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {item.moodNote?.trim() ? (
                            <IconMoodCustom size={11} style={{ flexShrink: 0 }} />
                          ) : (
                            <IconMood
                              mood={item.mood as MicroMood}
                              size={11}
                              style={{ flexShrink: 0 }}
                            />
                          )}
                          <span>
                            {item.moodNote?.trim() || t.microMood[item.mood as MicroMood]}
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        className={`star-toggle-btn${item.starred ? ' starred' : ''}`}
                        style={{ padding: '3px 7px' }}
                        onClick={() => {
                          triggerHaptic('selection')
                          onToggleStar(item.id)
                        }}
                      >
                        <IconStar size={13} filled={item.starred} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--ink)',
                      lineHeight: 1.55
                    }}
                  >
                    “{item.note}”
                  </div>
                </div>
              )
            })}
          </div>
          {items.length > visibleCount && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="pill-action"
                style={{ padding: '7px 20px', fontSize: 'var(--fs-small)' }}
                onClick={() => {
                  triggerHaptic('light')
                  onLoadMore()
                }}
              >
                {t.stats.loadMoreReflections(visibleCount, items.length)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
