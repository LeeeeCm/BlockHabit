import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { Group } from './Group'

interface Props {
  muted: boolean
  volume: number
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  /** 作为「通用」组的子段渲染，不再单独成组 */
  bare?: boolean
}

/** 声音：音效开关与主音量。 */
export function SoundGroup({ muted, volume, t, onUpdateSettings, bare = false }: Props) {
  const content = (
    <>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.soundLabel}</label>
        <div className="seg">
          <button
            className={!muted ? 'active' : ''}
            onClick={() => onUpdateSettings({ soundMuted: false })}
          >
            {t.settings.soundOn}
          </button>
          <button
            className={muted ? 'active' : ''}
            onClick={() => onUpdateSettings({ soundMuted: true })}
          >
            {t.settings.soundOff}
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            opacity: muted ? 0.4 : 1
          }}
        >
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', flexShrink: 0 }}>
            {t.settings.volumeLabel}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            disabled={muted}
            aria-label={t.settings.volumeLabel}
            onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--ink)' }}
          />
          <span
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              width: 32,
              textAlign: 'right',
              flexShrink: 0
            }}
          >
            {volume}
          </span>
        </div>
      </div>
    </>
  )

  if (bare) {
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            fontWeight: 700,
            color: 'var(--ink-2)',
            marginBottom: 8
          }}
        >
          {t.settings.soundGroupTitle}
        </div>
        {content}
      </div>
    )
  }

  return (
    <Group title={t.settings.soundGroupTitle} collapsible defaultOpen={false}>
      {content}
    </Group>
  )
}
