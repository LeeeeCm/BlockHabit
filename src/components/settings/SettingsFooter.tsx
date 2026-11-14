import type { Habit } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { IconKeyboard, IconRepair } from '../Icons'

interface Props {
  habits: Habit[]
  completedCount: number
  repairBricks: number
  t: TranslationSchema
}

/** 设置页尾部信息区：自律资产统计、快捷键提示与品牌标语。 */
export function SettingsFooter({ habits, completedCount, repairBricks, t }: Props) {
  return (
    <>
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--bg)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          fontSize: 'var(--fs-body)',
          color: 'var(--ink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{t.settings.assetSummaryTitle}</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {t.settings.assetSummaryDetail(
              habits.filter((h) => !h.archivedAt).length,
              completedCount
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IconRepair size={13} style={{ color: 'var(--accent)' }} />
            <span>{repairBricks} / 2</span>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {t.settings.repairInventory}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
          borderRadius: 'var(--r-md)',
          fontSize: 'var(--fs-small)',
          marginBottom: 14
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: 'var(--ink)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <IconKeyboard size={14} />
          <span>{t.settings.shortcutsTitle}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
          {t.settings.shortcutsDetail}
        </div>
      </div>

      <p
        style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--ink-2)',
          margin: '0',
          textAlign: 'center',
          opacity: 0.8
        }}
      >
        {t.settings.slogan}
      </p>
    </>
  )
}
