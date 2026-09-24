import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { canSelectBlueprint } from '../logic/blueprint'
import { getBlueprintName, useI18n } from '../i18n'
/** 模型图鉴：按顺序解锁，前一座未落成时后一座不可选 */
export function GalleryDialog({ onClose }: { onClose: () => void }) {
  const { lang, t } = useI18n()
  const builds = useAppStore((s) => s.builds)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const activeId = useAppStore((s) => s.activeBlueprintId)
  const choose = useAppStore((s) => s.chooseBlueprint)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSelect(id: string) {
    if (!canSelectBlueprint(id, completed)) {
      setToast(lang === 'zh' ? '请完成上一个积木拼装任务' : 'Please complete the previous building first')
      setTimeout(() => setToast(null), 2200)
      return
    }
    choose(id)
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3>{t.gallery.title} · {blueprintOrder.length}</h3>
          <button className="icon-btn" onClick={onClose} title={t.common.close}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
        <div className="gallery-grid">
          {blueprintOrder.map((id) => {
            const bp = getBlueprint(id)
            const placed = builds.filter((b) => b.blueprintId === id).length
            const done = completed.includes(id)
            const building = id === activeId && !done
            const unlocked = canSelectBlueprint(id, completed)
            const bpName = getBlueprintName(id, lang)
            const status = done
              ? { label: `${t.gallery.completed} · ${t.build.blocksCount(bp.blocks.length, bp.blocks.length)}`, color: 'var(--progress-green)' }
              : building
                ? { label: `${t.gallery.inProgress} · ${placed}/${bp.blocks.length}`, color: 'var(--progress-blue)' }
                : unlocked
                  ? { label: `${t.build.startBuildBtn} · ${t.build.blocksCount(bp.blocks.length, bp.blocks.length)}`, color: 'var(--ink-2)' }
                  : { label: t.gallery.locked, color: 'var(--ink-2)' }
            return (
              <button
                key={id}
                className={`gallery-card${unlocked ? '' : ' locked'}`}
                onClick={() => handleSelect(id)}
                title={unlocked ? bpName : (lang === 'zh' ? '请完成上一个积木拼装任务' : 'Please complete the previous building first')}
              >
                <div className="gallery-name">{bpName}</div>
                <div className="gallery-status" style={{ color: status.color }}>
                  {status.label}
                </div>
              </button>
            )
          })}
        </div>
        </div>

        <div className="dialog-footer">
          <button className="btn primary" onClick={onClose} style={{ padding: '7px 24px' }}>
            {t.common.close}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}
