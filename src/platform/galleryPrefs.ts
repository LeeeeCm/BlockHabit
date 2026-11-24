/**
 * 模型图鉴的桌宠蓝图置顶偏好（D-20261124-106）。
 *
 * 只存设备本地 localStorage，不进存档、不参与同步：这是「这张屏幕上图鉴先看哪一组」
 * 的布局偏好，不是用户数据。localStorage 不可用 / 内容损坏时回到默认「建筑蓝图在前」，
 * 最坏结果只是下次打开需要再点一次置顶，绝不阻断图鉴渲染。
 */

export const GALLERY_PET_FIRST_KEY = 'blockhabit.galleryPetFirst.v1'

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 默认 false：建筑蓝图在前；只有明确存过 '1' 才置顶桌宠。 */
export function loadPetBlueprintsFirst(): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    return storage.getItem(GALLERY_PET_FIRST_KEY) === '1'
  } catch {
    return false
  }
}

export function savePetBlueprintsFirst(first: boolean): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(GALLERY_PET_FIRST_KEY, first ? '1' : '0')
  } catch {
    // 写失败：本次会话仍按用户点击的顺序显示，不弹错
  }
}
