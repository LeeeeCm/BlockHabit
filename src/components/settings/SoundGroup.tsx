import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { Group } from './Group'

interface Props {
  muted: boolean
  volume: number
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}

/** 声音分组（默认折叠）：音效开关与主音量。 */
export function SoundGroup({ muted, volume, t, onUpdateSettings }: Props) {
  return (
    <Group title={t.settings.soundGroupTitle} collapsible defaultOpen={false}>
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
    </Group>
  )
}
