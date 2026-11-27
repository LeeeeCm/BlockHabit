import type { Language } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { getBlueprintName } from '../../i18n'
import { blueprints } from '../../logic/blueprints'
import { BlueprintThumb } from '../BlueprintThumb'

export interface YardElsewhereEntry {
  id: string
  sandboxIndex: number
}

interface Props {
  available: string[]
  elsewhere: YardElsewhereEntry[]
  language: Language
  t: TranslationSchema
  onPlace: (blueprintId: string) => void
}

/** 右抽屉：堆场——未陈列建筑与「在其他沙盘」分组，点击即放上当前沙盘（D-20261127-127） */
export function BuildingYard({ available, elsewhere, language, t, onPlace }: Props) {
  const isEmpty = available.length === 0 && elsewhere.length === 0

  function renderRow(id: string, meta?: string, silhouette = false) {
    const blueprint = blueprints[id]
    if (!blueprint) return null
    const name = getBlueprintName(id, language)
    return (
      <button
        key={id}
        type="button"
        className="sc-yard-row"
        title={name}
        onClick={() => onPlace(id)}
      >
        <span className="sc-yard-thumb" aria-hidden="true">
          <BlueprintThumb blueprint={blueprint} width={84} height={56} silhouette={silhouette} />
        </span>
        <span className="sc-yard-text">
          <span className="sc-yard-name">{name}</span>
          {meta && <span className="sc-yard-meta">{meta}</span>}
        </span>
        <span className="sc-yard-action" aria-hidden="true">
          {t.showcase.yardPlace}
        </span>
      </button>
    )
  }

  return (
    <div className="sc-panel-content">
      {isEmpty && <div className="sc-empty">{t.showcase.yardEmpty}</div>}

      {available.length > 0 && (
        <div className="sc-list">{available.map((id) => renderRow(id))}</div>
      )}

      {elsewhere.length > 0 && (
        <>
          <div className="sc-section-title sc-spaced-title">{t.showcase.yardElsewhere}</div>
          <div className="sc-list">
            {elsewhere.map((entry) =>
              renderRow(entry.id, t.showcase.sandboxName(entry.sandboxIndex + 1), true)
            )}
          </div>
        </>
      )}
    </div>
  )
}
