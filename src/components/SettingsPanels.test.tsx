import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEFAULT_WEBDAV_CONFIG } from '../sync/types'
import { JIANGUOYUN_ENDPOINT } from '../sync/providers'
import { useAppStore } from '../store/appStore'
import type { SyncErrorCode } from '../sync/useSync'
import { WebdavPanel, type SyncController } from './WebdavPanel'
import { ArchiveBackupsPanel, ArchiveDataPanel, DiagnosticsExportPanel } from './ArchiveDataPanel'
import { SettingsDialog } from './SettingsDialog'
import { createBackup, listBackups, openDataDir } from '../storage/backups'
import { exportDiagnosticsPackage } from '../platform/diagnostics'

vi.mock('../storage/backups', () => ({
  createBackup: vi.fn(async () => true),
  listBackups: vi.fn(async () => []),
  openDataDir: vi.fn(async () => true),
  readBackup: vi.fn(async () => null),
}))
vi.mock('../platform/diagnostics', () => ({ exportDiagnosticsPackage: vi.fn(async () => true) }))

/**
 * B3 面板拆分回归测试（D-20261110-061 / D-20261110-062）：
 * - WebdavPanel：服务商预设 / 端点联动 / 自检浏览器拦截 / 自动同步 / 状态与 toast 转发；
 * - ArchiveDataPanel / DiagnosticsExportPanel / ArchiveBackupsPanel：拆分后入口与回调不变；
 * - SettingsDialog：组合引用与分组外壳保持（WebDAV 默认展开、数据安全默认折叠）。
 */

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((el) => (el.textContent ?? '').trim() === label)
  if (!found) throw new Error(`button not found: ${label}`)
  return found
}

function makeSync(overrides: Partial<SyncController> = {}): SyncController {
  return {
    config: { ...DEFAULT_WEBDAV_CONFIG },
    updateConfig: vi.fn(),
    isSyncing: false,
    status: 'idle',
    error: null,
    lastSyncAt: null,
    syncNow: vi.fn(async () => true),
    getLastError: vi.fn(() => null),
    ...overrides,
  }
}

let clickSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'zh', theme: 'light' } })
})

