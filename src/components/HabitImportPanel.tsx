import { useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import {
  parseHabitFile,
  splitImportCandidates,
  type HabitImportParseResult
} from '../logic/habitImport'

interface Props {
  onToast: (message: string, durationMs?: number) => void
}

interface Preview {
  fileName: string
  result: HabitImportParseResult
}

/**
 * 从其他应用导入习惯定义（D-20261124-085）。
 * 解析 → 预览（可导入 / 跳过）→ 用户确认后才写入；不做静默导入。
 */
export function HabitImportPanel({ onToast }: Props) {
  const { t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const addHabit = useAppStore((s) => s.addHabit)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  const split = preview
    ? splitImportCandidates(
        preview.result.candidates,
        habits.map((h) => h.name)
      )
    : null
  const skipped = preview ? preview.result.skipped.length + (split?.duplicates.length ?? 0) : 0
  const importable = split?.toAdd.length ?? 0

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      setPreview({ fileName: file.name, result: parseHabitFile(file.name, text) })
    } catch {
      setPreview({
        fileName: file.name,
        result: { candidates: [], skipped: [], error: 'read-failed' }
      })
    }
  }

  function confirmImport() {
    if (!preview || !split) return
    for (const candidate of split.toAdd) {
      addHabit(candidate.name, candidate.frequency, candidate.extra)
    }
    onToast(t.settings.habitImportDone(split.toAdd.length, skipped), 3200)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function reset() {
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
      <label>{t.settings.habitImportLabel}</label>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
        {t.settings.habitImportHint}
      </div>
      {/* D-20261126-114：单个按钮也填满行宽（与「导出备份 / 导入备份」两列同一基准） */}
      <div className="settings-actions">
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          {t.settings.habitImportChoose}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
      {preview && (
        <div className="settings-hint" style={{ color: 'var(--ink-2)' }}>
          {preview.fileName}
        </div>
      )}

      {preview && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface)'
          }}
        >
          {preview.result.error ? (
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--danger)' }}>
              {t.settings.habitImportError}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                {t.settings.habitImportSummary(importable, skipped)}
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 4 }}>
                {t.settings.habitImportFormat}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn ghost" style={{ padding: '5px 12px' }} onClick={reset}>
                  {t.common.cancel}
                </button>
                <button
                  className="btn primary"
                  style={{ padding: '5px 12px' }}
                  disabled={importable === 0}
                  onClick={confirmImport}
                >
                  {t.settings.habitImportConfirm(importable)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
