import { useI18n } from '../i18n'
import { blueprintOrder, blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'

/**
 * 设置页「内容路线 / 关于」（C2 / D-20261110-063 §3.5.5 approved 范围）：
 * 如实展示当前内置内容版本、年度免费扩建节奏、跨设备升级说明与本地优先承诺。
 * 不写死未来内容包的日期；数字全部从内容 manifest 动态计算。
 */
export function AboutPanel() {
  const { t } = useI18n()
  const blueprintCount = blueprintOrder.length
  const blockCount = blueprintOrder.reduce(
    (sum, id) => sum + (blueprints[id]?.blocks.length ?? 0),
    0,
  )
  const rows: Array<{ title: string; body: string }> = [
    {
      title: t.settings.aboutPaceTitle,
      body: t.settings.aboutPaceBody,
    },
    {
      title: t.settings.aboutUpgradeTitle,
      body: t.settings.aboutUpgradeBody,
    },
    {
      title: t.settings.aboutLocalTitle,
      body: t.settings.aboutLocalBody,
    },
  ]
  return (
    <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink)' }}>
      <div style={{ lineHeight: 1.6 }}>
        {t.settings.aboutContent(blueprintCount, blockCount, CONTENT_VERSION)}
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.map((row, index) => (
          <div
            key={row.title}
            style={{
              borderTop: index === 0 ? 'none' : '1px solid var(--line)',
              padding: '8px 0 2px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 'var(--fs-small)' }}>{row.title}</div>
            <div style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)', lineHeight: 1.6, marginTop: 2 }}>
              {row.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