afterEach(() => {
  vi.restoreAllMocks()
  clickSpy = null
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('WebdavPanel（从 SettingsDialog 抽出）', () => {
  it('渲染服务商预设、地址/凭据输入、测试连接与立即同步空态', () => {
    const { container, unmount } = render(<WebdavPanel sync={makeSync()} onToast={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('服务商')
    expect(text).toContain('WebDAV 地址')
    expect(text).toContain('用户名')
    expect(text).toContain('密码')
    expect(button(container, 'Nextcloud')).toBeDefined()
    expect(button(container, '坚果云')).toBeDefined()
    expect(button(container, '群晖')).toBeDefined()
    expect(button(container, '通用')).toBeDefined()
    expect(button(container, '测试连接').disabled).toBe(true)
    expect(button(container, '立即同步').disabled).toBe(true)
    expect(text).toContain('未同步')
    unmount()
  })

  it('选择坚果云预设：地址改为固定端点、只读，并提示应用专用密码', async () => {
    const sync = makeSync()
    const { container, unmount } = render(<WebdavPanel sync={sync} onToast={vi.fn()} />)
    await act(async () => {
      button(container, '坚果云').click()
    })
    expect(sync.updateConfig).toHaveBeenCalledWith({ endpoint: JIANGUOYUN_ENDPOINT })
    const inputs = Array.from(container.querySelectorAll('input[type="text"]')) as HTMLInputElement[]
    expect(inputs[0].value).toBe(JIANGUOYUN_ENDPOINT)
    expect(inputs[0].readOnly).toBe(true)
    expect(container.textContent).toContain('应用专用密码')
    unmount()
  })

  it('从坚果云切回通用：清空旧 host，不把固定端点带过去', async () => {
    const sync = makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: JIANGUOYUN_ENDPOINT } })
    const { container, unmount } = render(<WebdavPanel sync={sync} onToast={vi.fn()} />)
    await act(async () => {
      button(container, '通用').click()
    })
    expect(sync.updateConfig).toHaveBeenCalledWith({ endpoint: '' })
    const endpoints = Array.from(container.querySelectorAll('input[type="text"]')) as HTMLInputElement[]
    expect(endpoints[0].value).toBe('')
    unmount()
  })

  it('立即同步：成功/失败都通过父级 onToast 转发，失败按错误码映射文案', async () => {
    const onToast = vi.fn()
    const okSync = makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' } })
    const okRender = render(<WebdavPanel sync={okSync} onToast={onToast} />)
    await act(async () => {
      button(okRender.container, '立即同步').click()
    })
    expect(okSync.syncNow).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith('同步成功！数据已与云端合并', 3000)
    okRender.unmount()

    const failSync = makeSync({
      config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' },
      syncNow: vi.fn(async () => false),
      getLastError: vi.fn((): SyncErrorCode | null => 'auth'),
    })
    const failRender = render(<WebdavPanel sync={failSync} onToast={onToast} />)
    await act(async () => {
      button(failRender.container, '立即同步').click()
    })
    expect(onToast).toHaveBeenCalledWith('认证失败，请检查用户名与密码', 3000)
    failRender.unmount()
  })

  it('自动同步开关与间隔：updateConfig 接线不变；开启后显示四档间隔', async () => {
    const sync = makeSync({
      config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/', enabled: true, autoSyncIntervalMinutes: 30 },
    })
    const { container, unmount } = render(<WebdavPanel sync={sync} onToast={vi.fn()} />)
    expect(container.textContent).toContain('启动时与每隔设定间隔自动与云端合并')
    await act(async () => {
      button(container, '15 分钟').click()
    })
    expect(sync.updateConfig).toHaveBeenCalledWith({ autoSyncIntervalMinutes: 15 })
    await act(async () => {
      button(container, '关闭').click()
    })
    expect(sync.updateConfig).toHaveBeenCalledWith({ enabled: false })
    unmount()
  })

  it('状态行：同步中 / 错误码 / 上次同步时间', () => {
    const syncing = render(
      <WebdavPanel
        sync={makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' }, isSyncing: true, status: 'syncing' })}
        onToast={vi.fn()}
      />,
    )
    expect(syncing.container.textContent).toContain('正在连接同步中...')
    syncing.unmount()

    const failed = render(
      <WebdavPanel
        sync={makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' }, status: 'error', error: 'network' })}
        onToast={vi.fn()}
      />,
    )
    expect(failed.container.textContent).toContain('网络错误，请检查服务器地址与连接')
    failed.unmount()

    const synced = render(
      <WebdavPanel
        sync={makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' }, status: 'success', lastSyncAt: '2026-11-10T12:00:00.000Z' })}
        onToast={vi.fn()}
      />,
    )
    expect(synced.container.textContent).toContain('上次同步: ')
    synced.unmount()
  })

  it('浏览器预览点「测试连接」：只提示需在桌面端运行，不发起网络请求', async () => {
    const onToast = vi.fn()
    const sync = makeSync({ config: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com/' } })
    const { container, unmount } = render(<WebdavPanel sync={sync} onToast={onToast} />)
    await act(async () => {
      button(container, '测试连接').click()
    })
    expect(onToast).toHaveBeenCalledWith('连接自检需要在桌面端运行（浏览器预览受跨域限制）。', 3000)
    expect(container.textContent).not.toContain('连接正常，可以同步。')
    unmount()
  })
})

describe('ArchiveDataPanel（数据安全）', () => {
  it('渲染导出/导入入口与完整档案包入口（行为与文案不变）', () => {
    const { container, unmount } = render(<ArchiveDataPanel onImportFile={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(text).toContain('数据备份（本地安全存储）')
    expect(button(container, '导出备份')).toBeDefined()
    expect(button(container, '导入备份')).toBeDefined()
    expect(text).toContain('完整档案包')
    expect(button(container, '导出完整档案包')).toBeDefined()
    unmount()
  })

  it('选择文件后把 File 交给父级统一导入确认流程', async () => {
    const onImportFile = vi.fn()
    const { container, unmount } = render(<ArchiveDataPanel onImportFile={onImportFile} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['{"schemaVersion":2}'], 'blockhabit-backup.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onImportFile).toHaveBeenCalledWith(file)
    unmount()
  })

  it('点「导入备份」打开隐藏的文件选择框', () => {
    clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    const { container, unmount } = render(<ArchiveDataPanel onImportFile={vi.fn()} />)
    button(container, '导入备份').click()
    expect(clickSpy).toHaveBeenCalledTimes(1)
    unmount()
  })
})

describe('DiagnosticsExportPanel（诊断包）', () => {
  it('导出成功 / 失败分别 toast（渲染位置仍在实验室分组内）', async () => {
    const onToast = vi.fn()
    const ok = render(<DiagnosticsExportPanel onToast={onToast} />)
    expect(ok.container.textContent).toContain('诊断包')
    expect(button(ok.container, '导出诊断包')).toBeDefined()
    await act(async () => {
      button(ok.container, '导出诊断包').click()
    })
    expect(exportDiagnosticsPackage).toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith('诊断包已导出到下载目录', 2400)
    ok.unmount()

    vi.mocked(exportDiagnosticsPackage).mockResolvedValueOnce(false)
    const fail = render(<DiagnosticsExportPanel onToast={onToast} />)
    await act(async () => {
      button(fail.container, '导出诊断包').click()
    })
    expect(onToast).toHaveBeenCalledWith('导出失败，请稍后再试', 2400)
    fail.unmount()
  })
})

describe('ArchiveBackupsPanel（备份与恢复）', () => {
  it('渲染立即备份 / 打开数据目录 / 空备份列表', () => {
    const { container, unmount } = render(<ArchiveBackupsPanel onToast={vi.fn()} onRestoreCandidate={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(button(container, '立即备份')).toBeDefined()
    expect(button(container, '打开数据目录')).toBeDefined()
    expect(text).toContain('可恢复的备份')
    expect(text).toContain('还没有备份。每次覆盖导入前都会自动留档。')
    unmount()
  })

  it('立即备份：写入备份、toast、刷新列表', async () => {
    const onToast = vi.fn()
    const { container, unmount } = render(<ArchiveBackupsPanel onToast={onToast} onRestoreCandidate={vi.fn()} />)
    await act(async () => {
      button(container, '立即备份').click()
    })
    expect(createBackup).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith('已创建备份', 0)
    expect(listBackups).toHaveBeenCalled()
    unmount()
  })

  it('打开数据目录失败时 toast 提示', async () => {
    vi.mocked(openDataDir).mockResolvedValueOnce(false)
    const onToast = vi.fn()
    const { container, unmount } = render(<ArchiveBackupsPanel onToast={onToast} onRestoreCandidate={vi.fn()} />)
    await act(async () => {
      button(container, '打开数据目录').click()
    })
    expect(openDataDir).toHaveBeenCalledTimes(1)
    expect(onToast).toHaveBeenCalledWith('无法打开数据目录', 2400)
    unmount()
  })
})

describe('SettingsDialog 组合引用', () => {
  it('WebDAV 组默认展开；数据安全组默认折叠，展开后挂载 ArchiveDataPanel', async () => {
    const { container, unmount } = render(<SettingsDialog onClose={vi.fn()} />)
    expect(container.textContent).toContain('WebDAV 数据同步')
    expect(container.textContent).toContain('服务商')
    expect(container.textContent).not.toContain('导出备份')

    const titles = Array.from(container.querySelectorAll('.apple-group-title'))
    const dataTitle = titles.find((el) => (el.textContent ?? '').includes('数据安全')) as HTMLElement
    expect(dataTitle).toBeDefined()
    await act(async () => {
      dataTitle.click()
    })
    expect(container.textContent).toContain('导出备份')
    expect(container.textContent).toContain('完整档案包')
    expect(container.textContent).toContain('完成')
    unmount()
  })
})
