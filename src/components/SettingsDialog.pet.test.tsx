import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '../i18n'
import { useAppStore } from '../store/appStore'
import { defaultState } from '../store/appStoreHelpers'
import { SyncProvider } from '../sync/SyncProvider'
import { SettingsDialog } from './SettingsDialog'

const t = getTranslation('zh')
let container: HTMLDivElement
let root: Root

function renderSettings(onOpenPetBlueprints?: () => void): void {
  act(() => {
    root.render(
      <SyncProvider>
        <SettingsDialog
          onClose={() => {}}
          openPetModels
          onOpenPetBlueprints={onOpenPetBlueprints}
        />
      </SyncProvider>
    )
  })
}

function modelButton(name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === name
  )
  if (!button) throw new Error(`missing model button: ${name}`)
  return button
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const state = defaultState()
  useAppStore.setState({ ...state, settings: { ...state.settings, language: 'zh' } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('桌宠形象设置', () => {
  it('直接进入时展开实验室，锁定按钮转到桌宠蓝图而不写入选择', () => {
    const openBlueprints = vi.fn()
    renderSettings(openBlueprints)
    const lab = Array.from(container.querySelectorAll('[aria-expanded]')).find((item) =>
      item.textContent?.includes(t.settings.labTitle)
    )
    expect(lab?.getAttribute('aria-expanded')).toBe('true')
    expect(modelButton(t.pet.modelNames.block).getAttribute('aria-pressed')).toBe('true')
    expect(modelButton(t.pet.modelNames.cat).disabled).toBe(true)
    expect(container.textContent).toContain(t.pet.locked(t.build.blocksCount(0, 12)))
    const target = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) =>
        candidate.getAttribute('aria-label')?.includes(t.pet.modelNames.cat) &&
        candidate.textContent?.includes(t.pet.viewBlueprints)
    )
    expect(target).toBeDefined()
    act(() => target!.click())
    expect(openBlueprints).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().settings.petModel).toBe('block')
    expect(useAppStore.getState().activeBlueprintId).toBe('plant')
  })

  it('实际打卡满 12 块只解锁方块猫，选用后撤销最后一块就回退', () => {
    const store = useAppStore.getState()
    store.chooseBlueprint('pet-cat')
    const habits = Array.from({ length: 12 }, (_, index) =>
      store.addHabit(`Habit ${index + 1}`, { type: 'daily' })
    )
    for (const habit of habits.slice(0, -1)) store.checkIn(habit.id)
    renderSettings()
    expect(container.textContent).toContain(t.pet.locked(t.build.blocksCount(11, 12)))
    expect(modelButton(t.pet.modelNames.cat).disabled).toBe(true)

    act(() => {
      store.checkIn(habits[11].id)
    })
    expect(useAppStore.getState().builds).toHaveLength(12)
    expect(modelButton(t.pet.modelNames.bot).disabled).toBe(true)
    expect(modelButton(t.pet.modelNames.cat).disabled).toBe(false)
    expect(modelButton(t.pet.modelNames.block).getAttribute('aria-pressed')).toBe('true')
    act(() => modelButton(t.pet.modelNames.cat).click())
    expect(useAppStore.getState().settings.petModel).toBe('cat')
    expect(modelButton(t.pet.modelNames.cat).getAttribute('aria-pressed')).toBe('true')

    act(() => {
      store.uncheckIn(habits[11].id)
    })
    expect(container.textContent).toContain(t.pet.locked(t.build.blocksCount(11, 12)))
    expect(modelButton(t.pet.modelNames.cat).disabled).toBe(true)
    expect(modelButton(t.pet.modelNames.block).getAttribute('aria-pressed')).toBe('true')
    expect(useAppStore.getState().settings.petModel).toBe('cat')
  })
})
