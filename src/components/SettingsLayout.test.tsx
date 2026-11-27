import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsFooter } from './settings/SettingsFooter'
import { PetSettingsGroup } from './settings/PetSettingsGroup'
import { HabitImportPanel } from './HabitImportPanel'
import { ArchiveDataPanel, DiagnosticsExportPanel } from './ArchiveDataPanel'
import { useAppStore } from '../store/appStore'
import { zh } from '../i18n/locales/zh'
import { REPAIR_MAX } from '../logic/repairBricks'
import { PET_COLORS } from '../pet/types'

/**
 * D-20261126-114 设置页布局回归：
 * - 修复积木上限与统计页同源（REPAIR_MAX = 4），不再写死 2；
 * - 单个/多个动作按钮都占满行宽（.settings-actions 等分），说明文字在按钮下方独立成行；
 * - 桌宠色板铺满行宽且材质色数量够排满网格。
 */

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  }
}

beforeEach(() => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('设置页动作按钮填满行宽（D-20261126-114）', () => {
  it('导出备份 / 导入备份 两列同宽，共用 .settings-actions', () => {
    const { container, unmount } = render(<ArchiveDataPanel onImportFile={vi.fn()} />)
    const rows = container.querySelectorAll('.settings-actions')
    expect(rows.length).toBeGreaterThan(0)
    const firstRow = rows[0] as HTMLElement
    const buttons = Array.from(firstRow.querySelectorAll(':scope > .btn'))
    expect(buttons.length).toBe(2)
    unmount()
  })

  it('单个按钮（选择文件 / 导出诊断包）同样挂 .settings-actions，占满行宽', () => {
    const importPanel = render(<HabitImportPanel onToast={vi.fn()} />)
    const chooseRow = importPanel.container.querySelector('.settings-actions') as HTMLElement
    expect(chooseRow).toBeDefined()
    expect(chooseRow.querySelectorAll(':scope > .btn').length).toBe(1)
    importPanel.unmount()

    const diag = render(<DiagnosticsExportPanel onToast={vi.fn()} />)
    const diagRow = diag.container.querySelector('.settings-actions') as HTMLElement
    expect(diagRow).toBeDefined()
    expect(diagRow.querySelectorAll(':scope > .btn').length).toBe(1)
    diag.unmount()
  })

  it('诊断包说明文字在按钮下方独立成行，不与按钮同排', () => {
    const { container, unmount } = render(<DiagnosticsExportPanel onToast={vi.fn()} />)
    const row = container.querySelector('.settings-actions') as HTMLElement
    const hint = container.querySelector('.settings-hint') as HTMLElement
    expect(hint).toBeDefined()
    expect(hint.textContent).toContain(zh.settings.diagnosticsHint)
    expect(row.contains(hint)).toBe(false)
    unmount()
  })
})

describe('修复积木上限与统计页一致（D-20261126-114）', () => {
  it('设置页显示 x / 4，与 REPAIR_MAX 同源', () => {
    const { container, unmount } = render(
      <SettingsFooter habits={[]} completedCount={0} repairBricks={2} t={zh} />
    )
    expect(REPAIR_MAX).toBe(4)
    expect(container.textContent).toContain(`2 / ${REPAIR_MAX}`)
    expect(container.textContent).not.toContain('/ 2')
    unmount()
  })
})

describe('桌宠色板铺满行宽（D-20261126-114）', () => {
  it('色板使用等分网格，且材质色 + 跟随主题排满整数行', () => {
    const { container, unmount } = render(
      <PetSettingsGroup
        settings={{ ...useAppStore.getState().settings, language: 'zh' }}
        t={zh}
        onUpdateSettings={vi.fn()}
      />
    )
    const grid = container.querySelector('.settings-swatch-grid') as HTMLElement
    expect(grid).toBeDefined()
    const swatches = grid.querySelectorAll('.settings-swatch')
    expect(swatches.length).toBe(PET_COLORS.length)
    // 跟随主题 + 11 个材质色 = 12 格，6 列整两行
    expect(grid.children.length).toBe(PET_COLORS.length + 1)
    expect(grid.children.length % 6).toBe(0)
    unmount()
  })
})
