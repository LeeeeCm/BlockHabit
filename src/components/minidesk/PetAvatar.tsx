import { useRef, type JSX, type KeyboardEvent, type MouseEvent, type Ref } from 'react'
import type { PetMood } from '../../render/petCanvas'
import type { PetModel } from '../../render/petGeometry'
import { usePetAvatarCanvas } from './PetAvatarCanvas'
import './PetAvatar.css'

interface PetAvatarProps {
  model: PetModel
  mood: PetMood
  label: string
  menuOpen: boolean
  onToggleMenu: () => void
  buttonRef?: Ref<HTMLButtonElement>
}

export function PetAvatar({
  model,
  mood,
  label,
  menuOpen,
  onToggleMenu,
  buttonRef
}: PetAvatarProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hop = usePetAvatarCanvas(canvasRef, model, mood)

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    // 原生键盘/辅助技术激活无指针坐标，由 click 的 detail 区分。
    if (event.detail === 0) {
      onToggleMenu()
      return
    }
    const { left, width } = event.currentTarget.getBoundingClientRect()
    hop(event.clientX < left + width / 2 ? -1 : 1)
  }

  function onContextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onToggleMenu()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const isMenuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
    const isArrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
    if (!isMenuKey && (!isArrow || event.altKey || event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat || event.key === 'ContextMenu') return
    if (isMenuKey) onToggleMenu()
    else hop(event.key === 'ArrowLeft' ? -1 : 1)
  }

  function onKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ContextMenu') return
    // Windows 的菜单键默认动作在 keyup；先取消，避免焦点转移后再触发原生菜单。
    event.preventDefault()
    event.stopPropagation()
    onToggleMenu()
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="pet-avatar"
      aria-label={label}
      aria-expanded={menuOpen}
      aria-haspopup="dialog"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </button>
  )
}
