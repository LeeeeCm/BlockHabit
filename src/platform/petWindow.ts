import { invoke } from '@tauri-apps/api/core'

/**
 * 桌宠窗口控制（D-20261124-088）。
 * 主窗通过 Rust 命令显示/隐藏 pet 窗口，避免跨窗口 JS 权限与焦点问题。
 */

export const PET_LABEL = 'pet'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function setPetVisible(visible: boolean): Promise<boolean> {
  if (!isTauriRuntime()) return false
  try {
    await invoke('set_pet_visible', { visible })
    return true
  } catch {
    return false
  }
}

export async function petOpenMain(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    await invoke('pet_open_main')
  } catch {
    // 主窗已被关闭时忽略
  }
}

/** 右键桌宠：唤起主窗并打开设置里的桌宠分组 */
export async function petOpenSettings(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    await invoke('pet_open_settings')
  } catch {
    // 主窗已被关闭时忽略
  }
}
