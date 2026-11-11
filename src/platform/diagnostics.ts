import type { AppState } from '../types'
import { APP_VERSION, buildDiagnosticsText, getCrashLog } from './errorLog'
import { SCHEMA_VERSION } from '../storage/adapter'
import { useAppStore } from '../store/appStore'

/**
 * F9：本地诊断包（纯本地，不上传、不联网）。
 *
 * 设计约束（AGENTS §3 本地优先 + A7）：
 * - 只读当前进程内存与本地存储，不发起任何网络请求；
 * - 任何采样/导出失败都静默降级，绝不影响应用运行；
 * - 输出是**人可读的纯文本**：用户能自己看一眼再决定要不要发给维护者。
 */

export interface DataSummary {
  appVersion: string
  schemaVersion: number
  habits: number
  archivedHabits: number
  checkIns: number
  builds: number
  completedBlueprints: number
  dayClaims: number
  repairBricks: number
  foundationNotes: number
  reminderLogEntries: number
  languages: string
  theme: string
  /** 序列化后的存档字符数（近似磁盘占用，1 字节/字符的保守估计） */
  stateChars: number
  /** 本地存储 backend：tauri / localStorage / memory */
  storageBackend: string
}

export interface FrameSample {
  frames: number
  durationMs: number
  fps: number
  /** 最慢一帧（毫秒），用于判断是否卡顿 */
  worstFrameMs: number
}

/** 当前运行环境的存储后端（只用于诊断展示） */
export function detectStorageBackend(): string {
  if (typeof window === 'undefined') return 'unknown'
  if ('__TAURI_INTERNALS__' in window) return 'tauri'
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__bh_probe__', '1')
      localStorage.removeItem('__bh_probe__')
      return 'localStorage'
    }
  } catch {
    return 'unavailable'
  }
  return 'memory'
}

/** 汇总数据体量（只读快照，不改任何状态） */
export function summarizeData(state: AppState = useAppStore.getState()): DataSummary {
  let stateChars = 0
  try {
    stateChars = useAppStore.getState().exportData().length
  } catch {
    stateChars = 0
  }
  return {
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    habits: state.habits?.length ?? 0,
    archivedHabits: state.habits?.filter((h) => Boolean(h.archivedAt)).length ?? 0,
    checkIns: state.checkIns?.length ?? 0,
    builds: state.builds?.length ?? 0,
    completedBlueprints: state.completedBlueprintIds?.length ?? 0,
    dayClaims: state.dayClaims?.length ?? 0,
    repairBricks: state.repairBricks ?? 0,
    foundationNotes: Object.keys(state.foundationNotes ?? {}).length,
    reminderLogEntries: Object.keys(state.reminderLog ?? {}).length,
    languages: state.settings?.language ?? 'unknown',
    theme: state.settings?.theme ?? 'unknown',
    stateChars,
    storageBackend: detectStorageBackend()
  }
}

/**
 * 渲染帧率采样：连续若干帧记录时间戳，返回 fps 与最慢帧。
 * 组件不可见 / 减少动态偏好 / 无 rAF 环境下返回 null（诊断包里注明"未采样"）。
 */
export function sampleFrameRate(durationMs = 1200): Promise<FrameSample | null> {
  if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const times: number[] = []
    const start = performance.now()
    const tick = (now: number): void => {
      times.push(now)
      if (now - start < durationMs) {
        requestAnimationFrame(tick)
        return
      }
      const deltas: number[] = []
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1])
      const elapsed = times[times.length - 1] - times[0]
      resolve({
        frames: times.length,
        durationMs: Math.round(elapsed),
        fps: elapsed > 0 ? Math.round(((times.length - 1) / elapsed) * 1000 * 10) / 10 : 0,
        worstFrameMs: deltas.length > 0 ? Math.round(Math.max(...deltas) * 10) / 10 : 0
      })
    }
    requestAnimationFrame(tick)
  })
}

/** 把各部分拼成最终文本（纯函数，便于单测） */
export function formatDiagnosticsReport(
  input: { base: string; summary: DataSummary; frames: FrameSample | null; crashCount: number },
  now: Date = new Date()
): string {
  const { summary: s, frames, crashCount } = input
  const frameLines = frames
    ? [
        `Frames: ${frames.frames} over ${frames.durationMs}ms → ${frames.fps} fps`,
        `Worst frame: ${frames.worstFrameMs}ms`
      ]
    : ['Frames: (not sampled — reduced motion or no requestAnimationFrame)']
  return [
    input.base,
    '',
    'Data summary (local only)',
    '-------------------------',
    `Generated at: ${now.toISOString()}`,
    `Storage backend: ${s.storageBackend}`,
    `Schema version: ${s.schemaVersion}`,
    `Saved state size: ~${s.stateChars} chars`,
    `Habits: ${s.habits} (archived ${s.archivedHabits})`,
    `Check-ins: ${s.checkIns}`,
    `Placed blocks: ${s.builds}`,
    `Completed blueprints: ${s.completedBlueprints}`,
    `Day claims: ${s.dayClaims}`,
    `Repair blocks in stock: ${s.repairBricks}`,
    `Foundation notes: ${s.foundationNotes}`,
    `Reminder log entries: ${s.reminderLogEntries}`,
    `Theme / language: ${s.theme} / ${s.languages}`,
    '',
    'Render sampling',
    '---------------',
    ...frameLines,
    '',
    `Crash log entries included: ${crashCount}`
  ].join('\n')
}

/** 生成完整诊断文本（含 1.2s 帧率采样） */
export async function buildDiagnosticsReport(durationMs = 1200): Promise<string> {
  const base = buildDiagnosticsText()
  const summary = summarizeData()
  let frames: FrameSample | null = null
  try {
    frames = await sampleFrameRate(durationMs)
  } catch {
    frames = null
  }
  return formatDiagnosticsReport({ base, summary, frames, crashCount: getCrashLog().length })
}

/** 触发本地下载（Blob + 临时 <a>，与导出 JSON 同一套做法） */
export function downloadTextFile(filename: string, text: string): void {
  if (typeof document === 'undefined') return
  try {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') return
    if (typeof URL.createObjectURL !== 'function') return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // 忽略
      }
    }, 0)
  } catch {
    // 静默：诊断导出失败不影响应用
  }
}

/** 一键导出诊断包，返回是否成功（用于 UI toast） */
export async function exportDiagnosticsPackage(): Promise<boolean> {
  try {
    const text = await buildDiagnosticsReport()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(`blockhabit-diagnostics-${stamp}.txt`, text)
    return true
  } catch {
    return false
  }
}
