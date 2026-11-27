import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { PET_COLORS } from '../../pet/types'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}

/** 桌宠设置分组（D-20261124-091/094/098；D-20261127-125 只保留积木桌宠）。 */
export function PetSettingsGroup({ settings, t, onUpdateSettings }: Props) {
  return (
    <div id="pet-settings">
      <Group title={t.settings.petGroupTitle} collapsible defaultOpen>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t.settings.petLabel}</label>
          <div className="seg">
            <button
              className={settings.enablePet === true ? 'active' : ''}
              onClick={() => onUpdateSettings({ enablePet: true })}
            >
              {t.settings.petOn}
            </button>
            <button
              className={settings.enablePet !== true ? 'active' : ''}
              onClick={() => onUpdateSettings({ enablePet: false })}
            >
              {t.settings.petOff}
            </button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {t.settings.petHint}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t.settings.petSizeLabel}</label>
          <div className="seg">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                className={(settings.petSize ?? 'medium') === size ? 'active' : ''}
                onClick={() => onUpdateSettings({ petSize: size })}
              >
                {size === 'small'
                  ? t.settings.petSizeSmall
                  : size === 'large'
                    ? t.settings.petSizeLarge
                    : t.settings.petSizeMedium}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t.settings.petColorLabel}</label>
          {/* D-20261126-114：色板改为等分网格铺满行宽；材质色扩到 11 个，
              与「跟随主题」凑成两行六列，不再让右侧空出一条不齐的尾巴。 */}
          <div
            className="settings-swatch-grid"
            style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
          >
            <button
              type="button"
              className={`btn ghost${!settings.petColor ? ' active' : ''}`}
              aria-pressed={!settings.petColor}
              style={{
                minWidth: 0,
                padding: 0,
                fontSize: 'var(--fs-caption)',
                borderColor: !settings.petColor ? 'var(--ink)' : undefined
              }}
              onClick={() => onUpdateSettings({ petColor: undefined })}
            >
              {t.settings.petColorTheme}
            </button>
            {PET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="settings-swatch"
                aria-label={color}
                aria-pressed={settings.petColor === color}
                title={color}
                onClick={() => onUpdateSettings({ petColor: color })}
                style={{
                  background: color,
                  border:
                    settings.petColor === color ? '2px solid var(--ink)' : '1px solid var(--line)'
                }}
              />
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t.settings.petRoamLabel}</label>
          <div className="seg">
            <button
              className={settings.petRoam !== false ? 'active' : ''}
              onClick={() => onUpdateSettings({ petRoam: true })}
            >
              {t.settings.petRoamOn}
            </button>
            <button
              className={settings.petRoam === false ? 'active' : ''}
              onClick={() => onUpdateSettings({ petRoam: false })}
            >
              {t.settings.petRoamOff}
            </button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {t.settings.petRoamHint}
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {t.settings.petRightClickHint}
          </div>
        </div>
      </Group>
    </div>
  )
}
