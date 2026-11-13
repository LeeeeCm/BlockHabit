import { useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { APP_VERSION } from '../platform/errorLog'
import { isTauriRuntime } from '../platform/http'
import { serializeState } from '../store/serializeState'
import {
  downloadBlobFile,
  revealArchivePath,
  runArchiveExport,
  type ArchiveProgress
} from '../storage/archive'
import { renderBuildingPng } from '../render/archiveCanvas'
import { loadWebDavConfig } from '../sync/useSync'

type ArchivePanelResult =
  | { kind: 'desktop'; dir: string; readmePath: string; bytes: number }
  | { kind: 'browser'; filename: string; bytes: number }
  | { kind: 'cancelled' }
  | { kind: 'failed' }

function formatArchiveBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * A4 一键档案包（D-20261110-062）：入口 + 进度 + 取消 + 结果。
 * 桌面端生成到 appDataDir/exports 的文件夹（权威产物，成功后自动 reveal）；
 * 浏览器端生成单个 ZIP 下载。凭据只用于「导出前断言不含密码」，绝不写入档案包。
 * 从 SettingsDialog 抽出，避免设置页文件继续膨胀（仓库约定单文件 >800 行时拆分）。
 */
export function ArchiveExportPanel() {
  const { lang, t } = useI18n()
  const exportData = useAppStore((s) => s.exportData)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ArchiveProgress | null>(null)
  const [result, setResult] = useState<ArchivePanelResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function startExport(): Promise<void> {
    if (running) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setProgress(null)
    setResult(null)
    try {
      const desktop = isTauriRuntime()
      const response = await runArchiveExport({
        state: serializeState(useAppStore.getState()),
        stateJson: exportData(),
        appVersion: APP_VERSION,
        platform: desktop ? 'desktop' : 'browser',
        lang,
        secrets: [loadWebDavConfig().password],
        signal: controller.signal,
        onProgress: setProgress,
        renderBuilding: renderBuildingPng
      })
      if (response.ok && response.mode === 'browser') {
        downloadBlobFile(response.filename, response.zip, 'application/zip')
        setResult({ kind: 'browser', filename: response.filename, bytes: response.bytes })
      } else if (response.ok) {
        setResult({
          kind: 'desktop',
          dir: response.dir,
          readmePath: response.readmePath,
          bytes: response.bytes
        })
      } else if (response.cancelled) {
        setResult({ kind: 'cancelled' })
      } else {
        setResult({ kind: 'failed' })
      }
    } catch {
      setResult({ kind: 'failed' })
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const hint =
    result?.kind === 'desktop'
      ? `${t.archive.success} · ${formatArchiveBytes(result.bytes)}`
      : result?.kind === 'browser'
        ? `${t.archive.success} · ${result.filename} · ${formatArchiveBytes(result.bytes)}`
        : result?.kind === 'cancelled'
          ? t.archive.cancelled
          : result?.kind === 'failed'
            ? t.archive.fail
            : isTauriRuntime()
              ? t.archive.exportHint
              : `${t.archive.exportHint} ${t.archive.browserZipHint}`

  return (
    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
      <label>{t.archive.title}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn ghost"
          style={{ padding: '7px 16px' }}
          disabled={running}
          onClick={() => void startExport()}
        >
          {running
            ? t.archive.preparing
            : result?.kind === 'failed'
              ? t.archive.partialRetry
              : t.archive.exportBtn}
        </button>
        {running && (
          <>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
              {progress ? t.archive.progress(progress.done, progress.total) : t.archive.preparing}
            </span>
            <button
              className="btn ghost"
              style={{ padding: '4px 12px', fontSize: 'var(--fs-small)' }}
              onClick={() => abortRef.current?.abort()}
            >
              {t.archive.cancel}
            </button>
          </>
        )}
        {!running && result?.kind === 'desktop' && (
          <button
            className="btn ghost"
            style={{ padding: '4px 12px', fontSize: 'var(--fs-small)' }}
            onClick={() => void revealArchivePath(result.readmePath)}
          >
            {t.archive.openDir}
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-caption)',
          color: 'var(--ink-2)',
          marginTop: 4,
          lineHeight: 1.5
        }}
      >
        {hint}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-caption)',
          color: 'var(--ink-2)',
          marginTop: 2,
          lineHeight: 1.5
        }}
      >
        {t.archive.contents}
      </div>
    </div>
  )
}
