import { useEffect, useRef, useState } from 'react'
import type { Blueprint, MicroMood } from '../types'
import { BuildScene } from '../render/BuildScene'
import { playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { useAppStore } from '../store/appStore'
import { IconCheck, IconClose, IconMood, IconStar } from './Icons'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'

interface Props {
  blueprint: Blueprint
  placedCount: number
  habitName: string
  complete?: boolean
  checkInId?: string
  onClose: () => void
  /** 镌刻保存成功后的回调（宿主页用于弹 toast） */
  onEngraved?: () => void
}

const MOODS: MicroMood[] = ['energetic', 'hard', 'spark', 'calm']

/**
 * 习惯打卡成功后的积木掉落动效与即刻镌刻弹窗：
 * 背景高斯模糊，单块积木由天而降并产生果冻回弹；
 * 落地后浮现微状态与即刻随笔输入框，支持一键镌刻为带铭文积木，亦可极速跳过。
 */
export function BlockDropModal({
  blueprint,
  placedCount,
  habitName,
  complete = false,
  checkInId,
  onClose,
  onEngraved,
}: Props) {
  const { lang, t } = useI18n()
  const recordCheckInNote = useAppStore((s) => s.recordCheckInNote)
  const [closing, setClosing] = useState(false)
  const [animated, setAnimated] = useState(false)
  const [note, setNote] = useState('')
  const [selectedMood, setSelectedMood] = useState<MicroMood | undefined>(undefined)
  const [starred, setStarred] = useState(false)
  const [engraved, setEngraved] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  function triggerClose() {
    if (closing) return
    triggerHaptic('light')
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 240)
  }

  function handleAnimated() {
    playJellySound()
    setAnimated(true)
    // 落地后自动聚焦镌刻输入框，直接开始打字
    inputRef.current?.focus()
    // 积木落地后启动柔和的自动淡出定时器（3.6s），给用户充足时间看清建筑或开始打字
    timerRef.current = window.setTimeout(() => {
      triggerClose()
    }, 3600)
  }

  function cancelAutoClose() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }

  function handleMoodToggle(m: MicroMood) {
    cancelAutoClose()
    setSelectedMood((prev) => (prev === m ? undefined : m))
  }

  function handleEngraveSubmit() {
    cancelAutoClose()
    if (checkInId) {
      triggerHaptic('medium')
      recordCheckInNote(checkInId, note, selectedMood, starred)
      playSnapSound()
      onEngraved?.()
      setEngraved(true)
      setTimeout(() => {
        triggerClose()
      }, 350)
    } else {
      triggerClose()
    }
  }

  const { ref: dialogRef } = useDialogA11y({ open: true, onClose: triggerClose })

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
    }
  }, [])

  const total = blueprint.blocks.length
  const progressPercent = Math.min(100, Math.round((placedCount / total) * 100))

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={`drop-overlay${closing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) triggerClose()
      }}
    >
      <div className="drop-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* 标题栏与跳过按钮 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent-ink)',
                background: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              {t.blockDrop.plusOne}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {t.blockDrop.completedHabit(habitName)}
            </span>
          </div>

          <button
            className="btn ghost"
            onClick={triggerClose}
            title={t.blockDrop.skip}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              borderRadius: 999,
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>{t.common.skip}</span>
              <IconClose size={13} />
            </span>
          </button>
        </div>

        {/* 3D 单块掉落舞台 */}
        <div style={{ height: 240, position: 'relative', background: 'var(--bg)' }}>
          <BuildScene
            blueprint={blueprint}
            placedCount={placedCount}
            animateIndex={placedCount - 1}
            onAnimated={handleAnimated}
          />
        </div>

        {/* 即刻镌刻栏（随笔与微状态，落地后果冻抽屉平滑滑出，避免弹窗跳动） */}
        {checkInId && (
          <div
            className="drop-engrave-section"
            style={{
              maxHeight: animated ? 150 : 0,
              opacity: animated ? 1 : 0,
              paddingTop: animated ? 12 : 0,
              paddingBottom: animated ? 14 : 0,
              paddingLeft: 18,
              paddingRight: 18,
              borderTopWidth: animated ? 1 : 0,
              pointerEvents: animated ? 'auto' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="micro-mood-group">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`micro-mood-chip${selectedMood === m ? ' active' : ''}`}
                    onClick={() => handleMoodToggle(m)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconMood mood={m} size={12} style={{ flexShrink: 0 }} />
                    <span>{t.microMood[m]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`star-toggle-btn${starred ? ' starred' : ''}`}
                onClick={() => {
                  cancelAutoClose()
                  setStarred((prev) => !prev)
                }}
                title={starred ? t.reflections.unstarTooltip : t.reflections.starTooltip}
              >
                <IconStar size={14} filled={starred} />
              </button>
            </div>

            <div className="drop-engrave-input-row">
              <input
                ref={inputRef}
                type="text"
                className="drop-engrave-input"
                value={note}
                placeholder={t.reflections.engravePlaceholder}
                onFocus={cancelAutoClose}
                onChange={(e) => {
                  cancelAutoClose()
                  setNote(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleEngraveSubmit()
                  }
                }}
              />
              <button
                type="button"
                className="btn primary"
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 'var(--r-sm)' }}
                disabled={engraved}
                onClick={handleEngraveSubmit}
              >
                {engraved ? <IconCheck size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> : t.reflections.engraveAction}
              </button>
            </div>
          </div>
        )}

        {/* 底部蓝图进度 */}
        <div style={{ padding: '12px 20px 14px', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              fontSize: 12.5,
            }}
          >
            <span style={{ fontWeight: 600 }}>{getBlueprintName(blueprint.id, lang)}</span>
            <span style={{ color: 'var(--ink-2)' }}>
              {t.blockDrop.progress(placedCount, total, progressPercent)}
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: 'var(--line)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: complete ? 'var(--progress-green)' : 'var(--ink)',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
