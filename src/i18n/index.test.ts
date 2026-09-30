import { describe, it, expect } from 'vitest'
import { getBlueprintName, getTranslation, translations } from './index'
import { useAppStore } from '../store/appStore'
import { blueprintOrder } from '../logic/blueprints'

describe('i18n system', () => {
  it('provides both zh and en locales', () => {
    expect(translations.zh).toBeDefined()
    expect(translations.en).toBeDefined()
    expect(getTranslation('zh')).toBe(translations.zh)
    expect(getTranslation('en')).toBe(translations.en)
  })

  it('all 8 blueprints have distinct localized names in zh and en', () => {
    for (const id of blueprintOrder) {
      const zhName = getBlueprintName(id, 'zh')
      const enName = getBlueprintName(id, 'en')

      expect(zhName).toBeTruthy()
      expect(enName).toBeTruthy()
      expect(zhName).not.toBe(id)
      expect(enName).not.toBe(id)
      expect(zhName).not.toBe(enName)
    }

    expect(getBlueprintName('plant', 'zh')).toBe('绿意盆栽')
    expect(getBlueprintName('plant', 'en')).toBe('Potted Plant')
    expect(getBlueprintName('castle', 'zh')).toBe('灰岩城堡')
    expect(getBlueprintName('castle', 'en')).toBe('Limestone Castle')
  })

  it('date headers format correctly for both locales', () => {
    const zhHeader = translations.zh.common.dateHeader(2026, 9, 23, '三')
    expect(zhHeader).toContain('9 月 23 日')
    expect(zhHeader).toContain('周三')

    const enHeader = translations.en.common.dateHeader(2026, 9, 23, 'Wed')
    expect(enHeader).toContain('Sep 23')
    expect(enHeader).toContain('Wed')
  })

  it('nav, titlebar, today, settings, and polaroid keys are populated in both languages', () => {
    for (const lang of ['zh', 'en'] as const) {
      const t = translations[lang]
      expect(t.nav.today).toBeTruthy()
      expect(t.nav.build).toBeTruthy()
      expect(t.nav.showcase).toBeTruthy()
      expect(t.nav.stats).toBeTruthy()

      expect(t.titlebar.settings).toBeTruthy()
      expect(t.titlebar.miniMode).toBeTruthy()

      expect(t.settings.title).toBeTruthy()
      expect(t.settings.languageLabel).toBeTruthy()
      expect(t.settings.langZh).toBeTruthy()
      expect(t.settings.langEn).toBeTruthy()

      expect(t.polaroid.modalTitle).toBeTruthy()
      expect(t.polaroid.savePng).toBeTruthy()
      expect(t.polaroid.copyImage).toBeTruthy()
    }
  })

  it('appStore setLanguage updates settings (DOM sync lives in App layer)', () => {
    const store = useAppStore.getState()
    store.setLanguage('en')
    expect(useAppStore.getState().settings.language).toBe('en')

    store.setLanguage('zh')
    expect(useAppStore.getState().settings.language).toBe('zh')
  })
})
