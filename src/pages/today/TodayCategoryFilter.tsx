import { useI18n } from '../../i18n'
import { triggerHaptic } from '../../platform'
import type { Habit } from '../../types'

interface Props {
  categories: string[]
  activeHabits: Habit[]
  selectedCat: string | null
  onSelectAll: () => void
  onToggleCategory: (category: string) => void
}

/** 分类筛选胶囊条：点击分类切换筛选，再点一次回到全部。 */
export function TodayCategoryFilter({
  categories,
  activeHabits,
  selectedCat,
  onSelectAll,
  onToggleCategory
}: Props) {
  const { t } = useI18n()
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        margin: '14px 0 10px'
      }}
    >
      <button
        className={`pill-action${selectedCat === null ? ' success' : ''}`}
        style={{ fontSize: 'var(--fs-small)', padding: '3px 11px' }}
        onClick={() => {
          triggerHaptic('selection')
          onSelectAll()
        }}
      >
        {t.today.filterAll} · {activeHabits.length}
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          className={`pill-action${selectedCat === cat ? ' success' : ''}`}
          style={{ fontSize: 'var(--fs-small)', padding: '3px 11px' }}
          onClick={() => {
            triggerHaptic('selection')
            onToggleCategory(cat)
          }}
        >
          #{cat} · {activeHabits.filter((h) => h.category === cat).length}
        </button>
      ))}
    </div>
  )
}
