import { useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function doExport() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blockhabit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    const text = await file.text()
    const ok = importData(text)
    setMsg(ok ? '导入成功' : '导入失败：文件格式不正确')
    setTimeout(() => setMsg(null), 2400)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>设置</h3>

        <div className="field">
          <label>主题</label>
          <div className="seg">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
              纸白
            </button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
              墨黑
            </button>
          </div>
        </div>

        <div className="field">
          <label>数据（本地保存）</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={doExport}>
              导出 JSON
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              导入 JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void doImport(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0 0' }}>
          BlockHabit v0.1 · 每一次打卡，都算数。
        </p>

        <div className="dialog-actions">
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </div>

        {msg && <div className="toast">{msg}</div>}
      </div>
    </div>
  )
}
