import { useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { getBlueprint } from '../logic/blueprints'
import {
  DEFAULT_ISO_CONFIG,
  drawCube,
  drawGroundBase,
  paletteFromDocument,
  STUD_H,
  worldToScreen,
} from '../render/iso'
import { getBlueprintName, useI18n } from '../i18n'
import { dateKey } from '../logic/dates'
import { dayCompletionRatio } from '../logic/checkin'
import { bestStreak, currentStreak } from '../logic/streak'
import { IconClose, IconPoster, IconShuffle } from './Icons'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'
interface Props {
  onClose: () => void
}

/**
 * 月度包豪斯自律画报弹窗：
 * 2K 高清离屏 Canvas 渲染、包含当月落成模型、30 天积木热力矩阵、自律指标与包豪斯网格排版。
 * 完美适配纸白/墨黑/燕麦陶土/北欧雾灰四套主题色，支持一键保存图片与复制到剪贴板。
 */
export function MonthlyPosterModal({ onClose }: Props) {
  const { lang, t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [toast, showToast] = useTransient<string>(2500)
  const [copying, setCopying] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'4:5' | '9:16' | '1:1'>('4:5')
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const completed = useAppStore((s) => s.completedBlueprintIds)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = String(month).padStart(2, '0')
  const monthPrefix = `${year}-${monthStr}`

  const monthNotes = useMemo(() => {
    const list = checkIns.filter((c) => !c.deletedAt && c.date.startsWith(monthPrefix) && c.note?.trim())
    list.sort((a, b) => {
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      return b.date.localeCompare(a.date)
    })
    return list
  }, [checkIns, monthPrefix])

  const [quoteIdx, setQuoteIdx] = useState(0)
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose })


  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dimMap = {
      '4:5': { W: 600, H: 750 },
      '9:16': { W: 540, H: 960 },
      '1:1': { W: 600, H: 600 },
    }
    const { W, H } = dimMap[aspectRatio]
    canvas.width = W * 2
    canvas.height = H * 2
    ctx.scale(2, 2)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const monthStr = String(month).padStart(2, '0')
    const monthPrefix = `${year}-${monthStr}`
    const daysInMonth = new Date(year, month, 0).getDate()

    // 读取当前主题 CSS 变量色彩
    const style = getComputedStyle(document.documentElement)
    const colorBg = style.getPropertyValue('--bg').trim() || '#f7f4ee'
    const colorSurface = style.getPropertyValue('--surface').trim() || '#ffffff'
    const colorInk = style.getPropertyValue('--ink').trim() || '#292524'
    const colorInk2 = style.getPropertyValue('--ink-2').trim() || '#78716c'
    const colorLine = style.getPropertyValue('--line').trim() || '#e7e2d7'
    const colorAccent = style.getPropertyValue('--accent').trim() || '#c25e3e'
    const colorGreen = style.getPropertyValue('--progress-green').trim() || '#3a835b'

    // 1. 画报底纸
    ctx.fillStyle = colorBg
    ctx.fillRect(0, 0, W, H)

    // 外边缘 16px 留白框
    const margin = 24
    const innerW = W - margin * 2

    // 2. 顶部包豪斯排印栏
    ctx.fillStyle = colorInk
    ctx.font = '700 36px "Rubik", sans-serif'
    ctx.fillText(`${year}.${monthStr}`, margin, margin + 30)

    ctx.font = '700 15px "Rubik", sans-serif'
    ctx.fillStyle = colorAccent
    const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    ctx.textAlign = 'right'
    ctx.fillText(MONTH_EN[month - 1] || 'MONTH', W - margin, margin + 16)

    ctx.font = '600 12px "Rubik", "MiSans", sans-serif'
    ctx.fillStyle = colorInk2
    ctx.fillText(t.poster.disciplineChronicle, W - margin, margin + 32)
    ctx.textAlign = 'left'

    // 分割线
    ctx.strokeStyle = colorLine
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(margin, margin + 44)
    ctx.lineTo(W - margin, margin + 44)
    ctx.stroke()

    // 3. 中央 3D 建筑英雄舞台
    const stageY = margin + 54
    const stageH = 240
    ctx.fillStyle = colorSurface
    ctx.beginPath()
    ctx.roundRect(margin, stageY, innerW, stageH, 14)
    ctx.fill()
    ctx.strokeStyle = colorLine
    ctx.stroke()

    // 渲染当前建造目标的真实进度
    const blueprint = getBlueprint(activeBlueprintId)
    const bpName = getBlueprintName(activeBlueprintId, lang)
    const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const totalBlocks = blueprint.blocks.length
    const isComplete = placedCount >= totalBlocks
    const palette = paletteFromDocument()
    const cfg = DEFAULT_ISO_CONFIG

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(margin, stageY, innerW, stageH, 16)
    ctx.clip()

    let minBx = Infinity, maxBx = -Infinity, minBy = Infinity, maxBy = -Infinity
    for (const b of blueprint.blocks) {
      minBx = Math.min(minBx, b.x)
      maxBx = Math.max(maxBx, b.x)
      minBy = Math.min(minBy, b.y)
      maxBy = Math.max(maxBy, b.y)
    }
    const cx = Math.round((minBx + maxBx) / 2)
    const cy = Math.round((minBy + maxBy) / 2)

    const xs: number[] = []
    const ys: number[] = []
    for (const b of blueprint.blocks) {
      const { sx, sy } = worldToScreen(b.x, b.y, b.z, cfg)
      xs.push(sx + cfg.tileW / 2, sx - cfg.tileW / 2)
      ys.push(sy + cfg.tileH / 2 + cfg.blockH, sy - cfg.tileH / 2 - STUD_H)
    }
    const mMinX = Math.min(...xs)
    const mMaxX = Math.max(...xs)
    const mMinY = Math.min(...ys)
    const mMaxY = Math.max(...ys)

    const scale = Math.min((innerW - 60) / (mMaxX - mMinX), (stageH - 50) / (mMaxY - mMinY), 1.5)
    const panX = margin + innerW / 2 - ((mMinX + mMaxX) / 2) * scale
    const panY = stageY + stageH * 0.54 - ((mMinY + mMaxY) / 2) * scale

    ctx.translate(panX, panY)
    ctx.scale(scale, scale)

    drawGroundBase(ctx, blueprint.blocks, cfg, palette, 0, cx, cy)

    const visibleBlocks = isComplete ? blueprint.blocks : blueprint.blocks.slice(0, placedCount)
    // B1：visibleBlocks 与 blueprint.blocks 前段一一对应，序位即 PlacedBlock.index
    const bonusByIndex: boolean[] = []
    for (const b of builds) {
      if (b.blueprintId === blueprint.id) bonusByIndex[b.index] = b.bonus
    }
    const cubes = visibleBlocks
      .map((b, i) => ({ b, i }))
      .sort((m, n) => {
        const a = m.b.x + m.b.y
        const c = n.b.x + n.b.y
        if (a !== c) return a - c
        return m.b.z - n.b.z
      })

    const indexAt = new Map<string, number>()
    visibleBlocks.forEach((b, i) => indexAt.set(`${b.x},${b.y},${b.z}`, i))

    for (const { b, i } of cubes) {
      const aboveIdx = indexAt.get(`${b.x},${b.y},${b.z + 1}`)
      const { sx: px, sy: py } = worldToScreen(b.x, b.y, b.z, cfg)
      drawCube(ctx, px, py, cfg, palette, {
        type: b.type,
        color: b.color,
        noStuds: aboveIdx !== undefined,
        bonus: bonusByIndex[i] === true,
        // 导出画布固定 2x 变换：精灵密度必须对齐，否则 1x 屏导出图块面模糊
        spriteScale: 2,
      })
    }
    ctx.restore()

    // 建筑标签与实时进度徽章
    ctx.fillStyle = colorInk
    ctx.font = '700 19px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
    // 画布例外：中英文书名号《》与引号""排版规范差异
    ctx.fillText(lang === 'zh' ? `《${bpName}》` : `"${bpName}"`, margin + 18, stageY + 30)
    ctx.font = '600 13px "Rubik", "MiSans", sans-serif'
    ctx.fillStyle = isComplete ? colorGreen : colorAccent
    const progressText = isComplete
      ? t.poster.completedTotal(totalBlocks)
      : placedCount === 0
        ? t.poster.foundationReady(totalBlocks)
        : t.poster.buildingProgress(placedCount, totalBlocks, Math.round((placedCount / totalBlocks) * 100))
    ctx.fillText(progressText, margin + 18, stageY + 48)

    // 4. 当月 30 天积木热力矩阵 (30-Day Brick Matrix)
    const matrixY = stageY + stageH + 14
    ctx.fillStyle = colorInk
    ctx.font = '700 15px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
    ctx.fillText(t.poster.matrixTitle, margin, matrixY + 12)

    const cellSize = 25
    const cellGap = 5
    const cols = 7
    const matrixGridX = margin
    const matrixGridY = matrixY + 24
    const matrixTotalW = cols * (cellSize + cellGap) - cellGap

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dKey = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`
      const ratio = dayCompletionRatio(habits, checkIns, dKey)
      const dayDate = new Date(dKey + 'T00:00:00')
      const isFuture = dayDate > now

      const colIdx = (dayNum - 1) % cols
      const rowIdx = Math.floor((dayNum - 1) / cols)
      const cxPos = matrixGridX + colIdx * (cellSize + cellGap)
      const cyPos = matrixGridY + rowIdx * (cellSize + cellGap)

      ctx.beginPath()
      ctx.roundRect(cxPos, cyPos, cellSize, cellSize, 4)

      if (isFuture) {
        ctx.strokeStyle = colorLine
        ctx.lineWidth = 1
        ctx.stroke()
      } else if (ratio >= 1) {
        ctx.fillStyle = colorGreen
        ctx.fill()
      } else if (ratio > 0) {
        ctx.fillStyle = colorAccent
        ctx.fill()
      } else {
        ctx.fillStyle = 'color-mix(in srgb, ' + colorInk + ' 6%, transparent)'
        ctx.fill()
        ctx.strokeStyle = colorLine
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // 单元格数字
      ctx.fillStyle = ratio > 0 && !isFuture ? '#ffffff' : colorInk2
      ctx.font = '700 11px "Rubik", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(dayNum), cxPos + cellSize / 2, cyPos + cellSize / 2 + 3.8)
      ctx.textAlign = 'left'
    }

    // 5. 核心指标卡片 (Metrics Grid)
    const metricsX = matrixGridX + matrixTotalW + 18
    const metricsW = W - margin - metricsX
    const monthCheckIns = checkIns.filter((c) => !c.deletedAt && c.date.startsWith(monthPrefix)).length
    const monthFocusMins = checkIns
      .filter((c) => c.date.startsWith(monthPrefix))
      .reduce((s, c) => s + (c.actualMinutes ?? 0), 0)
    const monthBlocks = builds.filter((b) => dateKey(new Date(b.placedAt)).startsWith(monthPrefix)).length

    const activeHabits = habits.filter((h) => !h.archivedAt)
    let best = 0
    let curr = 0
    for (const h of activeHabits) {
      curr = Math.max(curr, currentStreak(h, checkIns, now))
      best = Math.max(best, bestStreak(h, checkIns))
    }

    const metrics = [
      { label: t.poster.metricCheckIns, val: `${monthCheckIns}` },
      { label: t.poster.metricFocusTime, val: `${(monthFocusMins / 60).toFixed(1)}h` },
      { label: t.poster.metricBlocksAdded, val: `+${monthBlocks}` },
      { label: t.poster.metricStreak, val: `${curr}d` },
    ]

    const mCellH = 43
    metrics.forEach((m, idx) => {
      const my = matrixGridY + idx * (mCellH + 5)
      ctx.fillStyle = colorSurface
      ctx.beginPath()
      ctx.roundRect(metricsX, my, metricsW, mCellH, 8)
      ctx.fill()
      ctx.strokeStyle = colorLine
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = colorInk2
      ctx.font = '600 13px "Rubik", "MiSans", sans-serif'
      ctx.fillText(m.label, metricsX + 14, my + 26)

      ctx.fillStyle = colorInk
      ctx.font = '700 19px "Rubik", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(m.val, metricsX + metricsW - 14, my + 27)
      ctx.textAlign = 'left'
    })

    // 6. 底部自律寄语与专属印鉴
    const footerY = H - 58
    ctx.strokeStyle = colorLine
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(margin, footerY)
    ctx.lineTo(W - margin, footerY)
    ctx.stroke()
    const currentNote = monthNotes[quoteIdx % monthNotes.length]
    ctx.fillStyle = colorInk
    ctx.font = '500 13px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
    const defaultQuote = t.poster.defaultQuote
    const quoteText = currentNote ? `“${currentNote.note}”` : defaultQuote
    const maxQuoteW = innerW - 170
    let displayQuote = quoteText
    if (ctx.measureText(displayQuote).width > maxQuoteW) {
      while (displayQuote.length > 3 && ctx.measureText(displayQuote + '...').width > maxQuoteW) {
        displayQuote = displayQuote.slice(0, -1)
      }
      displayQuote += '...'
    }
    ctx.fillText(displayQuote, margin, footerY + 22)

    ctx.fillStyle = colorInk2
    ctx.font = '700 10.5px "Rubik", sans-serif'
    ctx.textAlign = 'right'
    const rightTag = currentNote
      ? t.poster.builderRecord(currentNote.date)
      : 'BLOCKHABIT CHRONICLE'
    ctx.fillText(rightTag, W - margin, footerY + 22)
    ctx.textAlign = 'left'
  }, [habits, checkIns, builds, activeBlueprintId, completed, lang, monthNotes, quoteIdx, aspectRatio])

  async function handleCopy() {
    const canvas = canvasRef.current
    if (!canvas) return
    setCopying(true)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setCopying(false)
        return
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        showToast(t.poster.copySuccess, 2500)
      } catch {
        showToast(t.poster.copyFail, 2500)
      }
      setCopying(false)
    })
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    const now = new Date()
    a.href = url
    a.download = `blockhabit-poster-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.png`
    a.click()
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.poster.modalTitle}
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 120 }}
    >
      <div
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 600,
          maxHeight: '94vh',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--fs-title)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPoster size={18} />
            <span>{t.poster.modalTitle}</span>
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

        {/* 画报比例选择器 (Apple Segmented Control) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div className="apple-segmented">
            {(['4:5', '9:16', '1:1'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`apple-segmented-item${aspectRatio === r ? ' active' : ''}`}
                style={{ padding: '3px 14px', fontSize: 'var(--fs-small)' }}
                onClick={() => {
                  triggerHaptic('selection')
                  setAspectRatio(r)
                }}
              >
                {r === '4:5' ? t.poster.ratioCard45 : r === '9:16' ? t.poster.ratioStory916 : t.poster.ratioSquare11}
              </button>
            ))}
          </div>
        </div>

        {/* 画报预览视口 */}
        <canvas
          ref={canvasRef}
          style={{
            width: aspectRatio === '4:5' ? 360 : aspectRatio === '9:16' ? 280 : 400,
            height: aspectRatio === '4:5' ? 450 : aspectRatio === '9:16' ? 498 : 400,
            maxWidth: '85vw',
            maxHeight: '60vh',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            border: '1px solid var(--line)',
            display: 'block',
            margin: '0 auto',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {monthNotes.length > 1 && (
            <button
              className="btn ghost"
              onClick={() => setQuoteIdx((prev) => (prev + 1) % monthNotes.length)}
              style={{ fontSize: 'var(--fs-small)', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title={t.poster.cycleQuoteTooltip}
            >
              <IconShuffle size={13} style={{ flexShrink: 0 }} />
              <span>
                {t.poster.cycleQuote((quoteIdx % monthNotes.length) + 1, monthNotes.length)}
              </span>
            </button>
          )}
          <button className="btn ghost" onClick={handleDownload}>
            {t.poster.saveImage}
          </button>
          <button className="btn primary" disabled={copying} onClick={handleCopy}>
            {t.poster.copyImage}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
