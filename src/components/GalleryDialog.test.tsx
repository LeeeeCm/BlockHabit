import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GalleryDialog } from './GalleryDialog'
import { blueprintOrder } from '../logic/blueprints'
import { canSelectBlueprint, firstIncompleteIndex } from '../logic/blueprint'
import { noBlockReason } from '../logic/blockHints'
import { useAppStore } from '../store/appStore'
import { zh } from '../i18n/locales/zh'

/**
 * B1 / D-20261111-070：图鉴总数、解锁顺序、锁定剪影全部跟随真实注册表。
 * 当前安装包 = 基础 12 座 + 内容包 v2 6 座 + v3 5 座 = 23 座。
 * 断言一律从 blueprintOrder.length 派生，v3 之后再加内容包不会假红。
 */

const INSTALLED_TOTAL = 23
const g = globalThis as unknown as { __galleryThumbProps?: Array<{ blueprintId: string; silhouette?: boolean }> }

vi.mock('./BlueprintThumb', () => ({
  BlueprintThumb: (props: { blueprint: { id: string }; silhouette?: boolean }) => {
    g.__galleryThumbProps = g.__galleryThumbProps ?? []
    g.__galleryThumbProps.push({ blueprintId: props.blueprint.id, silhouette: props.silhouette })
    return null
  },
}))

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
  document.body.innerHTML = ''
})

describe('图鉴动态总数（B1 / D-20261111-070）', () => {
  it('标题与卡片数跟随 blueprintOrder 实际长度（当前安装包 23 座）', () => {
    expect(blueprintOrder).toHaveLength(INSTALLED_TOTAL)
    const view = renderGallery(() => {})
    expect(view.title()).toContain(String(blueprintOrder.length))
    expect(view.cards()).toHaveLength(blueprintOrder.length)
    // 只有第一座可建，其余按顺序锁定
    expect(view.lockedCards()).toHaveLength(blueprintOrder.length - 1)
    view.unmount()
  })

  it('首座解锁、其余锁定：缩略图剪影渲染且名字保持可读', () => {
    const view = renderGallery(() => {})
    // 锁定卡：不受 .gallery-card.locked 的 opacity:.5 压暗（名字可读）
    for (const card of view.lockedCards()) {
      expect(card.style.opacity).toBe('1')
      expect(card.querySelector('.gallery-name')?.textContent?.trim().length).toBeGreaterThan(0)
      expect(card.getAttribute('aria-disabled')).toBe('true')
    }
    // 缩略图：除第 1 座外全部以剪影渲染
    const props = g.__galleryThumbProps ?? []
    expect(props).toHaveLength(blueprintOrder.length)
    expect(props.filter((p) => p.silhouette === true)).toHaveLength(blueprintOrder.length - 1)
    expect(props[0].silhouette).toBe(false)
    view.unmount()
  })

  it('解锁顺序动态：已完成 N-5 座时第 N-4 座可选、其后锁定；点锁定卡只提示不关闭', () => {
    const doneCount = blueprintOrder.length - 5
    const completed = blueprintOrder.slice(0, doneCount)
    setState({ completedBlueprintIds: completed })
    const onClose = vi.fn()
    const view = renderGallery(onClose)

    expect(view.lockedCards()).toHaveLength(4) // 最后 4 座
    expect(canSelectBlueprint(blueprintOrder[doneCount], completed)).toBe(true)
    expect(canSelectBlueprint(blueprintOrder[doneCount + 1], completed)).toBe(false)
    expect(firstIncompleteIndex(completed)).toBe(doneCount)

    const lastCard = view.cards()[blueprintOrder.length - 1]
    act(() => lastCard.click())
    expect(onClose).not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(zh.gallery.completePreviousFirst)

    // 已落成各座带「档案」入口（未落成的没有）
    expect(view.container.querySelectorAll('button.pill-action')).toHaveLength(doneCount)
    view.unmount()
  })

  it('动态 total 的 endgame 判定：全部 23 座落成 → all-blueprints-complete，不依赖字面量', () => {
    const total = blueprintOrder.length
    expect(
      noBlockReason({ completedBlueprints: total, blueprintTotal: total, placedCount: 0, activeBlueprintBlocks: 24 }),
    ).toBe('all-blueprints-complete')
    expect(
      noBlockReason({ completedBlueprints: 12, blueprintTotal: total, placedCount: 24, activeBlueprintBlocks: 24 }),
    ).toBe('active-blueprint-complete')
    expect(
      noBlockReason({ completedBlueprints: 11, blueprintTotal: total, placedCount: 3, activeBlueprintBlocks: 24 }),
    ).toBe('normal')
    const all = [...blueprintOrder]
    expect(firstIncompleteIndex(all)).toBe(total)
    expect(canSelectBlueprint(blueprintOrder[total - 1], all)).toBe(true)
  })
})