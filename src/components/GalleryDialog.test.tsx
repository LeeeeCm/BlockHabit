import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GalleryDialog } from './GalleryDialog'
import { blueprintOrder, blueprints, plantBlueprint } from '../logic/blueprints'
import { canSelectBlueprint, firstIncompleteIndex } from '../logic/blueprint'
import { noBlockReason } from '../logic/blockHints'
import { useAppStore } from '../store/appStore'
import { zh } from '../i18n/locales/zh'

/**
 * B1：图鉴动态总数 + 锁定态剪影。
 * 运行时给 registry 追加 6 座扩展蓝图（与真实内容包同形状），验证 12→18 时：
 * 标题/卡片数/解锁顺序/档案入口都不炸，且未解锁卡片用剪影而不压暗名字。
 */

const ADDED_IDS = ['treehouse', 'greenhouse', 'clocktower', 'bridge', 'observatory', 'library']
const g = globalThis as unknown as { __galleryThumbProps?: Array<{ blueprintId: string; silhouette?: boolean }> }

vi.mock('./BlueprintThumb', () => ({
  BlueprintThumb: (props: { blueprint: { id: string }; silhouette?: boolean }) => {
    g.__galleryThumbProps = g.__galleryThumbProps ?? []
    g.__galleryThumbProps.push({ blueprintId: props.blueprint.id, silhouette: props.silhouette })
    return null
  },
}))

function addExtensionBlueprints(): void {
  for (const id of ADDED_IDS) {
    blueprintOrder.push(id)
    blueprints[id] = { ...plantBlueprint, id }
  }
}

function removeExtensionBlueprints(): void {
  for (const id of ADDED_IDS) delete blueprints[id]
  for (let i = blueprintOrder.length - 1; i >= 0; i--) {
    if (ADDED_IDS.includes(blueprintOrder[i])) blueprintOrder.splice(i, 1)
  }
}

function setState(over: { completedBlueprintIds?: string[]; activeBlueprintId?: string } = {}): void {
  const current = useAppStore.getState()
  useAppStore.setState({
    builds: [],
    completedBlueprintIds: over.completedBlueprintIds ?? [],
    activeBlueprintId: over.activeBlueprintId ?? blueprintOrder[0],
    settings: { ...current.settings, language: 'zh' },
  })
}

function renderGallery(onClose: () => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<GalleryDialog onClose={onClose} />)
  })
  return {
    container,
    title: () => container.querySelector('#gallery-dialog-title')?.textContent ?? '',
    cards: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.gallery-card')),
    lockedCards: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.gallery-card.locked')),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

beforeEach(() => {
  g.__galleryThumbProps = []
  setState()
})

afterEach(() => {
  removeExtensionBlueprints()
  document.body.innerHTML = ''
})

describe('图鉴动态总数（B1）', () => {
  it('标题与卡片数跟随 blueprintOrder 实际长度（当前安装包）', () => {
    const view = renderGallery(() => {})
    expect(view.title()).toContain(String(blueprintOrder.length))
    expect(view.cards()).toHaveLength(blueprintOrder.length)
    view.unmount()
  })

  it('12→18：标题 18、18 张卡、17 张剪影锁定卡，名字保持可读', () => {
    addExtensionBlueprints()
    expect(blueprintOrder).toHaveLength(18)
    const view = renderGallery(() => {})
    expect(view.title()).toContain('18')
    expect(view.cards()).toHaveLength(18)
    expect(view.lockedCards()).toHaveLength(17)

    // 锁定卡：不受 .gallery-card.locked 的 opacity:.5 压暗（名字可读）
    for (const card of view.lockedCards()) {
      expect(card.style.opacity).toBe('1')
      expect(card.querySelector('.gallery-name')?.textContent?.trim().length).toBeGreaterThan(0)
      expect(card.getAttribute('aria-disabled')).toBe('true')
    }
    // 缩略图：除第 1 座外全部以剪影渲染
    const props = g.__galleryThumbProps ?? []
    expect(props).toHaveLength(18)
    expect(props.filter((p) => p.silhouette === true)).toHaveLength(17)
    expect(props[0].silhouette).toBe(false)
    view.unmount()
  })

  it('18 座解锁顺序：已落成 13 座时第 14 座可选、第 15 座起锁定；点锁定卡只提示不关闭', () => {
    addExtensionBlueprints()
    const completed = blueprintOrder.slice(0, 13)
    setState({ completedBlueprintIds: completed })
    const onClose = vi.fn()
    const view = renderGallery(onClose)

    expect(view.lockedCards()).toHaveLength(4) // 第 15–18 座
    expect(canSelectBlueprint(blueprintOrder[13], completed)).toBe(true)
    expect(canSelectBlueprint(blueprintOrder[14], completed)).toBe(false)
    expect(firstIncompleteIndex(completed)).toBe(13)

    const lastCard = view.cards()[17]
    act(() => lastCard.click())
    expect(onClose).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(zh.gallery.completePreviousFirst)

    // 已落成 13 座各带「档案」入口（第 14 座未落成无入口）
    expect(view.container.querySelectorAll('button.pill-action')).toHaveLength(13)
    view.unmount()
  })

  it('动态 total 的 endgame 判定：18 座全部落成 → all-blueprints-complete，不依赖字面量 12', () => {
    expect(
      noBlockReason({ completedBlueprints: 18, blueprintTotal: 18, placedCount: 0, activeBlueprintBlocks: 24 }),
    ).toBe('all-blueprints-complete')
    expect(
      noBlockReason({ completedBlueprints: 12, blueprintTotal: 18, placedCount: 24, activeBlueprintBlocks: 24 }),
    ).toBe('active-blueprint-complete')
    expect(
      noBlockReason({ completedBlueprints: 11, blueprintTotal: 18, placedCount: 3, activeBlueprintBlocks: 24 }),
    ).toBe('normal')
    const all = [...blueprintOrder]
    expect(firstIncompleteIndex(all)).toBe(blueprintOrder.length)
    expect(canSelectBlueprint(blueprintOrder[blueprintOrder.length - 1], all)).toBe(true)
  })
})
