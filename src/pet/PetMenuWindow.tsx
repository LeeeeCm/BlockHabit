import { useEffect, useState } from 'react'
import { emitTo, listen } from '@tauri-apps/api/event'
import { useI18n } from '../i18n'
import { DEFAULT_PET_CONFIG, PET_MODELS, type PetConfig } from './types'
import { petOpenSettings, setPetMenuVisible } from '../platform/petWindow'
import './petWindow.css'

/** 桌宠右键面板：独立透明窗，不移动桌宠本身。 */
export function PetMenuWindow() {
  const { t } = useI18n()
  const [config, setConfig] = useState<PetConfig>(DEFAULT_PET_CONFIG)

  useEffect(() => {
    let disposed = false
    const unlisten = listen<PetConfig>('pet-config', (event) => {
      if (!disposed && event.payload) setConfig(event.payload)
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void setPetMenuVisible(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      disposed = true
      window.removeEventListener('keydown', onKey)
      void unlisten.then((fn) => fn()).catch(() => {})
    }
  }, [])

  function changePref(patch: Partial<PetConfig>) {
    setConfig((current) => ({ ...current, ...patch }))
    void emitTo('main', 'pet-pref', patch).catch(() => {})
  }

  async function close() {
    await setPetMenuVisible(false)
  }

  return (
    <div className="pet-menu-window">
      <div className="pet-menu" role="dialog" aria-label={t.settings.petGroupTitle}>
        <div className="pet-menu-head">
          <strong>{t.settings.petGroupTitle}</strong>
          <button className="btn ghost" onClick={() => void close()}>
            {t.common.close}
          </button>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            void setPetMenuVisible(false).finally(() => void petOpenSettings())
          }}
        >
          {t.titlebar.settings}
        </button>
        <div className="pet-menu-label">{t.settings.petSizeLabel}</div>
        <div className="seg">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              className={config.size === size ? 'active' : ''}
              onClick={() => changePref({ size })}
            >
              {size === 'small'
                ? t.settings.petSizeSmall
                : size === 'large'
                  ? t.settings.petSizeLarge
                  : t.settings.petSizeMedium}
            </button>
          ))}
        </div>
        <div className="pet-menu-label">{t.settings.petSkinLabel}</div>
        <div className="seg">
          {PET_MODELS.map((model) => {
            const unlocked = config.unlocked?.includes(model) ?? model === 'block'
            return (
              <button
                key={model}
                className={config.skin === model ? 'active' : ''}
                disabled={!unlocked}
                title={unlocked ? undefined : t.settings.petSkinHint}
                onClick={() => changePref({ skin: model })}
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
        <div className="pet-menu-label">{t.settings.petRoamLabel}</div>
        <div className="seg">
          <button
            className={config.roam ? 'active' : ''}
            onClick={() => changePref({ roam: true })}
          >
            {t.settings.petRoamOn}
          </button>
          <button
            className={!config.roam ? 'active' : ''}
            onClick={() => changePref({ roam: false })}
          >
            {t.settings.petRoamOff}
          </button>
        </div>
      </div>
    </div>
  )
}
