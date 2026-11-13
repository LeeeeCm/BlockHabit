import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { IconClose, IconGallery } from './Icons'
import {
  availableYears,
  buildYearbook,
  yearbookMarkdown,
  yearbookSummaryText,
  type YearbookState
} from '../logic/yearbook'
import {
  copyYearbookPng,
  drawYearbook,
  readYearbookPalette,
  saveYearbookPng,
  yearbookMarkdownFileName
} from '../render/yearbookCanvas'

interface Props {
  onClose: () => void
}

/**
 * 落成年鉴弹层（D-20261110-060）：
 * 左侧年份 tablist（有事实数据的年份，降序），右侧竖版画布预览（等比缩放），
 * 底部 [保存图片][复制图片][导出 Markdown]。Esc / 关闭按钮 / 焦点圈闭复用 useDialogA11y。
 * 数据全部从现有 AppState 派生（零新字段）；空年份显示诚实空态，不生成伪造数字。
 */
export function YearbookModal({ onClose }: Props) {
  const { lang, t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const dayClaims = useAppStore((s) => s.dayClaims)
  const deletedDayClaims = useAppStore((s) => s.deletedDayClaims)
  const foundationNotes = useAppStore((s) => s.foundationNotes)
  const completedBlueprintIds = useAppStore((s) => s.completedBlueprintIds)

  const state = useMemo<YearbookState>(
    () => ({
      habits,
      checkIns,
      builds,
      dayClaims,
      deletedDayClaims,
      foundationNotes,
      completedBlueprintIds
    }),
    [habits, checkIns, builds, dayClaims, deletedDayClaims, foundationNotes, completedBlueprintIds]
  )

  const years = useMemo(() => availableYears(state), [state])
  const [year, setYear] = useState<number>(() => {
    const known = availableYears(state)
    const currentYear = new Date().getFullYear()
    return known.includes(currentYear) ? currentYear : (known[0] ?? currentYear)
  })
  const model = useMemo(() => buildYearbook(state, year), [state, year])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [toast, showToast] = useTransient<string>(2500)
  const [busy, setBusy] = useState(false)
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose })

  // 数据变化后若当前年份消失（极端：删光当年数据），回落到最新有数据年份
  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) setYear(years[0])
  }, [years, year])

  // 绘制：等待 document.fonts.ready（画布模块内部处理），主题令牌从 document 读取
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model.hasData) return
    let alive = true
    void drawYearbook(canvas, {
      model,
      palette: readYearbookPalette(),
      t,
      lang
    }).catch((error: unknown) => {
      if (alive) console.warn('[yearbook] canvas draw failed', error)
    })
    return () => {
      alive = false
    }
  }, [model, t, lang])

  const handleSelectYear = useCallback((next: number) => {
    triggerHaptic('selection')
    setYear(next)
  }, [])

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (years.length === 0) return
      let nextIndex = index
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        nextIndex = (index + 1) % years.length
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + years.length) % years.length
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = years.length - 1
      } else {
        return
      }
      event.preventDefault()
      handleSelectYear(years[nextIndex])
      requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus())
    },
    [handleSelectYear, years]
  )

  async function handleSavePng() {
    const canvas = canvasRef.current
    if (!canvas || busy) return
    setBusy(true)
    try {
      const ok = await saveYearbookPng(canvas, year)
      showToast(ok ? t.yearbook.savedToast : t.yearbook.copyFail, 2500)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyPng() {
    const canvas = canvasRef.current
    if (!canvas || busy) return
    setBusy(true)
    try {
      const result = await copyYearbookPng(canvas, year)
      // 剪贴板不可用/被拒绝时画布模块已自动降级为下载，toast 必须如实说明
      showToast(
        result === 'copied'
          ? t.yearbook.copiedToast
          : result === 'downloaded'
            ? t.yearbook.copyFallbackToast
            : t.yearbook.copyFail,
        2500
      )
    } finally {
      setBusy(false)
    }
  }

  function handleExportMarkdown() {
    if (!model.hasData) return
    const content = yearbookMarkdown(model, t)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = yearbookMarkdownFileName(year)
      link.click()
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    showToast(t.yearbook.savedToast, 2500)
  }

  const hasCanvas = years.length > 0 && model.hasData

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.yearbook.title}
      tabIndex={-1}
      className="overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{ zIndex: 120 }}
    >
      <div
        className="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          padding: '18px 22px 16px',
          width: 760,
          maxWidth: '94vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 'var(--fs-title)',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <IconGallery size={18} />
            <span>{t.yearbook.title}</span>
          </span>
          <button
            className="icon-btn"
            onClick={() => {
              triggerHaptic('light')
              onClose()
            }}
            title={t.common.close}
          >
            <IconClose size={18} />
          </button>
        </div>

        {years.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 20px 36px' }}>
            <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, marginBottom: 8 }}>
              {t.yearbook.emptyTitle}
            </div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>
              {t.yearbook.emptyBody}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>
            <div
              role="tablist"
              aria-label={t.yearbook.title}
              aria-orientation="vertical"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flexShrink: 0,
                overflowY: 'auto',
                paddingRight: 2
              }}
            >
              {years.map((value, index) => {
                const selected = value === year
                return (
                  <button
                    key={value}
                    ref={(element) => {
                      tabRefs.current[index] = element
                    }}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className="btn ghost"
                    onClick={() => handleSelectYear(value)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 'var(--fs-small)',
                      fontWeight: 600,
                      borderRadius: 'var(--r-sm)',
                      minWidth: 92,
                      textAlign: 'left',
                      background: selected ? 'var(--ink)' : undefined,
                      color: selected ? 'var(--bg)' : undefined,
                      borderColor: selected ? 'var(--ink)' : undefined
                    }}
                  >
                    {t.yearbook.yearTitle(value)}
                  </button>
                )
              })}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto'
              }}
            >
              {hasCanvas ? (
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={yearbookSummaryText(model, t)}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 360,
                    maxHeight: 'calc(92vh - 200px)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface)',
                    display: 'block'
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, marginBottom: 8 }}>
                    {t.yearbook.emptyTitle}
                  </div>
                  <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>
                    {t.yearbook.emptyBody}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--line)'
          }}
        >
          {hasCanvas && (
            <>
              <button className="btn ghost" disabled={busy} onClick={handleSavePng}>
                {t.yearbook.exportPng}
              </button>
              <button className="btn primary" disabled={busy} onClick={handleCopyPng}>
                {t.yearbook.copyPng}
              </button>
              <button className="btn ghost" disabled={busy} onClick={handleExportMarkdown}>
                {t.yearbook.exportMarkdown}
              </button>
            </>
          )}
          <button className="btn ghost" onClick={onClose}>
            {t.common.close}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
