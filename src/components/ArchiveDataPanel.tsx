import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useAppStore } from '../store/appStore'
import { exportDiagnosticsPackage } from '../platform/diagnostics'
import {
  createBackup,
  listBackups,
  openDataDir,
  readBackup,
  type BackupEntry
} from '../storage/backups'
import type { AppState } from '../types'
import { ArchiveExportPanel } from './ArchiveExportPanel'

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

type Toast = (message: string, durationMs?: number) => void

interface DataPanelProps {
  /** 文件到手后交给设置页统一的「导入确认」流程（ConfirmDialog 与嵌套 Esc 抑制仍由父级负责） */
  onImportFile: (file: File) => void
}

/**
 * A4 数据安全面板（D-20261110-062）：JSON 导出 / 导入入口 + 一键档案包。
 * 从 SettingsDialog 抽出以控制设置页文件行数；导出/导入与档案包生成保持原有行为。
 */
export function ArchiveDataPanel({ onImportFile }: DataPanelProps) {
  const { t } = useI18n()
  const exportData = useAppStore((s) => s.exportData)
  const fileRef = useRef<HTMLInputElement>(null)

  function doExport() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blockhabit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t.settings.dataLabel}</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost" onClick={doExport} style={{ flex: 1, padding: '7px 0' }}>
            {t.settings.exportJson}
          </button>
          <button
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
            style={{ flex: 1, padding: '7px 0' }}
          >
            {t.settings.importJson}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* A4 一键档案包：文件夹（桌面）/ 单 ZIP（浏览器），可取消、失败清理 */}
      <ArchiveExportPanel />
    </>
  )
}

interface BackupsPanelProps {
  onToast: Toast
  /** 读取并严格校验后，复用「导入确认」流程（覆盖前同样会自动留档） */
  onRestoreCandidate: (state: AppState) => void
}

/**
 * F3 备份与恢复（桌面端）：手动备份 / 打开数据目录 / 备份列表与恢复。
 * 桌面端才有磁盘备份；浏览器下父级不渲染本组件。
 */
export function ArchiveBackupsPanel({ onToast, onRestoreCandidate }: BackupsPanelProps) {
  const { t } = useI18n()
  const [backups, setBackups] = useState<BackupEntry[]>([])

  // 打开备份分组时拉取一次列表（仅桌面端有磁盘备份）
  useEffect(() => {
    if (!inTauri) return
    void listBackups().then(setBackups)
  }, [])

  /** 刷新备份列表（读目录失败时保持空列表，不打扰用户） */
  async function refreshBackups(): Promise<void> {
    setBackups(await listBackups())
  }
  async function doManualBackup(): Promise<void> {
    const ok = await createBackup(JSON.parse(useAppStore.getState().exportData()))
    onToast(ok ? t.settings.backupCreated : t.settings.backupCreateFail, 0)
    if (ok) await refreshBackups()
  }
  async function doOpenDataDir(): Promise<void> {
    if (!(await openDataDir())) onToast(t.settings.openDirFail, 2400)
  }
  /** 从备份恢复：读取并严格校验后，复用「导入确认」流程（覆盖前同样会自动留档） */
  async function doRestoreBackup(name: string): Promise<void> {
    const state = await readBackup(name)
    if (!state) {
      onToast(t.settings.backupReadFail, 2400)
      return
    }
    onRestoreCandidate(state)
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn ghost"
            onClick={() => void doManualBackup()}
            style={{ flex: 1, padding: '7px 0' }}
          >
            {t.settings.backupNow}
          </button>
          <button
            className="btn ghost"
            onClick={() => void doOpenDataDir()}
            style={{ flex: 1, padding: '7px 0' }}
          >
            {t.settings.openDataDir}
          </button>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t.settings.restoreLabel}</label>
        {backups.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
            {t.settings.backupsEmpty}
          </div>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}
          >
            {backups.map((b) => (
              <li
                key={b.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 'var(--fs-small)',
                  color: 'var(--ink-2)'
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {b.kind === 'corrupt'
                    ? t.settings.backupKindCorrupt
                    : b.timestamp
                      ? new Date(b.timestamp).toLocaleString()
                      : b.name}
                  {b.size > 0 && b.kind !== 'corrupt'
                    ? `  ·  ${Math.max(1, Math.round(b.size / 1024))} KB`
                    : ''}
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-caption)',
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--ink) 7%, transparent)'
                  }}
                >
                  {b.kind === 'auto'
                    ? t.settings.backupKindAuto
                    : b.kind === 'manual'
                      ? t.settings.backupKindManual
                      : t.settings.backupKindCorrupt}
                </span>
                <button
                  className="btn ghost"
                  style={{ padding: '3px 10px', fontSize: 'var(--fs-small)' }}
                  onClick={() => void doRestoreBackup(b.name)}
                >
                  {t.settings.backupRestore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

interface DiagnosticsProps {
  onToast: Toast
}

/**
 * F9 本地诊断包：崩溃日志 + 数据体量 + 帧率采样，纯本地生成（渲染在「实验室」分组内）。
 */
export function DiagnosticsExportPanel({ onToast }: DiagnosticsProps) {
  const { t } = useI18n()

  async function doExportDiagnostics(): Promise<void> {
    const ok = await exportDiagnosticsPackage()
    onToast(ok ? t.settings.diagnosticsToast : t.settings.diagnosticsFailToast, 2400)
  }

  return (
    <>
      {/* F9 本地诊断包：崩溃日志 + 数据体量 + 帧率采样，纯本地生成 */}
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t.settings.diagnosticsLabel}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn ghost"
            style={{ padding: '7px 16px' }}
            onClick={() => void doExportDiagnostics()}
          >
            {t.settings.diagnosticsExport}
          </button>
          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {t.settings.diagnosticsHint}
          </span>
        </div>
      </div>
    </>
  )
}
