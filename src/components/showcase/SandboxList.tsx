import type { SandboxDesign, ShowcaseSandbox } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { SANDBOX_DESIGNS } from '../../logic/showcase'
import { IconClose, IconPlus } from '../Icons'

interface Props {
  sandboxes: ShowcaseSandbox[]
  activeId: string
  design: SandboxDesign
  maxReached: boolean
  t: TranslationSchema
  onSwitch: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onDesign: (design: SandboxDesign) => void
}

/** 左抽屉：沙盘列表、新增/删除与当前沙盘颜色（D-20261128-129 只保留颜色选择） */
export function SandboxList({
  sandboxes,
  activeId,
  design,
  maxReached,
  t,
  onSwitch,
  onAdd,
  onRemove,
  onDesign
}: Props) {
  return (
    <div className="sc-panel-content">
      <div className="sc-list">
        {sandboxes.map((sandbox, index) => {
          const name = t.showcase.sandboxName(index + 1)
          const active = sandbox.id === activeId
          return (
            <div key={sandbox.id} className="sc-sandbox-row" data-active={active}>
              <button
                type="button"
                className="sc-sandbox-main"
                aria-pressed={active}
                onClick={() => onSwitch(sandbox.id)}
              >
                <span className="sc-sandbox-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="sc-sandbox-text">
                  <span className="sc-sandbox-name">{name}</span>
                  <span className="sc-sandbox-meta">
                    {t.showcase.buildingCount(sandbox.placements.length)} ·{' '}
                    {t.showcase.designs[sandbox.design ?? 'moss']}
                  </span>
                </span>
              </button>
              {sandboxes.length > 1 && (
                <button
                  type="button"
                  className="sc-icon-btn"
                  aria-label={`${t.showcase.removeSandbox} ${name}`}
                  title={t.showcase.removeSandbox}
                  onClick={() => onRemove(sandbox.id)}
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button type="button" className="btn ghost sc-wide-btn" disabled={maxReached} onClick={onAdd}>
        <IconPlus size={12} />
        <span>{t.showcase.addSandbox}</span>
      </button>
      {maxReached && <div className="sc-hint">{t.showcase.addSandboxFull}</div>}

      <div className="sc-section-title sc-spaced-title">{t.showcase.designLabel}</div>
      <div className="sc-design-grid">
        {SANDBOX_DESIGNS.map((option) => (
          <button
            key={option}
            type="button"
            className="sc-design-chip"
            data-active={option === design}
            aria-pressed={option === design}
            onClick={() => onDesign(option)}
          >
            <span className={`sc-design-dot sc-design-${option}`} aria-hidden="true" />
            <span>{t.showcase.designs[option]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
