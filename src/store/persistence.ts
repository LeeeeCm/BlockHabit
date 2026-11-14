import type { StoreApi } from 'zustand'
import type { AppState } from '../types'
import { getBlueprint } from '../logic/blueprints'
import type { StorageAdapter } from '../storage/adapter'
import { serializeState } from './serializeState'
import type { AppStore } from './appStoreTypes'

/**
 * appStore 的持久化实现（从 appStore.ts 拆出）：
 * 启动读档、防抖写盘、串行写队列与演示模式。
 * 通过 PersistenceStore 注入 store 实例，本模块不反向 import appStore，避免模块循环依赖。
 */
export type PersistenceStore = StoreApi<AppStore>

/** initPersistence 注入的立即落盘实现；未初始化时为空操作 */
let flushNowImpl: (() => void) | null = null
/** 最近一次落盘的 Promise（供退出握手等待在途写入完成） */
let lastSavePromise: Promise<void> = Promise.resolve()

/** 关键变更（打卡/撤销/领取/补卡/导入）绕过防抖立即写盘（由 store action 调用） */
export function requestFlushNow(): void {
  flushNowImpl?.()
}

/** 强制立即落盘并等待写入完成（托盘退出握手等关键路径使用） */
export function forceFlush(): Promise<void> {
  flushNowImpl?.()
  return lastSavePromise
}

/** initPersistence 完成后 resolve；同步/自动同步需等待它避免与磁盘加载竞态 */
let resolvePersistenceReadyImpl: (() => void) | null = null
export const persistenceReady: Promise<void> = new Promise<void>((resolve) => {
  resolvePersistenceReadyImpl = resolve
})

/** 演示模式（?demo-castle）：由 main.tsx 在启动时标记并注入内存态，不读写本地存档 */
let demoMode = false
export function markDemoMode(): void {
  demoMode = true
}
export function isDemoMode(): boolean {
  return demoMode
}
export function applyDemoCastleState(store: PersistenceStore): void {
  const N = getBlueprint('castle').blocks.length
  store.setState({
    builds: Array.from({ length: N }, (_, i) => ({
      id: `demo-${i}`,
      blueprintId: 'castle',
      index: i,
      placedAt: new Date(Date.now() - (N - i) * 86_400_000).toISOString(),
      fromHabitId: '__day__',
      bonus: false
    })),
    completedBlueprintIds: ['castle'],
    // 演示模式不读盘：直接视作已水合，避免启动水合门挡住演示页（D-20261110-056）
    hydrated: true
  })
}

/** 启动时恢复状态并挂载防抖持久化（StrictMode 下可能调用两次，需幂等） */
let persistenceStarted = false

export async function initPersistence(
  adapter: StorageAdapter,
  store: PersistenceStore
): Promise<void> {
  if (persistenceStarted) return
  persistenceStarted = true

  /** 必须挂起持久化的情形：读档异常或存档来自更高版本 */
  let suspendPersistence = false
  try {
    // 演示模式：main.tsx 已注入内存态（applyDemoCastleState），不读写本地存档
    if (isDemoMode()) return

    const res = await adapter.load()
    if (res.needsUpgrade) {
      // 存档来自更高版本的应用：挂起持久化（不注入 flush、不订阅保存），
      // 防止低版本会话把默认空态写回、覆盖高版本存档；UI 层提示升级。
      suspendPersistence = true
      store.setState({ hydrated: true, needsUpgrade: true })
    } else if (res.loadFailed) {
      // 读档失败（IO / 权限 / 被占用 / 迁移崩溃）≠ 没有存档。
      // 此时若照常订阅持久化，用户第一次交互就会把默认空态写回磁盘、永久覆盖真实存档。
      suspendPersistence = true
      store.setState({ hydrated: true, loadFailed: true })
      if (typeof console !== 'undefined')
        console.warn('[persistence] 读档失败，已挂起自动保存：', res.detail)
    } else if (res.corruptRecovered) {
      // 存档损坏已备份：照常以空态启动（可继续保存新数据），但必须提示原档去向
      store.setState({ hydrated: true, dataCorrupt: true })
    } else if (res.state) {
      const saved = res.state
      const lang =
        saved.settings.language ??
        (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en')
      store.setState({
        ...saved,
        settings: { ...saved.settings, language: lang },
        hydrated: true
      })
    } else {
      store.setState({ hydrated: true })
    }
  } finally {
    resolvePersistenceReadyImpl?.()
  }
  if (suspendPersistence) return

  // F8：启动时结算本月修复积木额度（跨月后第一次打开就能拿到当月额度）
  store.getState().refreshRepairAllowance()

  let timer: number | undefined
  let pendingState: AppState | null = null

  /** 在途 + 排队中的写盘数量：0 表示可以立即同步发起（保持"关键动作立即落盘"的既有语义） */
  let pendingWrites = 0
  /** 写盘串行队列：后一笔必须等前一笔落地，杜绝共用状态互相截断 */
  let saveChain: Promise<void> = Promise.resolve()

  function persistState(state: AppState): void {
    // 唯一白名单在 store/serializeState；saveError/hydrated 等运行时字段自然被排除
    const payload = serializeState(state)
    const exec = () =>
      adapter
        .save(payload)
        .then(() => {
          // 恢复成功后清除错误标记；该 setState 会再触发一次订阅，但输出相同、自然收敛
          if (store.getState().saveError !== undefined) {
            store.setState({ saveError: undefined })
          }
        })
        .catch(() => {
          // 首次失败才置位，避免"失败→订阅→再保存→再失败"的循环
          if (store.getState().saveError === undefined) {
            store.setState({ saveError: Date.now() })
          }
        })
    // 队列空闲时立即发起（保持同步语义）；否则排到队尾，等上一笔完成
    const run = pendingWrites === 0 ? exec() : saveChain.then(exec)
    pendingWrites++
    saveChain = run.finally(() => {
      pendingWrites--
    })
    // forceFlush 等待整条链（含排队中的写入）
    lastSavePromise = saveChain
  }

  function flushSave() {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (!pendingState) return
    const state = pendingState
    pendingState = null
    persistState(state)
  }
  flushNowImpl = flushSave

  store.subscribe((state) => {
    if (!state.hydrated) return
    pendingState = state
    clearTimeout(timer)
    timer = setTimeout(() => {
      flushSave()
    }, 150)
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushSave)
    window.addEventListener('pagehide', flushSave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushSave()
      }
    })
  }
}
