import { useId } from 'react'
import type { AppSettings, PetModel } from '../../types'
import { blueprintProgress } from '../../logic/blueprint'
import { PET_MODELS, petBlueprintId, resolvePetModel } from '../../logic/petModels'
import { useAppStore } from '../../store/appStore'
import type { TranslationSchema } from '../../i18n'
import { triggerHaptic } from '../../platform'
import { resetGuideTips } from '../../platform/guideTips'
import { MINI_SIZE_ORDER } from '../../platform/miniWindow'
import { DiagnosticsExportPanel } from '../ArchiveDataPanel'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  isMobile: boolean
  t: TranslationSchema
  defaultOpen?: boolean
  onOpenPetBlueprints?: () => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onToast: (message: string, durationMs?: number) => void
}

/**
 * 实验室分组（默认折叠）：时段光照 / 温和风化 / 生态彩蛋 / 透视考古等视觉开关，
 * 敲击音色、移动端陀螺仪或桌面端迷你摆件、诊断包导出与页面提示重置。
 */
export function LabGroup({
  settings,
  isMobile,
  t,
  defaultOpen = false,
  onUpdateSettings,
  onOpenPetBlueprints,
  onToast
}: Props) {
  return (
    <Group title={t.settings.labTitle} collapsible defaultOpen={defaultOpen}>
      {!isMobile && (
        <PetModelPicker
          choice={settings.petModel}
          t={t}
          onUpdateSettings={onUpdateSettings}
          onOpenPetBlueprints={onOpenPetBlueprints}
        />
      )}
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
      ) : (
        <>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t.settings.miniWidgetLabel}</label>
            <div className="seg">
              <button
                type="button"
                className={Boolean(settings.enableMiniWidget) ? 'active' : ''}
                onClick={() => {
                  triggerHaptic('selection')
                  onUpdateSettings({ enableMiniWidget: true })
                }}
              >
                {t.settings.miniWidgetOn}
              </button>
              <button
                type="button"
                className={!settings.enableMiniWidget ? 'active' : ''}
                onClick={() => {
                  triggerHaptic('selection')
                  onUpdateSettings({ enableMiniWidget: false })
                }}
              >
                {t.settings.miniWidgetOff}
              </button>
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
              {t.settings.miniWidgetHint}
            </div>
          </div>

          {/* D-20261110-059：三档尺寸 + 置顶 */}
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label>{t.settings.miniSizeLabel}</label>
            <div className="seg">
              {MINI_SIZE_ORDER.map((size) => {
                const label =
                  size === 'pocket'
                    ? t.settings.miniSizePocket
                    : size === 'display'
                      ? t.settings.miniSizeDisplay
                      : t.settings.miniSizeStandard
                return (
                  <button
                    key={size}
                    type="button"
                    className={(settings.miniWidgetSize ?? 'standard') === size ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      onUpdateSettings({ miniWidgetSize: size })
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
              {t.settings.miniSizeHint}
            </div>
          </div>

          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label>{t.settings.miniAlwaysOnTopLabel}</label>
            <div className="seg">
              <button
                type="button"
                className={settings.miniWidgetAlwaysOnTop === true ? 'active' : ''}
                onClick={() => {
                  triggerHaptic('selection')
                  onUpdateSettings({ miniWidgetAlwaysOnTop: true })
                }}
              >
                {t.settings.miniAlwaysOnTopOn}
              </button>
              <button
                type="button"
                className={settings.miniWidgetAlwaysOnTop !== true ? 'active' : ''}
                onClick={() => {
                  triggerHaptic('selection')
                  onUpdateSettings({ miniWidgetAlwaysOnTop: false })
                }}
              >
                {t.settings.miniAlwaysOnTopOff}
              </button>
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
              {t.settings.miniAlwaysOnTopHint}
            </div>
          </div>
        </>
      )}

      <DiagnosticsExportPanel onToast={onToast} />

      {/* D-20261110-054 页面提示：清空已读，三页首访提示重新出现一次 */}
      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>{t.guide.replayTitle}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn ghost"
            style={{ padding: '7px 16px' }}
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

interface PetModelPickerProps extends Pick<
  Props,
  't' | 'onUpdateSettings' | 'onOpenPetBlueprints'
> {
  choice: PetModel | undefined
}

function PetModelPicker({ choice, t, onUpdateSettings, onOpenPetBlueprints }: PetModelPickerProps) {
  const titleId = useId()
  const builds = useAppStore((s) => s.builds)
  const equipped = resolvePetModel(choice, builds)

  function equip(model: PetModel): void {
    // 读最新投影，以免选择按钮和同步/撤销恰在同一拍执行。
    if (resolvePetModel(model, useAppStore.getState().builds) !== model) return
    triggerHaptic('selection')
    onUpdateSettings({ petModel: model })
  }

  return (
    <section className="field" aria-labelledby={titleId}>
      <h4 id={titleId} style={{ margin: 0, fontSize: 'var(--fs-subhead)' }}>
        {t.pet.modelsTitle}
      </h4>
      {PET_MODELS.map((model) => {
        const id = petBlueprintId(model)
        const progress = id ? blueprintProgress(builds, id) : null
        const isLocked = progress !== null && !progress.complete
        const isEquipped = model === equipped
        const statusId = titleId + '-' + model
        const name = t.pet.modelNames[model]
        const count = progress ? t.build.blocksCount(progress.placed, progress.total) : ''
        const source = progress
          ? t.pet.blueprints + ' · ' + (isLocked ? t.pet.locked(count) : count)
          : ''
        const status = [isEquipped ? t.pet.equipped : '', source].filter(Boolean).join(' · ')
        return (
          <div
            key={model}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
          >
            <button
              className={`btn ${isEquipped ? 'primary' : 'ghost'}`}
              type="button"
              aria-pressed={isEquipped}
              aria-describedby={status ? statusId : undefined}
              disabled={isLocked}
              onClick={() => equip(model)}
            >
              {name}
            </button>
            {status && (
              <span id={statusId} style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)' }}>
                {status}
              </span>
            )}
            {isLocked && onOpenPetBlueprints && (
              <button
                className="btn ghost"
                type="button"
                aria-label={`${t.pet.viewBlueprints} · ${name}`}
                onClick={onOpenPetBlueprints}
              >
                {t.pet.viewBlueprints}
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
