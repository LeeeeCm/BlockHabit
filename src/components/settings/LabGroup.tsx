import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { triggerHaptic } from '../../platform'
import { resetGuideTips } from '../../platform/guideTips'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  isMobile: boolean
  t: TranslationSchema
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onToast: (message: string, durationMs?: number) => void
}

/**
 * 实验室分组（默认折叠）：时段光照 / 温和风化 / 生态彩蛋 / 透视考古等视觉开关，
 * 敲击音色、移动端陀螺仪或桌面端迷你摆件、诊断包导出与页面提示重置。
 */
export function LabGroup({ settings, isMobile, t, onUpdateSettings, onToast }: Props) {
  return (
    <Group title={t.settings.labTitle} collapsible defaultOpen={false}>
      {/* 时段感知昼夜光照 */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.ambientLightingLabel}</label>
        <div className="seg">
          <button
            type="button"
            className={settings.enableAmbientLighting !== false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableAmbientLighting: true })
            }}
          >
            {t.settings.ambientLightingOn}
          </button>
          <button
            type="button"
            className={settings.enableAmbientLighting === false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableAmbientLighting: false })
            }}
          >
            {t.settings.ambientLightingOff}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
          {t.settings.ambientLightingHint}
        </div>
      </div>

      {/* 抗断卡温和风化机制 */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.gentleDecayLabel}</label>
        <div className="seg">
          <button
            type="button"
            className={settings.enableGentleDecay !== false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableGentleDecay: true })
            }}
          >
            {t.settings.gentleDecayOn}
          </button>
          <button
            type="button"
            className={settings.enableGentleDecay === false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableGentleDecay: false })
            }}
          >
            {t.settings.gentleDecayOff}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
          {t.settings.gentleDecayHint}
        </div>
      </div>

      {/* 建筑微生态彩蛋 */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.ecoPropsLabel}</label>
        <div className="seg">
          <button
            type="button"
            className={settings.enableEcoProps !== false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableEcoProps: true })
            }}
          >
            {t.settings.ecoPropsOn}
          </button>
          <button
            type="button"
            className={settings.enableEcoProps === false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableEcoProps: false })
            }}
          >
            {t.settings.ecoPropsOff}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
          {t.settings.ecoPropsHint}
        </div>
      </div>

      {/* 透视考古默认态：接线 Build 页会话内开关的初始值 */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.xrayDefaultLabel}</label>
        <div className="seg">
          <button
            type="button"
            className={Boolean(settings.enableXRayInspection) ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableXRayInspection: true })
            }}
          >
            {t.settings.xrayDefaultOn}
          </button>
          <button
            type="button"
            className={!settings.enableXRayInspection ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ enableXRayInspection: false })
            }}
          >
            {t.settings.xrayDefaultOff}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
          {t.settings.xrayDefaultHint}
        </div>
      </div>

      {/* ASMR 敲击音色 */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.soundMaterialLabel}</label>
        <div className="seg">
          {(['classic', 'walnut', 'crystal', 'metal'] as const).map((mat) => {
            const labelMap = {
              classic: t.settings.soundMatClassic,
              walnut: t.settings.soundMatWalnut,
              crystal: t.settings.soundMatCrystal,
              metal: t.settings.soundMatMetal
            }
            const active = (settings.soundMaterial ?? 'classic') === mat
            return (
              <button
                key={mat}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => {
                  triggerHaptic('selection')
                  onUpdateSettings({ soundMaterial: mat })
                }}
              >
                {labelMap[mat]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 移动端专属陀螺仪开关 或 桌面端悬浮摆件开关 */}
      {isMobile ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t.settings.gyroscopeLabel}</label>
          <div className="seg">
            <button
              type="button"
              className={Boolean(settings.enableGyroscope) ? 'active' : ''}
              onClick={() => {
                triggerHaptic('selection')
                onUpdateSettings({ enableGyroscope: true })
              }}
            >
              {t.settings.gyroscopeOn}
            </button>
            <button
              type="button"
              className={!settings.enableGyroscope ? 'active' : ''}
              onClick={() => {
                triggerHaptic('selection')
                onUpdateSettings({ enableGyroscope: false })
              }}
            >
              {t.settings.gyroscopeOff}
            </button>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
            {t.settings.gyroscopeHint}
          </div>
        </div>
      ) : null}

      {/* D-20261110-054 页面提示：清空已读，三页首访提示重新出现一次 */}
      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>{t.guide.replayTitle}</label>
        <div className="settings-actions">
          <button
            className="btn ghost"
            onClick={() => {
              triggerHaptic('selection')
              resetGuideTips()
              onToast(t.guide.replayToast, 2400)
            }}
          >
            {t.guide.replay}
          </button>
        </div>
      </div>
    </Group>
  )
}
