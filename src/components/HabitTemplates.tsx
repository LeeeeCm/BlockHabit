import { useI18n } from '../i18n'
import { habitTemplates, type HabitTemplate } from '../logic/habitTemplates'
import { IconPlus } from './Icons'

/**
 * 首启模板（D-20261110-053）：点一下创建真实习惯，替代「打开长表单」作为第一次的默认路径。
 * 只是快捷入口，完整表单仍在下方按钮；不预填、不演示。
 */
export function HabitTemplates({ onPick }: { onPick: (template: HabitTemplate) => void }) {
  const { t } = useI18n()
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: 460,
        marginTop: 8
      }}
    >
      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
        {t.templates.title}
      </span>
      {habitTemplates.map((template) => (
        <button
          key={template.id}
          className="pill-action"
          onClick={() => onPick(template)}
          style={{ fontSize: 'var(--fs-small)', padding: '4px 11px' }}
          title={t.templates.hint}
        >
          <IconPlus size={11} style={{ marginRight: 3 }} />
          {t.templates[template.id]}
        </button>
      ))}
    </div>
  )
}
