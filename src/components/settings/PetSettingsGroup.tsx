import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { blueprintProgress } from '../../logic/blueprint'
import { PET_MODELS, petBlueprintId } from '../../logic/petModels'
import { PET_COLORS } from '../../pet/types'
import { useAppStore } from '../../store/appStore'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}

/** 桌宠设置分组（D-20261124-091/094/098）：开关 / 大小 / 蓝图形象 / 材质色 / 自主走动。 */
export function PetSettingsGroup({ settings, t, onUpdateSettings }: Props) {
  const builds = useAppStore((s) => s.builds)
  const currentSkin = settings.petSkin ?? settings.petModel ?? 'block'
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
            {PET_MODELS.map((model) => {
              const blueprintId = petBlueprintId(model)
              const progress = blueprintId ? blueprintProgress(builds, blueprintId) : null
              const unlocked = !progress || progress.complete
              return (
                <button
                  key={model}
                  className={currentSkin === model ? 'active' : ''}
                  disabled={!unlocked}
                  title={unlocked ? undefined : t.settings.petSkinHint}
                  onClick={() => onUpdateSettings({ petSkin: model })}
                >
                  {model === 'cat'
                    ? t.settings.petSkinCat
                    : model === 'bot'
                      ? t.settings.petSkinBot
                      : t.settings.petSkinBlock}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {t.settings.petSkinHint}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t.settings.petColorLabel}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`btn ghost${!settings.petColor ? ' active' : ''}`}
              aria-pressed={!settings.petColor}
              style={{
                minHeight: 30,
                padding: '4px 12px',
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
                aria-label={color}
                aria-pressed={settings.petColor === color}
                title={color}
                onClick={() => onUpdateSettings({ petColor: color })}
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  borderRadius: 8,
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
