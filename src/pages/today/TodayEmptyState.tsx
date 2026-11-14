import { HabitTemplates } from '../../components/HabitTemplates'
import { getBlueprintName, useI18n } from '../../i18n'
import { IconPlus, IconToday } from '../../components/Icons'
import { triggerHaptic } from '../../platform'
import type { HabitTemplate } from '../../logic/habitTemplates'

interface Props {
  blueprintId: string
  onTemplatePick: (template: HabitTemplate) => void
  onNewHabit: () => void
  onGoBuild?: () => void
}

/** 空态：首启三步引导 + 模板快捷入口 + 新建/去建造页两个出口。 */
export function TodayEmptyState({ blueprintId, onTemplatePick, onNewHabit, onGoBuild }: Props) {
  const { lang, t } = useI18n()
  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderRadius: 'var(--r-lg)',
        background: 'color-mix(in srgb, var(--surface) 96%, var(--ink))',
        border: '1px dashed var(--line)'
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          marginBottom: 2
        }}
      >
        <IconToday size={24} />
      </div>
      <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--ink)' }}>
        {t.today.startJourney}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-body)',
          color: 'var(--ink-2)',
          maxWidth: 380,
          lineHeight: 1.6,
          whiteSpace: 'pre-line'
        }}
      >
        {t.today.emptyHint(getBlueprintName(blueprintId, lang))}
      </div>
      {/* F1 首启三步引导：把「打卡 → 掉积木 → 拼成作品」这条主线讲清楚 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          maxWidth: 420,
          marginTop: 6,
          textAlign: 'left'
        }}
      >
        {[
          { n: '01', title: t.today.onboardingStep1Title, body: t.today.onboardingStep1Body },
          { n: '02', title: t.today.onboardingStep2Title, body: t.today.onboardingStep2Body },
          { n: '03', title: t.today.onboardingStep3Title, body: t.today.onboardingStep3Body }
        ].map((step) => (
          <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span
              style={{
                fontFamily: "'Rubik', sans-serif",
                fontWeight: 700,
                fontSize: 'var(--fs-caption)',
                letterSpacing: 0.5,
                color: 'var(--ink-2)',
                marginTop: 3,
                minWidth: 18
              }}
            >
              {step.n}
            </span>
            <div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>
                {step.title}
              </div>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {step.body}
              </div>
            </div>
          </div>
        ))}
      </div>
      <HabitTemplates onPick={onTemplatePick} />
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 10,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}
      >
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
        {onGoBuild && (
          <button
            className="btn ghost"
            style={{ padding: '8px 18px', borderRadius: 999, fontSize: 'var(--fs-body)' }}
            onClick={() => {
              triggerHaptic('selection')
              onGoBuild?.()
            }}
          >
            {t.today.onboardingSeeBuild}
          </button>
        )}
      </div>
    </div>
  )
}
