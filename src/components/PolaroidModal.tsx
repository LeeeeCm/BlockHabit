import { useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { Blueprint, MicroMood } from '../types'
import { useAppStore } from '../store/appStore'
import { DEFAULT_ISO_CONFIG } from '../render/iso'
import { paintModelStage } from '../render/modelStage'
import { completionDateOfBuilds } from '../logic/buildingArchive'
import { getBlueprintName, useI18n } from '../i18n'
import { IconCamera, IconClose, IconFlip } from './Icons'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'

interface Props {
  blueprint: Blueprint
  onClose: () => void
}

/** 画布绘制用：读取主题 CSS 变量（星标色跟随唯一点缀色 --accent） */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * 拍立得落成纪念卡弹窗（支持双面手账翻转）：
 * - 正面：高精度 2.5D 模型照片、落成日期、建筑奠基石铭言；
 * - 背面：复古米黄手账相纸，印制建造期间打卡随笔时间线与建筑档案。
 */
export function PolaroidModal({ blueprint, onClose }: Props) {
  const { lang, t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [toast, showToast] = useTransient<string>(2500)
  const [copying, setCopying] = useState(false)
  const [isBack, setIsBack] = useState(false)

  const { ref: dialogRef } = useDialogA11y({ open: true, onClose })

  const foundationNotes = useAppStore((s) => s.foundationNotes ?? {})
  const builds = useAppStore((s) => s.builds)
  const checkIns = useAppStore((s) => s.checkIns)
  const habits = useAppStore((s) => s.habits)

  const foundationNote = foundationNotes[blueprint.id]

  // B1：按蓝图内序位取该块的 bonus 标记（蓝图数组顺序 = 拼建顺序 = PlacedBlock.index）
  const bonusByIndex = useMemo(() => {
    const list: boolean[] = []
    for (const b of builds) {
      if (b.blueprintId === blueprint.id) list[b.index] = b.bonus
    }
    return list
  }, [builds, blueprint.id])

  // 提取参与本建筑拼搭的所有随笔
  const blueprintNotes = useMemo(() => {
    const bpBuildIds = builds
      .filter((b) => b.blueprintId === blueprint.id)
      .map((b) => b.id)
    const list = checkIns.filter(
      (c) => !c.deletedAt && c.placedBlockId && bpBuildIds.includes(c.placedBlockId) && c.note?.trim(),
    )
    list.sort((a, b) => {
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      return a.date.localeCompare(b.date)
    })
    return list.slice(0, 4)
  }, [builds, checkIns, blueprint.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 拍立得卡片尺寸：500 × 640（2x 视网膜高清）
    const W = 500
    const H = 640
    canvas.width = W * 2
    canvas.height = H * 2
    ctx.scale(2, 2)

    const bpName = getBlueprintName(blueprint.id, lang)
    // 落成日口径（D-20261110-065，B5 收尾）：max(placedAt) 的本地日期，与档案卡 completedAt 同源；
    // 旧实现是 new Date()（今天）且取 UTC 日期 —— 既不是落成日，UTC+ 时区还会差一天。
    // 无有效 placedAt（旧档/坏时间戳）→「不可考」，不伪造日期。
    const completionDate =
      completionDateOfBuilds(builds, blueprint.id) ?? t.buildingArchive.unknownDate

    if (!isBack) {
      // ==================== 正面：3D 拍立得相纸 ====================
      // 1. 卡片底纸
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      // 2. 照片内框底色（微灰背景）
      const photoW = 440
      const photoH = 430
      const photoX = 30
      const photoY = 30
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(photoX, photoY, photoW, photoH)
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.strokeRect(photoX, photoY, photoW, photoH)

      // 3. 在照片框内绘制 3D 等距积木模型
      ctx.save()
      ctx.beginPath()
      ctx.rect(photoX, photoY, photoW, photoH)
      ctx.clip()

      const palette = {
        top: '#ffffff',
        left: '#e2e8f0',
        right: '#cbd5e1',
        ghost: 'rgba(0,0,0,0.06)',
        line: '#94a3b8',
        accent: '#c25e3e',
        ink: '#0f172a',
      }
      const cfg = DEFAULT_ISO_CONFIG

      // 照片框内 3D 模型：30/30 内边距、0.54 地面基准、1.5 缩放上限由 modelStage 承接
      paintModelStage(ctx, {
        blocks: blueprint.blocks,
        viewport: { x: photoX, y: photoY, w: photoW, h: photoH },
        pad: 30,
        maxScale: 1.5,
        baseline: 0.54,
        palette,
        cfg,
        bonusByIndex,
        spriteScale: 2,
      })
      ctx.restore()

      // 4. 照片底部文字与奠基石铭文
      ctx.fillStyle = '#0f172a'
      ctx.font = '700 20px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
      ctx.fillText(t.polaroid.cardTitle(bpName), photoX, photoY + photoH + 36)

      if (foundationNote) {
        ctx.fillStyle = '#b45309'
        ctx.font = 'italic 500 12.5px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
        let fText = `“${foundationNote}”`
        if (ctx.measureText(fText).width > photoW - 100) {
          while (fText.length > 4 && ctx.measureText(fText + '...').width > photoW - 100) {
            fText = fText.slice(0, -1)
          }
          fText += '...'
        }
        ctx.fillText(fText, photoX, photoY + photoH + 56)

        ctx.fillStyle = '#64748b'
        ctx.font = '500 12px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
        ctx.fillText(
          t.polaroid.cardDetails(blueprint.blocks.length, completionDate),
          photoX,
          photoY + photoH + 74,
        )
      } else {
        ctx.fillStyle = '#64748b'
        ctx.font = '500 13px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
        ctx.fillText(
          t.polaroid.cardDetails(blueprint.blocks.length, completionDate),
          photoX,
          photoY + photoH + 64,
        )
      }

      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 11px "Rubik", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('BlockHabit', W - photoX, H - 24)
    } else {
      // ==================== 背面：复古米黄手账纪事 ====================
      // 1. 底纸
      ctx.fillStyle = '#faf8f5'
      ctx.fillRect(0, 0, W, H)

      // 2. 边缘复古线框
      ctx.strokeStyle = '#e7e2d7'
      ctx.lineWidth = 1
      ctx.strokeRect(18, 18, W - 36, H - 36)
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = '#d6cebf'
      ctx.strokeRect(24, 24, W - 48, H - 48)
      ctx.setLineDash([])

      // 3. 头部标题
      ctx.fillStyle = '#292524'
      ctx.font = '700 20px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
      ctx.fillText(`${bpName} · ${t.polaroid.builderChronicle}`, 38, 56)

      ctx.fillStyle = '#a8a29e'
      ctx.font = '600 11px "Rubik", sans-serif'
      ctx.fillText('BLOCKHABIT ARCHITECTURAL LOG', 38, 74)

      // 4. 奠基石印章卡片
      const stampY = 88
      const stampH = 58
      ctx.fillStyle = '#f2ede4'
      ctx.beginPath()
      ctx.roundRect(38, stampY, W - 76, stampH, 8)
      ctx.fill()
      ctx.strokeStyle = '#e0d6c5'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#b45309'
      ctx.font = '700 11px "Rubik", "MiSans", sans-serif'
      ctx.fillText(t.polaroid.foundationInscription, 48, stampY + 20)

      ctx.fillStyle = '#44403c'
      ctx.font = 'italic 500 12.5px "Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
      const defaultDedication = t.polaroid.defaultDedication
      const rawDedication = `“${foundationNote || defaultDedication}”`
      let quoteStr = rawDedication
      const maxStampW = W - 110
      if (ctx.measureText(quoteStr).width > maxStampW) {
        while (quoteStr.length > 4 && ctx.measureText(quoteStr + '...').width > maxStampW) {
          quoteStr = quoteStr.slice(0, -1)
        }
        quoteStr += '...'
      }
      ctx.fillText(quoteStr, 48, stampY + 42)

      const listStartY = 168
      if (blueprintNotes.length > 0) {
        ctx.fillStyle = '#78716c'

        // 竖向时间轴导轨线
        ctx.strokeStyle = '#e7e2d7'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(48, listStartY + 16)
        ctx.lineTo(48, listStartY + blueprintNotes.length * 82)
        ctx.stroke()

        blueprintNotes.forEach((entry, idx) => {
          const itemY = listStartY + 20 + idx * 82
          const h = habits.find((x) => x.id === entry.habitId)

          // 节点圆圈
          ctx.beginPath()
          ctx.arc(48, itemY + 8, 4, 0, Math.PI * 2)
          ctx.fillStyle = entry.starred ? cssVar('--accent', '#f5b301') : '#a8a29e'
          ctx.fill()

          // 标题行：日期 + 习惯 + 心境
          ctx.fillStyle = '#78716c'
          ctx.font = '600 11px "Rubik", "MiSans", sans-serif'
          const metaText = t.reflections.brickInspectFrom(h?.name || '—', entry.date)
          ctx.fillText(metaText, 62, itemY + 10)

          if (entry.mood) {
            ctx.fillStyle = '#b45309'
            ctx.font = '600 10.5px "Rubik", "MiSans", sans-serif'
            ctx.textAlign = 'right'
            ctx.fillText(t.microMood[entry.mood as MicroMood], W - 44, itemY + 10)
          }

          // 随笔正文
          ctx.fillStyle = '#292524'
          ctx.font = '400 12px "Rubik", "MiSans", sans-serif'
          let nText = entry.note || ''
          const maxNoteW = W - 110
          if (ctx.measureText(nText).width > maxNoteW) {
            while (nText.length > 3 && ctx.measureText(nText + '...').width > maxNoteW) {
              nText = nText.slice(0, -1)
            }
            nText += '...'
          }
          ctx.fillText(`“${nText}”`, 62, itemY + 28)
        })
      } else {
        // 无随笔时的极简提示
        ctx.fillStyle = '#a8a29e'
        ctx.font = 'italic 12.5px "Rubik", "MiSans", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(t.polaroid.emptyNotesHint, W / 2, 320)
        ctx.textAlign = 'left'
      }

      // 6. 底部档案印鉴
      const footerY = H - 46
      ctx.strokeStyle = '#e7e2d7'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(38, footerY)
      ctx.lineTo(W - 38, footerY)
      ctx.stroke()

      ctx.fillStyle = '#a8a29e'
      ctx.font = '600 11px "Rubik", "MiSans", sans-serif'
      ctx.fillText(`${t.polaroid.cardDetails(blueprint.blocks.length, completionDate)}`, 38, footerY + 20)

      ctx.textAlign = 'right'
      ctx.fillText('BLOCKHABIT CHRONICLE', W - 38, footerY + 20)
      ctx.textAlign = 'left'
    }
  }, [blueprint, builds, lang, t, isBack, foundationNote, blueprintNotes, habits])

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
        showToast(t.polaroid.copiedToast, 2500)
      } catch {
        showToast(t.polaroid.copyFailedToast, 2500)
      }
      setCopying(false)
    })
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `blockhabit-${blueprint.id}-${isBack ? 'journal' : 'photo'}.png`
    a.click()
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={isBack ? t.polaroid.modalTitleBack : t.polaroid.modalTitle}
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 120 }}
    >
      <div
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 560,
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--fs-title)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconCamera size={18} />
            <span>{isBack ? t.polaroid.modalTitleBack : t.polaroid.modalTitle}</span>
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

        {/* 拍立得预览画布 */}
        <canvas
          ref={canvasRef}
          style={{
            width: 320,
            height: 410,
            borderRadius: 8,
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            border: '1px solid var(--line)',
            display: 'block',
            transition: 'transform var(--dur-lg) var(--ease-bounce)',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn ghost"
            onClick={() => setIsBack((prev) => !prev)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title={t.polaroid.flipTooltip}
          >
            <IconFlip size={14} style={{ flexShrink: 0 }} />
            <span>{isBack ? t.polaroid.viewFront : t.polaroid.viewBack}</span>
          </button>
          <button className="btn ghost" onClick={handleDownload}>
            {t.polaroid.savePng}
          </button>
          <button className="btn primary" disabled={copying} onClick={handleCopy}>
            {t.polaroid.copyImage}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
