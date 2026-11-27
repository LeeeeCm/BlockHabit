import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import type { MicroMood } from '../types'
import { IconClose, IconMood, IconMoodCustom } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { BottomSheet } from './BottomSheet'

/** 预设心境（顺序即展示顺序） */
export const MOOD_PRESETS: MicroMood[] = [
  'energetic',
  'hard',
  'spark',
  'calm',
  'grateful',
  'focused',
  'tired',
  'proud'
]

/** 自定义心境文本上限：与胶囊宽度匹配，超出会挤坏卡片行 */
export const MOOD_NOTE_MAX = 12

interface Props {
  /** 当前预设心境 */
  mood: MicroMood | undefined
  /** 当前自定义心境文本 */
  moodNote: string | undefined
  onClose: () => void
  /** 选择预设（null = 清除） */
  onPickMood: (mood: MicroMood | null) => void
  /** 使用自定义文本（空串 = 清除） */
  onPickNote: (note: string) => void
  /**
   * 叠层：在被另一个弹窗打开时传入（掉落弹窗 z-index 100，这里取 110），
   * 否则会画在父弹窗**下面**，看起来像是被吞掉了（D-20261126-119）。
   */
  layer?: number
}

/**
 * 心境选择弹窗（D-20261126-118）。
 *
 * 结构与其它弹窗完全一致：桌面 `overlay + .dialog`、移动 `BottomSheet`，
 * 头部标题 + 关闭、`.dialog-body` 内容流、`.dialog-footer` 两个动作。
 *
 * 内容分三段：
 * 1. 8 个预设心境（原来只有 4 个）；
 * 2. 自定义心境：输入框 + 字数上限，实时预览将写进卡片的样子；
 * 3. 底部「清除心境」与「完成」。
 *
 * 只负责「选择」，不写存档 —— 由调用方决定何时 `recordCheckInNote`。
 */
export function MoodPickerDialog({
  mood,
  moodNote,
  onClose,
  onPickMood,
  onPickNote,
  layer
}: Props) {
  const { t } = useI18n()
  const { isMobile } = usePlatform()
  const { ref: dialogRef, style: layerStyle } = useDialogA11y({
    open: true,
    onClose,
    enabled: !isMobile,
    layer
  })
  const [text, setText] = useState(moodNote ?? '')
  /** 当前是否处于「自定义」段落的编辑态：有自定义文本或用户主动点选时成立 */
  const [customMode, setCustomMode] = useState(Boolean(moodNote))
  const trimmed = text.trim()
  const tooLong = trimmed.length > MOOD_NOTE_MAX

  function commitCustom() {
    if (!trimmed || tooLong) return
    triggerHaptic('selection')
    onPickNote(trimmed)
    onClose()
  }

  function pick(m: MicroMood) {
    triggerHaptic('selection')
    setCustomMode(false)
    setText('')
    onPickMood(m)
    onClose()
  }

  function clear() {
    triggerHaptic('light')
    onPickNote('')
    onClose()
  }

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>{t.moodDialog.subtitle}</label>
        </div>
        {/* 预设：两列网格，等宽倒角方块；与设置页的动作行同一套尺寸语言 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8
          }}
        >
          {MOOD_PRESETS.map((m) => {
            const active = !customMode && mood === m
            return (
              <button
                key={m}
                type="button"
                className={`mood-option${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => pick(m)}
              >
                <IconMood mood={m} size={15} style={{ flexShrink: 0 }} />
                <span>{t.microMood[m]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>{t.moodDialog.customTitle}</label>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <button
            type="button"
            className={`mood-option mood-option-icon${customMode ? ' active' : ''}`}
            aria-pressed={customMode}
            aria-label={t.moodDialog.customTitle}
            onClick={() => setCustomMode(true)}
            style={{ flex: '0 0 auto', width: 40, padding: 0, justifyContent: 'center' }}
          >
            <IconMoodCustom size={15} />
          </button>
          <input
            type="text"
            className="micro-note-input"
            style={{ flex: 1, minWidth: 0, marginTop: 0 }}
            value={text}
            maxLength={MOOD_NOTE_MAX + 4}
            placeholder={t.moodDialog.customPlaceholder}
            onFocus={() => setCustomMode(true)}
            onChange={(e) => {
              setCustomMode(true)
              setText(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustom()
              }
            }}
          />
          <button
            type="button"
            className="btn primary"
            disabled={!trimmed || tooLong}
            onClick={commitCustom}
            style={{ flex: '0 0 auto', padding: '0 14px', fontSize: 'var(--fs-small)' }}
          >
            {t.moodDialog.customSave}
          </button>
        </div>
        <div className="settings-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {tooLong
              ? t.moodDialog.tooLong
              : trimmed
                ? `${trimmed.length} / ${MOOD_NOTE_MAX}`
                : t.moodDialog.customEmpty}
          </span>
        </div>
      </section>
    </div>
  )

  const footer = (
    <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
      <button className="btn ghost" onClick={clear} style={{ flex: isMobile ? 1 : undefined }}>
        {t.moodDialog.clear}
      </button>
      <button
        className="btn primary"
        onClick={onClose}
        style={{ flex: isMobile ? 1 : undefined, padding: '9px 24px' }}
      >
        {t.common.complete}
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <BottomSheet open={true} onClose={onClose} title={t.moodDialog.title} footer={footer}>
        {body}
      </BottomSheet>
    )
  }

  return createPortal(
    <div
      className="overlay"
      style={layerStyle}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="mood-dialog-title"
        aria-modal="true"
        tabIndex={-1}
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: '92vw' }}
      >
        <div className="dialog-header">
          <h3 id="mood-dialog-title">{t.moodDialog.title}</h3>
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
        <div className="dialog-body">{body}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>,
    document.body
  )
}
