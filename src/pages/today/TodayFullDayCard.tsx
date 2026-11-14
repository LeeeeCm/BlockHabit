import { useI18n } from '../../i18n'
import { IconCheck, IconSparkle } from '../../components/Icons'
import { triggerHaptic } from '../../platform'

interface Props {
  claimed: boolean
  onClaim: () => void
  onCelebrate?: () => void
}

/** 每日全勤卡：全部习惯达标后领取额外积木；已领取则展示完成态。 */
export function TodayFullDayCard({ claimed, onClaim, onCelebrate }: Props) {
  const { t } = useI18n()
  return (
    <div
      className="card"
      style={{
        padding: '14px 18px',
        margin: '14px 0 16px',
        borderRadius: 'var(--r-md)',
        background: 'color-mix(in srgb, var(--accent) 7%, var(--surface))',
        border: '1.5px solid color-mix(in srgb, var(--accent) 45%, var(--line))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        animation: 'pop-in var(--dur-md) var(--ease-bounce)'
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--fs-subhead)',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <IconCheck
            size={16}
            style={{ color: 'var(--accent)', strokeWidth: 2.2, flexShrink: 0 }}
          />
          <span>{t.today.fullCard.title}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', marginTop: 2 }}>
          {claimed ? t.today.fullCard.subtitlePlaced : t.today.fullCard.subtitlePending}
        </div>
      </div>
      {!claimed ? (
        <button
          className="btn primary"
          style={{
            padding: '6px 15px',
            fontSize: 'var(--fs-body)',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderColor: 'var(--accent)',
            flexShrink: 0
          }}
          onClick={() => {
            triggerHaptic('medium')
            onClaim()
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span>{t.today.fullCard.claimBtn}</span>
            <IconSparkle size={13} style={{ color: 'currentColor' }} />
          </span>
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-small)',
              color: 'var(--progress-green)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IconCheck size={14} />
            <span>{t.today.fullCard.claimed}</span>
          </span>
          {onCelebrate && (
            <button
              className="btn ghost"
              style={{ padding: '5px 12px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
              onClick={() => {
                triggerHaptic('selection')
                onCelebrate()
              }}
            >
              {t.todayBrief.viewBuild}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
