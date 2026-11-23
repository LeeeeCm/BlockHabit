import { HabitTemplates } from '../../components/HabitTemplates'
import { useI18n } from '../../i18n'
import { IconPlus, IconToday } from '../../components/Icons'
import { triggerHaptic } from '../../platform'
import type { HabitTemplate } from '../../logic/habitTemplates'

interface Props {
  onTemplatePick: (template: HabitTemplate) => void
  onNewHabit: () => void
}

/** 空态：模板一键起步 + 新建入口。不放标语、步骤说明或引导段落。 */
export function TodayEmptyState({ onTemplatePick, onNewHabit }: Props) {
  const { t } = useI18n()
  return (
    <div
      className="card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface)',
        border: '1px dashed var(--line)'
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: 'color-mix(in srgb, var(--ink) 6%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-2)'
        }}
        aria-hidden="true"
      >
        <IconToday size={18} />
      </div>
      <HabitTemplates onPick={onTemplatePick} />
      <button
        className="btn primary"
        style={{
          padding: '8px 20px',
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--fs-body)'
        }}
        onClick={() => {
          triggerHaptic('light')
          onNewHabit()
        }}
      >
        <IconPlus size={16} />
        <span>{t.today.newHabit}</span>
      </button>
    </div>
  )
}
