import { useEffect, useRef, useState } from 'react'
import type { Blueprint, MicroMood } from '../types'
import { BuildScene } from '../render/BuildScene'
import { playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { useAppStore } from '../store/appStore'
import { IconCheck, IconClose, IconMood, IconMoodCustom, IconPlus, IconStar } from './Icons'
import { MoodPickerDialog } from './MoodPickerDialog'

/** 掉落弹窗内联展示的 6 个心境（★ 与 ＋ 分列两端，正好铺满一行） */
const QUICK_MOODS: MicroMood[] = ['energetic', 'hard', 'spark', 'calm', 'grateful', 'focused']
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
  onEngraved
}: Props) {
  const { lang, t } = useI18n()
  const recordCheckInNote = useAppStore((s) => s.recordCheckInNote)
  const [closing, setClosing] = useState(false)
  const [animated, setAnimated] = useState(false)
  const [note, setNote] = useState('')
  const [selectedMood, setSelectedMood] = useState<MicroMood | undefined>(undefined)
  /** 自定义心境（D-20261126-118）：与预设互斥 */
  const [moodNote, setMoodNote] = useState<string | undefined>(undefined)
  const [moodPickerOpen, setMoodPickerOpen] = useState(false)
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
      recordCheckInNote(checkInId, note, moodNote ? null : selectedMood, starred, moodNote ?? null)
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
      aria-labelledby="drop-modal-title"
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
            borderBottom: '1px solid var(--line)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 'var(--fs-small)',
                fontWeight: 700,
                color: 'var(--accent-ink)',
                background: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: 'var(--r-xs)',
                flexShrink: 0
              }}
            >
              {t.blockDrop.plusOne}
            </span>
            <span
              id="drop-modal-title"
              style={{
                fontSize: 'var(--fs-subhead)',
                fontWeight: 600,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {complete
                ? t.blockDrop.completedBlueprint(getBlueprintName(blueprint.id, lang))
                : t.blockDrop.completedHabit(habitName)}
            </span>
          </div>

          <button
            className="btn ghost"
            onClick={triggerClose}
            title={t.blockDrop.skip}
            style={{
              padding: '4px 12px',
              fontSize: 'var(--fs-small)',
              borderRadius: 'var(--r-sm)',
              flexShrink: 0,
              marginLeft: 12
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>{t.common.skip}</span>
              <IconClose size={13} />
            </span>
          </button>
        </div>

        {/* F1：首块专属说明（放在标题栏下方整行，避免挤进标题 flex 行） */}
        {placedCount === 1 && (
          <div
            style={{
              fontSize: 'var(--fs-small)',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              padding: '10px 20px 0'
            }}
          >
            {t.blockDrop.firstBlockHint}
          </div>
        )}

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
              maxHeight: animated ? 176 : 0,
              opacity: animated ? 1 : 0,
              paddingTop: animated ? 12 : 0,
              paddingBottom: animated ? 14 : 0,
              paddingLeft: 18,
              paddingRight: 18,
              borderTopWidth: animated ? 1 : 0,
              pointerEvents: animated ? 'auto' : 'none'
            }}
          >
            {/*
              心境与收藏共用一整行（D-20261126-119）：★ 在最左、与胶囊同尺寸，
              8 个预设撑满 440px 弹窗的宽度，行尾是「+ 自定义」入口。
              上一版只放 4 个预设 + 行尾 ★，右侧留出一大块空白，且自定义入口与
              收藏挤在一起，看不出谁是干什么的。
            */}
            <div className="drop-engrave-mood-row drop-mood-toolbar">
              <button
                type="button"
                className={`star-toggle-btn${starred ? ' starred' : ''}`}
                onClick={() => {
                  cancelAutoClose()
                  setStarred((prev) => !prev)
                }}
                title={starred ? t.reflections.unstarTooltip : t.reflections.starTooltip}
                aria-pressed={starred}
              >
                <IconStar size={13} filled={starred} />
              </button>
              {/* 两行 4 列网格：★ 占首列、＋ 占末列，中间八个胶囊等宽铺满（D-20261126-119） */}
              <div className="drop-mood-grid">
                {QUICK_MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`micro-mood-chip${selectedMood === m && !moodNote ? ' active' : ''}`}
                    onClick={() => {
                      cancelAutoClose()
                      setMoodNote(undefined)
                      handleMoodToggle(m)
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconMood mood={m} size={12} style={{ flexShrink: 0 }} />
                    <span>{t.microMood[m]}</span>
                  </button>
                ))}
                {moodNote && (
                  <button
                    type="button"
                    className="micro-mood-chip active"
                    onClick={() => {
                      cancelAutoClose()
                      setMoodNote(undefined)
                    }}
                    style={{ gridColumn: '2 / -2' }}
                  >
                    <IconMoodCustom size={12} style={{ flexShrink: 0 }} />
                    <span>{moodNote}</span>
                  </button>
                )}
              </div>
              {/* ＋ 自定义心境：与卡片里同一个入口 */}
              <button
                type="button"
                className={`star-toggle-btn${moodNote ? ' starred' : ''}`}
                onClick={() => {
                  cancelAutoClose()
                  setMoodPickerOpen(true)
                }}
                title={t.moodDialog.title}
                aria-label={t.moodDialog.title}
              >
                <IconPlus size={13} />
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
                style={{
                  padding: '6px 14px',
                  fontSize: 'var(--fs-small)',
                  borderRadius: 'var(--r-sm)'
                }}
                disabled={engraved}
                onClick={handleEngraveSubmit}
              >
                {engraved ? (
                  <IconCheck
                    size={14}
                    style={{ display: 'inline-block', verticalAlign: 'middle' }}
                  />
                ) : (
                  t.reflections.engraveAction
                )}
              </button>
            </div>
          </div>
        )}

        {/* 底部蓝图进度 */}
        <div
          style={{
            padding: '12px 20px 14px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--line)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              fontSize: 'var(--fs-body)'
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
              borderRadius: 'var(--r-xs)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: complete ? 'var(--progress-green)' : 'var(--ink)',
                borderRadius: 'var(--r-xs)',
                transition: 'width var(--dur-xl) var(--ease-default)'
              }}
            />
          </div>
        </div>
      </div>

      {moodPickerOpen && (
        <MoodPickerDialog
          layer={110}
          mood={selectedMood}
          moodNote={moodNote}
          onClose={() => setMoodPickerOpen(false)}
          onPickMood={(next) => {
            cancelAutoClose()
            setMoodNote(undefined)
            setSelectedMood(next ?? undefined)
          }}
          onPickNote={(text) => {
            cancelAutoClose()
            if (!text.trim()) {
              setMoodNote(undefined)
              return
            }
            setSelectedMood(undefined)
            setMoodNote(text.trim())
          }}
        />
      )}
    </div>
  )
}
