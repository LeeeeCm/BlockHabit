/**
 * 展台多沙盘的纯状态派生与不可变更新（D-20261127-127）。
 * store、页面、同步合并共用同一套解析规则，避免各自猜「当前是哪个沙盘」。
 */
import type { AppState, ShowcasePlacement, ShowcaseSandbox } from '../types'
import { DEFAULT_SANDBOX_ID, createShowcaseSandbox } from '../logic/showcase'

export type ShowcaseSlice = Pick<
  AppState,
  'showcaseSandboxes' | 'activeSandboxId' | 'showcasePlacements'
>

export interface ResolvedShowcaseState {
  sandboxes: ShowcaseSandbox[]
  activeId: string
  active: ShowcaseSandbox
}

/**
 * 解析沙盘状态：
 * - 已有 sandboxes 时以它为准（activeSandboxId 失效则回落到第一个）；
 * - 只有 legacy showcasePlacements 时，现场生成 sandbox-1（moss / seed 0），不写 store。
 */
export function resolveShowcaseState(state: ShowcaseSlice): ResolvedShowcaseState {
  const sandboxes =
    state.showcaseSandboxes && state.showcaseSandboxes.length > 0
      ? state.showcaseSandboxes
      : [
          createShowcaseSandbox(
            DEFAULT_SANDBOX_ID,
            0,
            // 旧档/测试可能残留 null 元素；先滤掉再交给页面与迁移
            (state.showcasePlacements ?? []).filter((p): p is ShowcasePlacement => p != null)
          )
        ]
  const active = sandboxes.find((s) => s.id === state.activeSandboxId) ?? sandboxes[0]
  return { sandboxes, activeId: active.id, active }
}

/** 生成要写回 store / 存档的三件套：沙盘列表 + 当前 id + 当前沙盘镜像 */
export function showcaseFields(
  sandboxes: ShowcaseSandbox[],
  activeId: string
): Pick<AppState, 'showcaseSandboxes' | 'activeSandboxId' | 'showcasePlacements'> {
  const active = sandboxes.find((s) => s.id === activeId) ?? sandboxes[0]
  return {
    showcaseSandboxes: sandboxes,
    activeSandboxId: active.id,
    showcasePlacements: active.placements
  }
}

/** 只替换某个沙盘的 placements（其余沙盘引用保持不变） */
export function setSandboxPlacements(
  sandboxes: ShowcaseSandbox[],
  sandboxId: string,
  placements: ShowcasePlacement[]
): ShowcaseSandbox[] {
  return sandboxes.map((s) => (s.id === sandboxId ? { ...s, placements } : s))
}

/** 从所有沙盘移除指定蓝图（撤销打卡 / 删除习惯 / 同步过滤共用） */
export function removePlacementsEverywhere(
  sandboxes: ShowcaseSandbox[],
  blueprintIds: ReadonlySet<string>
): ShowcaseSandbox[] {
  let changed = false
  const next = sandboxes.map((s) => {
    const placements = s.placements.filter((p) => p != null && !blueprintIds.has(p.blueprintId))
    if (placements.length === s.placements.length) return s
    changed = true
    return { ...s, placements }
  })
  return changed ? next : sandboxes
}

/** 找到某座建筑所在的沙盘与落位（用于堆场的「在其他沙盘」分组与移动） */
export function findPlacementAcrossSandboxes(
  sandboxes: ShowcaseSandbox[],
  blueprintId: string
): { sandbox: ShowcaseSandbox; placement: ShowcasePlacement } | null {
  for (const sandbox of sandboxes) {
    const placement = sandbox.placements.find((p) => p != null && p.blueprintId === blueprintId)
    if (placement) return { sandbox, placement }
  }
  return null
}
