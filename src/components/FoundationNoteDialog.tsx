import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { getBlueprintName, useI18n } from '../i18n'
import { playSnapSound } from '../audio/sound'
import { IconClose, IconFoundation, IconStar } from './Icons'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'

interface Props {
  blueprintId: string
  onClose: () => void
}

/**
 * 建筑落成奠基石铭言弹窗：
 * 支持自定寄语，或从拼搭过程中写下的高光随笔中一键选用作为该建筑的永久基石。
 */
export function FoundationNoteDialog({ blueprintId, onClose }: Props) {
  const { lang, t } = useI18n()
  const foundationNotes = useAppStore((s) => s.foundationNotes ?? {})
  const setFoundationNote = useAppStore((s) => s.setFoundationNote)
  const builds = useAppStore((s) => s.builds)
  const checkIns = useAppStore((s) => s.checkIns)
  const habits = useAppStore((s) => s.habits)

  const currentNote = foundationNotes[blueprintId] ?? ''
  const [text, setText] = useState(currentNote)
  const [toast, setToast] = useState<string | null>(null)

  // 提取建造该建筑期间的所有随笔候选条目（优先星标与非空内容）
  const candidates = useMemo(() => {
    const bpBuildIds = builds
      .filter((b) => b.blueprintId === blueprintId)
      .map((b) => b.id)
    const matched = checkIns.filter(
      (c) => c.placedBlockId && bpBuildIds.includes(c.placedBlockId) && c.note?.trim(),
    )
    // 排序：星标优先，然后按长度/日期
    matched.sort((a, b) => {
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      return b.date.localeCompare(a.date)
    })
    return matched.slice(0, 3)
  }, [builds, checkIns, blueprintId])

  function handleSave() {
    setFoundationNote(blueprintId, text)
    playSnapSound()
    setToast(t.reflections.foundationSavedToast)
    setTimeout(() => {
      onClose()
    }, 450)
  }

  const { ref: dialogRef } = useDialogA11y({ open: true, onClose })


  const bpName = getBlueprintName(blueprintId, lang)

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 110 }}
    >
      <div
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: '92vw' }}
      >
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconFoundation size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              {bpName} · {t.reflections.foundationModalTitle}
            </span>
          </div>
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

        <div className="dialog-body">
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
          {t.reflections.foundationPrompt}
        </p>

        {candidates.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
              {t.reflections.pickFromReflections}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {candidates.map((c) => {
                const h = habits.find((x) => x.id === c.habitId)
                return (
                  <div
                    key={c.id}
                    onClick={() => setText(c.note || '')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      background: 'color-mix(in srgb, var(--ink) 3%, transparent)',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      transition: 'border-color 0.15s ease',
                    }}
                    title={t.reflections.clickToUseDedication}
                  >
                    {c.starred && <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    <span style={{ color: 'var(--ink)', flex: 1, wordBreak: 'break-word' }}>“{c.note}”</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-2)', flexShrink: 0 }}>
                      {h?.name} · {c.date}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.reflections.foundationPlaceholder}
          style={{
            width: '100%',
            height: 90,
            padding: '10px 12px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--line)',
            background: 'color-mix(in srgb, var(--ink) 2%, transparent)',
            fontSize: 13,
            color: 'var(--ink)',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            }
          }}
        />

        </div>

        <div className="dialog-footer">
          <button className="btn ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn primary" onClick={handleSave}>
            {t.reflections.foundationSave}
          </button>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
