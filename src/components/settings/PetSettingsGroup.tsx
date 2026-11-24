import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  completedCount: number
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}

/** 桌宠设置分组（D-20261124-088）：开关 / 大小 / 形象 / 是否自主走动。 */
export function PetSettingsGroup({ settings, completedCount, t, onUpdateSettings }: Props) {
  const robotUnlocked = completedCount >= 1
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
          <label>{t.settings.petSkinLabel}</label>
          <div className="seg">
            <button
              className={(settings.petSkin ?? 'block') === 'block' ? 'active' : ''}
              onClick={() => onUpdateSettings({ petSkin: 'block' })}
            >
              {t.settings.petSkinBlock}
            </button>
            <button
              className={(settings.petSkin ?? 'block') === 'robot' ? 'active' : ''}
              disabled={!robotUnlocked}
              onClick={() => onUpdateSettings({ petSkin: 'robot' })}
            >
              {t.settings.petSkinRobot}
            </button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {robotUnlocked ? t.settings.petSkinHint : t.settings.petSkinLocked(1)}
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
