import { useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from '../i18n'
import {
  IconMiniWidget,
  IconSettings,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore
} from '../components/Icons'
import logoUrl from '../assets/logo-mark.svg'
import { inTauri } from './inTauri'

/** 自定义窗口标题栏：拖拽区 + 设置 + 最小化/最大化/关闭（仅 Tauri 环境显示窗口按钮） */
export function TitleBar({
  onSettings,
  onToggleMini,
  onRequestClose
}: {
  onSettings: () => void
  onToggleMini: () => void
  /** 关闭请求（Alt+F4 / 系统关闭 / 标题栏关闭）：由 App 决定是否先退出迷你模式 */
  onRequestClose: () => void
}) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  const onRequestCloseRef = useRef(onRequestClose)
  onRequestCloseRef.current = onRequestClose
  useEffect(() => {
    if (!inTauri) return
    let disposed = false
    let cleanup: (() => void) | undefined
    void (async () => {
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      const unlistenResize = await listen('tauri://resize', async () => {
        setMaximized(await win.isMaximized())
      })
      // Alt+F4 / 系统关闭请求 → 收进托盘而不是退出（迷你模式下先退出迷你尺寸）
      const unClose = await win.onCloseRequested(async (event) => {
        event.preventDefault()
        onRequestCloseRef.current()
      })
      if (disposed) {
        unlistenResize()
        unClose()
        return
      }
      cleanup = () => {
        unlistenResize()
        unClose()
      }
    })()
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  async function winAction(action: 'min' | 'max' | 'close') {
    if (!inTauri) return
    const win = getCurrentWindow()
    // 最小化 → 收到任务栏；关闭 → 收进托盘（退出只走托盘菜单）
    if (action === 'close') onRequestClose()
    else if (action === 'min') await win.minimize()
    else await win.toggleMaximize()
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <img src={logoUrl} alt="" width={24} height={24} data-tauri-drag-region />
        <span data-tauri-drag-region style={{ fontFamily: "'Rubik', sans-serif", fontWeight: 700 }}>
          BlockHabit
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="icon-btn" title={t.titlebar.miniMode} onClick={onToggleMini}>
          <IconMiniWidget size={18} />
        </button>
        <button className="icon-btn" title={t.titlebar.settings} onClick={onSettings}>
          <IconSettings size={20} />
        </button>
        {inTauri && (
          <>
            <button
              className="win-btn"
              title={t.titlebar.minimize}
              onClick={() => void winAction('min')}
            >
              <IconWinMin size={16} />
            </button>
            <button
              className="win-btn"
              title={maximized ? t.titlebar.restore : t.titlebar.maximize}
              onClick={() => void winAction('max')}
            >
              {maximized ? <IconWinRestore size={16} /> : <IconWinMax size={16} />}
            </button>
            <button
              className="win-btn close"
              title={t.titlebar.close}
              onClick={() => void winAction('close')}
            >
              <IconWinClose size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
