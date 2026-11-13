import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store/appStore'
import { pickAdapter } from '../storage'
import { useI18n } from '../i18n'
import type { Language } from '../i18n'
import type { Theme } from '../types'
import logoUrl from '../assets/logo-mark.svg'

async function act(action: 'open' | 'quit' | 'close') {
  await invoke('tray_menu', { action })
}

/** 托盘右键菜单：应用风格的迷你弹窗（白黑圆润） */
export function TrayMenu() {
  const { t } = useI18n()

  useEffect(() => {
    // 1. 初始化读取本地持久化语言与主题（只读同步，不建立自动写回订阅）
    void pickAdapter()
      .load()
      .then((res) => {
        const saved = res.state
        if (saved?.settings) {
          const l = saved.settings.language ?? 'zh'
          const th = saved.settings.theme ?? 'light'
          useAppStore.setState((s) => ({
            settings: { ...s.settings, language: l, theme: th },
            hydrated: true
          }))
          if (typeof document !== 'undefined') {
            document.documentElement.lang = l
            document.documentElement.dataset.theme = th
          }
        }
      })

    // 2. 跨窗口单向事件监听（仅接收主窗口广播，不反向回传）
    let unlistenLang: (() => void) | undefined
    let unlistenTheme: (() => void) | undefined
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/event').then(async ({ listen }) => {
        unlistenLang = await listen<Language>('language-changed', (event) => {
          useAppStore.setState((s) => ({
            settings: { ...s.settings, language: event.payload }
          }))
          if (typeof document !== 'undefined') {
            document.documentElement.lang = event.payload
          }
        })
        unlistenTheme = await listen<Theme>('theme-changed', (event) => {
          useAppStore.setState((s) => ({
            settings: { ...s.settings, theme: event.payload }
          }))
          if (typeof document !== 'undefined') {
            document.documentElement.dataset.theme = event.payload
          }
        })
      })
    }

    return () => {
      unlistenLang?.()
      unlistenTheme?.()
    }
  }, [])

  return (
    <div className="tray-menu-root" onClick={() => void act('close')}>
      <div className="tray-menu-card" onClick={(e) => e.stopPropagation()}>
        <div className="tray-menu-head">
          <img src={logoUrl} alt="" width={22} height={22} />
          <span style={{ fontFamily: "'Rubik', sans-serif", fontWeight: 700 }}>BlockHabit</span>
        </div>
        <button className="tray-menu-item" onClick={() => void act('open')}>
          {t.tray.openMain}
        </button>
        <button className="tray-menu-item quit" onClick={() => void act('quit')}>
          {t.tray.quit}
        </button>
      </div>
    </div>
  )
}
