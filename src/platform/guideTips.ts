/**
 * 页面提示已读状态（D-20261110-054）。
 *
 * 存在 localStorage 的 blockhabit.guideTips.v1，值为「已看过的提示 id」字符串数组。
 * 不进存档 schema、不参与同步：提示是「这台设备上这张脸看过没有」的界面状态，不是用户数据。
 *
 * 容错原则：localStorage 不可用（隐私模式 / 配额 / 策略禁用）或 JSON 损坏时，
 * 一律按「未看过」处理并静默忽略——最坏结果只是提示再看一次，绝不能让提示系统本身报错。
 */

export type GuideTipId = 'build' | 'showcase' | 'stats'

/** 存储键（v1 后缀为未来扩容/迁移留出空间） */
export const GUIDE_TIPS_KEY = 'blockhabit.guideTips.v1'

const GUIDE_TIP_IDS: readonly GuideTipId[] = ['build', 'showcase', 'stats']

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isGuideTipId(value: unknown): value is GuideTipId {
  return typeof value === 'string' && (GUIDE_TIP_IDS as readonly string[]).includes(value)
}

/** 读出已看过的 id：坏 JSON / 非数组 / 未知 id 一律过滤掉，不抛错 */
function readSeenTipIds(): GuideTipId[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(GUIDE_TIPS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen: GuideTipId[] = []
    for (const value of parsed) {
      // 去重：手工改坏 localStorage 也不让数组无限长大
      if (isGuideTipId(value) && !seen.includes(value)) seen.push(value)
    }
    return seen
  } catch {
    return []
  }
}

/** 该提示是否已经出现过；存储不可用或损坏时视为未看过 */
export function hasSeenTip(id: GuideTipId): boolean {
  return readSeenTipIds().includes(id)
}

/** 标记已看过；重复标记不会产生重复项。写失败静默忽略（提示会再看一次） */
export function markTipSeen(id: GuideTipId): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const seen = readSeenTipIds()
    if (seen.includes(id)) return
    storage.setItem(GUIDE_TIPS_KEY, JSON.stringify([...seen, id]))
  } catch {
    // 写失败：不阻断页面渲染，也不提示用户
  }
}

/** 清空已读状态（设置页「重看页面提示」） */
export function resetGuideTips(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(GUIDE_TIPS_KEY)
  } catch {
    // ignore
  }
}
