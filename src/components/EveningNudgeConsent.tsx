import { useI18n } from '../i18n'
import { IconBulb } from './Icons'

/**
 * 晚间收尾提醒的一次性授权卡（D-20261110-055）。
 * 只在用户完成过打卡后出现一次；开启/拒绝都写 localStorage，不再打扰。
 */
export function EveningNudgeConsent({
  time = '21:00',
  onEnable,
  onDecline
}: {
  time?: string
  onEnable: () => void
  onDecline: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      style={{
        margin: '10px 0 6px',
        padding: '12px 16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', gap: 8, flex: '1 1 240px', minWidth: 0 }}>
        <IconBulb size={16} style={{ color: 'var(--ink-2)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>
            {t.eveningNudge.consentTitle}
          </div>
          <div
            style={{
              fontSize: 'var(--fs-small)',
              color: 'var(--ink-2)',
              marginTop: 2,
              lineHeight: 1.5
            }}
          >
            {t.eveningNudge.consentBody(time)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          className="btn primary"
          onClick={onEnable}
          style={{ padding: '6px 14px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
        >
          {t.eveningNudge.consentEnable}
        </button>
        <button
          className="btn ghost"
          onClick={onDecline}
          style={{ padding: '6px 14px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
        >
          {t.eveningNudge.consentLater}
        </button>
      </div>
    </div>
  )
}
