import { useAppStore } from '../store/appStore'
import { zh } from './locales/zh'
import { en } from './locales/en'
import type { Language, TranslationSchema } from './types'

export const translations: Record<Language, TranslationSchema> = { zh, en }

export function getTranslation(lang: Language = 'zh'): TranslationSchema {
  return translations[lang] ?? translations.zh
}

export function useI18n(): { lang: Language; t: TranslationSchema } {
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const t = translations[lang] ?? translations.zh
  return { lang, t }
}

/** 获取经过本地化处理的蓝图名称 */
export function getBlueprintName(id: string, lang: Language = 'zh'): string {
  const t = getTranslation(lang)
  return t.blueprints[id] ?? id
}

export * from './types'
