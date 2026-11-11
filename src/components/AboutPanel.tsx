import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { Language } from '../i18n'
import { blueprintOrder, blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { APP_VERSION } from '../platform/errorLog'
import {
  checkForUpdate,
  discardPendingUpdate,
  installUpdate,
  isUpdaterEnabled,
  type UpdateCheckResult
} from '../platform/updater'

/**
 * 设置页「内容路线 / 关于」（C2 / D-20261110-063 §3.5.5 approved 范围）：
 * 如实展示当前内置内容版本、年度免费扩建节奏、跨设备升级说明与本地优先承诺。
 * 不写死未来内容包的日期；数字全部从内容 manifest 动态计算。
 *
 * D-20261111-069（approved）追加「版本与更新」行：
 * - 只有用户点击才检查；未配置发布链路（默认构建）时按钮禁用并如实说明。
 * - 取消不是真正中止请求：插件没有 abort API，本行只忽略迟到结果（请求代次 token），
 *   不会把迟到的失败当成用户可见错误。
 * - 不新增颜色/阴影/控件类型：沿用面板既有 1px --line / --fs-small/--fs-caption / --ink(--2)
 *   与既有 .btn.ghost 按钮样式。
 */

type UpdateUiState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest'; checkedAt: Date }
  | { kind: 'available'; version: string; body?: string; installing: boolean }
  | { kind: 'error'; detail?: string }

/** 语言 → BCP 47 locale（避免内联 lang 三元，AGENTS §3.4） */
const LOCALE_BY_LANG: Record<Language, string> = { zh: 'zh-CN', en: 'en-US' }

/** 检查时间：本地短时间即可（不写时区，避免过度承诺） */
function formatCheckedAt(date: Date, lang: Language): string {
  try {
    return date.toLocaleTimeString(LOCALE_BY_LANG[lang], {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

/** 发布说明来自服务端，属外部数据；截断避免撑破设置页布局 */
function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`
}

function toUiState(result: UpdateCheckResult): UpdateUiState {
  switch (result.status) {
    case 'latest':
      return { kind: 'latest', checkedAt: result.checkedAt }
    case 'available':
      return { kind: 'available', version: result.version, body: result.body, installing: false }
    case 'error':
      return { kind: 'error', detail: result.error.message }
    case 'disabled':
      return { kind: 'idle' }
  }
}

export function AboutPanel() {
  const { lang, t } = useI18n()
  const blueprintCount = blueprintOrder.length
  const blockCount = blueprintOrder.reduce(
    (sum, id) => sum + (blueprints[id]?.blocks.length ?? 0),
    0
  )
  const rows: Array<{ title: string; body: string }> = [
    {
      title: t.settings.aboutPaceTitle,
      body: t.settings.aboutPaceBody
    },
    {
      title: t.settings.aboutUpgradeTitle,
      body: t.settings.aboutUpgradeBody
    },
    {
      title: t.settings.aboutLocalTitle,
      body: t.settings.aboutLocalBody
    }
  ]

  const updateEnabled = isUpdaterEnabled()
  const [updateState, setUpdateState] = useState<UpdateUiState>({ kind: 'idle' })
  /** 错误详情复制反馈：idle / copied / failed（失败时提示手动选择文本） */
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  /** 请求代次：取消/卸载后递增，迟到的检查结果一律丢弃（不误报失败） */
  const requestToken = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestToken.current += 1
      void discardPendingUpdate()
    }
  }, [])

  const handleCheck = async (): Promise<void> => {
    const token = ++requestToken.current
    setCopyState('idle')
    setUpdateState({ kind: 'checking' })
    const result = await checkForUpdate()
    if (!mounted.current || token !== requestToken.current) {
      // 用户已取消或已离开：忽略迟到结果；若迟到的结果是"发现新版本"，顺手释放资源
      if (result.status === 'available') void discardPendingUpdate()
      return
    }
    setUpdateState(toUiState(result))
  }

  const handleCancel = (): void => {
    // 插件请求无法真正中止：递增代次后，晚到的结果会被 handleCheck 丢弃。
    requestToken.current += 1
    setCopyState('idle')
    setUpdateState({ kind: 'idle' })
  }

  const handleInstall = async (): Promise<void> => {
    if (updateState.kind !== 'available') return
    setUpdateState({ ...updateState, installing: true })
    const result = await installUpdate()
    if (!mounted.current) return
    // Windows 上安装成功后应用会被安装器退出并重启；其它平台由适配层 relaunch。
    if (result.status === 'error') setUpdateState({ kind: 'error', detail: result.error.message })
    else if (result.status === 'disabled') setUpdateState({ kind: 'error' })
    else setUpdateState({ kind: 'idle' })
  }

  const handleUpdateButton = (): void => {
    if (!updateEnabled) return
    if (updateState.kind === 'checking') {
      handleCancel()
      return
    }
    if (updateState.kind === 'available') {
      void handleInstall()
      return
    }
    void handleCheck()
  }

  let statusText: string | null = null
  let statusDetail: string | null = null
  if (!updateEnabled) statusText = t.settings.updateDisabled
  else if (updateState.kind === 'checking') statusText = t.settings.updateChecking
  else if (updateState.kind === 'latest') {
    statusText = `${t.settings.updateLatest} · ${t.settings.updateCheckedAt(formatCheckedAt(updateState.checkedAt, lang))}`
  } else if (updateState.kind === 'available') {
    statusText = t.settings.updateAvailable(updateState.version)
    statusDetail = updateState.body ? truncate(updateState.body, 240) : null
  } else if (updateState.kind === 'error') {
    statusText = t.settings.updateError
    statusDetail = updateState.detail ?? null
  }

  const handleCopyDetail = async (): Promise<void> => {
    if (!statusDetail) return
    try {
      await navigator.clipboard.writeText(statusDetail)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const updateButtonLabel =
    updateState.kind === 'checking'
      ? t.settings.updateCancel
      : updateState.kind === 'available'
        ? t.settings.updateDownload
        : t.settings.updateCheck
  const updateButtonDisabled =
    !updateEnabled || (updateState.kind === 'available' && updateState.installing)

  return (
    <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink)' }}>
      <div style={{ lineHeight: 1.6 }}>
        {t.settings.aboutContent(blueprintCount, blockCount, CONTENT_VERSION)}
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.map((row, index) => (
          <div
            key={row.title}
            style={{
              borderTop: index === 0 ? 'none' : '1px solid var(--line)',
              padding: '8px 0 2px'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 'var(--fs-small)' }}>{row.title}</div>
            <div
              style={{
                color: 'var(--ink-2)',
                fontSize: 'var(--fs-caption)',
                lineHeight: 1.6,
                marginTop: 2
              }}
            >
              {row.body}
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--line)', padding: '8px 0 2px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--fs-small)' }}>
                {t.settings.updateTitle}
              </div>
              <div
                style={{
                  color: 'var(--ink-2)',
                  fontSize: 'var(--fs-caption)',
                  lineHeight: 1.6,
                  marginTop: 2
                }}
              >
                {t.settings.updateCurrent(APP_VERSION)}
              </div>
              {statusText && (
                <div
                  style={{
                    color: 'var(--ink)',
                    fontSize: 'var(--fs-caption)',
                    lineHeight: 1.6,
                    marginTop: 2
                  }}
                >
                  {statusText}
                </div>
              )}
              {statusDetail && (
                <div
                  style={{
                    color: 'var(--ink-2)',
                    fontSize: 'var(--fs-caption)',
                    lineHeight: 1.6,
                    marginTop: 2,
                    whiteSpace: 'pre-wrap',
                    userSelect: 'text'
                  }}
                >
                  {statusDetail}
                </div>
              )}
              {updateState.kind === 'error' && statusDetail && (
                <div style={{ marginTop: 4 }}>
                  <button
                    className="btn ghost"
                    onClick={() => void handleCopyDetail()}
                    style={{ padding: '2px 8px', fontSize: 'var(--fs-caption)' }}
                  >
                    {copyState === 'copied'
                      ? t.settings.updateCopied
                      : copyState === 'failed'
                        ? t.settings.updateCopyFailed
                        : t.settings.updateCopyDetail}
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn ghost"
              disabled={updateButtonDisabled}
              onClick={handleUpdateButton}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                fontSize: 'var(--fs-caption)'
              }}
            >
              {updateButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
