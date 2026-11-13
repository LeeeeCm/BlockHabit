/**
 * 档案包 manifest 语义与 README 生成（B3 拆分，见 D-20261110-062 / D-20261110-063）。
 *
 * - `archiveFormatVersion` 是档案**格式**版本（manifest 字段 / 目录布局），与 AppState.contentVersion 无关；
 * - `appContentVersion` 是导出时应用内置的蓝图内容版本（写出 CONTENT_VERSION），说明这批建筑属于哪一代内容；
 * - 旧档案的 manifest 把格式版本写在 `contentVersion` 字段里：`parseArchiveManifest` 兼容读取，
 *   缺失 `appContentVersion` 时回退当前内容版本（旧档不记录该值，仅作人读提示，不影响导入路径）；
 * - 本文件不写盘、不读盘（纯类型 / 解析 / 文本生成）；对外仍经 `archive.ts` barrel 导出，既有 import 路径不变。
 */
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { getTranslation } from '../i18n'

/**
 * 档案包**格式**版本：manifest 字段与目录布局（README + manifest + data + checksums + buildings）。
 * 与 AppState.contentVersion（蓝图内容版本）是两回事，两者分别演进。
 */
export const ARCHIVE_FORMAT_VERSION = 1
/**
 * @deprecated 旧名（容易与 AppState.contentVersion 混淆）；等价于 ARCHIVE_FORMAT_VERSION，
 * 保留仅为兼容既有调用方与测试。新代码请用 ARCHIVE_FORMAT_VERSION。
 */
export const ARCHIVE_CONTENT_VERSION = ARCHIVE_FORMAT_VERSION

export interface ArchiveBuilding {
  blueprintId: string
  /** 本地日期键（落成日 = 该蓝图全部积木 placedAt 最大值转本地日期） */
  completedAt: string
  blocks: number
  foundationNote?: string
}

export interface ArchiveManifestFile {
  path: string
  bytes: number
  sha256: string
}

export interface ArchiveManifest {
  appVersion: string
  schemaVersion: number
  /** 档案包**格式**版本（manifest 字段 / 目录布局）；与 AppState.contentVersion 无关 */
  archiveFormatVersion: number
  /** 导出时应用内置的蓝图内容版本（等价于 AppState.contentVersion），说明这批建筑属于哪一代内容 */
  appContentVersion: number
  exportedAt: string
  platform: 'desktop' | 'browser'
  /** 文件清单（不含 manifest.json / checksums.txt 自身，避免自引用） */
  files: ArchiveManifestFile[]
}

/**
 * 解析后的档案包 manifest。
 *
 * 兼容旧档案：v0.2.0 及更早写出的 manifest 只有 `contentVersion` 字段（当时它就是格式版本，
 * 早于「蓝图内容版本」概念），读取时回退为 `archiveFormatVersion`；旧档缺失 `appContentVersion`
 * 时回退到当前安装包的内容版本（旧档不记录该值，仅作人读提示，不参与导入判定、也不影响导入路径）。
 */
export interface ParsedArchiveManifest {
  appVersion: string
  schemaVersion: number
  archiveFormatVersion: number
  appContentVersion: number
  exportedAt: string
  platform: 'desktop' | 'browser'
  files: ArchiveManifestFile[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function parseManifestFile(value: unknown): ArchiveManifestFile | null {
  if (!isRecord(value)) return null
  if (typeof value.path !== 'string' || value.path.length === 0) return null
  if (typeof value.bytes !== 'number' || !Number.isInteger(value.bytes) || value.bytes < 0)
    return null
  if (typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(value.sha256)) return null
  return { path: value.path, bytes: value.bytes, sha256: value.sha256.toLowerCase() }
}

/** 解析档案包 manifest（JSON 值 → 归一化结构）；格式不合法时返回 null */
export function parseArchiveManifest(raw: unknown): ParsedArchiveManifest | null {
  if (!isRecord(raw)) return null
  if (typeof raw.appVersion !== 'string' || typeof raw.exportedAt !== 'string') return null
  if (!isPositiveInt(raw.schemaVersion)) return null
  const platform =
    raw.platform === 'browser' ? 'browser' : raw.platform === 'desktop' ? 'desktop' : null
  if (!platform) return null
  // 新字段优先；旧档案（无 archiveFormatVersion）回退读取当时的 contentVersion 别名
  const archiveFormatVersion = isPositiveInt(raw.archiveFormatVersion)
    ? raw.archiveFormatVersion
    : isPositiveInt(raw.contentVersion)
      ? raw.contentVersion
      : ARCHIVE_FORMAT_VERSION
  const appContentVersion = isPositiveInt(raw.appContentVersion)
    ? raw.appContentVersion
    : CONTENT_VERSION
  if (!Array.isArray(raw.files)) return null
  const files: ArchiveManifestFile[] = []
  for (const entry of raw.files) {
    const file = parseManifestFile(entry)
    if (!file) return null
    files.push(file)
  }
  return {
    appVersion: raw.appVersion,
    schemaVersion: raw.schemaVersion,
    archiveFormatVersion,
    appContentVersion,
    exportedAt: raw.exportedAt,
    platform,
    files
  }
}

/** 人读 README（双语小节；档案包可能被十年后的自己或别人打开） */
export function buildArchiveReadme(input: {
  appVersion: string
  schemaVersion: number
  archiveFormatVersion: number
  appContentVersion: number
  exportedAt: string
  files: ArchiveManifestFile[]
  buildings: ArchiveBuilding[]
}): string {
  const lines: string[] = []
  lines.push('# BlockHabit 完整档案包 / Complete Archive', '')
  lines.push(`- appVersion: ${input.appVersion}`)
  lines.push(`- schemaVersion: ${input.schemaVersion}`)
  lines.push(`- archiveFormatVersion: ${input.archiveFormatVersion}`)
  lines.push(`- appContentVersion: ${input.appContentVersion}`)
  lines.push(`- exportedAt: ${input.exportedAt}`)
  lines.push('', '## 这是什么 / What this is', '')
  lines.push(
    '这是 BlockHabit 本地数据的只读快照，不含任何账号信息，也不含 WebDAV 凭据；生成过程不上传、不联网。'
  )
  lines.push(
    'This is a read-only snapshot of BlockHabit local data. No account information and no WebDAV credentials are included; nothing is uploaded.'
  )
  lines.push('', '## 版本字段怎么读 / Version fields', '')
  lines.push(
    '- `archiveFormatVersion`：档案包**格式**版本（manifest 字段与目录布局），与存档里的 `contentVersion` 无关。'
  )
  lines.push(
    '  The archive **format** version (manifest fields and folder layout); unrelated to `contentVersion` in the save file.'
  )
  lines.push(
    '- `appContentVersion`：导出时应用内置的蓝图内容版本（与存档里的 `contentVersion` 同义），用来说明这批建筑属于哪一代内容。'
  )
  lines.push(
    '  The blueprint content version built into the app at export time (same meaning as `contentVersion` in the save file), i.e. which content generation these buildings belong to.'
  )
  lines.push('- `schemaVersion`：存档数据形状版本（`data/blockhabit-state.json` 的兼容性看它）。')
  lines.push(
    '  The save-data shape version (use it to judge compatibility of `data/blockhabit-state.json`).'
  )
  lines.push('', '## 包含什么 / What is inside', '')
  lines.push(
    '- `data/blockhabit-state.json` — 全部数据，可被应用「导入数据」直接读回 / all data, importable by the app'
  )
  lines.push(
    '- `data/checksums.txt` — 每个文件的 SHA-256（外部可校验）/ SHA-256 per file (verifiable outside the app)'
  )
  lines.push('- `manifest.json` — 版本、导出时间与文件清单 / versions, export time and file list')
  lines.push(
    '- `buildings/*.png` — 已落成建筑的等距渲染图（透明背景 2×）/ isometric renders of completed buildings (transparent, 2×)'
  )
  lines.push(
    '- `buildings/README.md` — 建筑名、落成日期与奠基石铭言 / building names, completion dates and foundation notes'
  )
  lines.push('')
  lines.push(`建筑图数量 / Completed buildings: ${input.buildings.length}`)
  lines.push('')
  lines.push('## 如何恢复 / How to restore', '')
  lines.push('1. 打开 BlockHabit → 设置 → 数据备份 → 导入数据，选择 `data/blockhabit-state.json`。')
  lines.push(
    '   Open BlockHabit → Settings → Data → Import data and choose `data/blockhabit-state.json`.'
  )
  lines.push(
    '2. 请使用与导出时相同或更新版本的应用（manifest 里的 schemaVersion / appContentVersion 可用于判断兼容性）。'
  )
  lines.push(
    '   Use the same or a newer app version (see schemaVersion / appContentVersion in manifest.json).'
  )
  lines.push('3. 建筑图与年鉴图只是人看的派生文件，不参与恢复。')
  lines.push(
    '   Building images are for human reading only; they are not part of the restore path.'
  )
  lines.push('')
  lines.push('## 如何校验 / How to verify', '')
  lines.push('在档案包目录内执行 / run inside the archive folder:')
  lines.push('')
  lines.push('```')
  lines.push('sha256sum -c data/checksums.txt        # macOS / Linux')
  lines.push(
    'Get-FileHash <file> -Algorithm SHA256  # Windows PowerShell（逐文件对照 checksums.txt）'
  )
  lines.push('```')
  lines.push('')
  lines.push('校验和只能证明文件完整、未被改动，不能证明来源（档案包没有签名）。')
  lines.push('Checksums prove integrity, not authenticity — the archive is not signed.')
  lines.push('')
  lines.push('## 隐私提醒 / Privacy', '')
  lines.push('档案包含个人打卡与随笔，请自行保管；它没有加密，可以放进你自己的同步盘。')
  lines.push(
    'The archive contains personal check-ins and notes; keep it safe. It is not encrypted, and you may store it in your own sync folder.'
  )
  lines.push('', '## 文件清单 / File list', '')
  for (const file of input.files) {
    lines.push(`- ${file.path} (${file.bytes} bytes, sha256 ${file.sha256})`)
  }
  lines.push('')
  return lines.join('\n')
}

function blueprintNames(blueprintId: string): { zh: string; en: string } {
  const zh = getTranslation('zh').blueprints[blueprintId] || blueprintId
  const en = getTranslation('en').blueprints[blueprintId] || blueprintId
  return { zh, en }
}

/** 建筑年表 README（双语；供人对照 PNG 阅读） */
export function buildBuildingsReadme(buildings: ArchiveBuilding[]): string {
  const lines: string[] = ['# 已落成建筑 / Completed buildings', '']
  if (buildings.length === 0) {
    lines.push('这份档案包生成时还没有落成的建筑。')
    lines.push('No buildings had been completed when this archive was created.')
    lines.push('')
    return lines.join('\n')
  }
  lines.push('| # | id | 名称 / Name | 落成日 / Completed | 铭言 / Foundation note |')
  lines.push('| --- | --- | --- | --- | --- |')
  buildings.forEach((building, index) => {
    const names = blueprintNames(building.blueprintId)
    const note = (building.foundationNote ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    lines.push(
      `| ${index + 1} | ${building.blueprintId} | ${names.zh} / ${names.en} | ${building.completedAt} | ${note} |`
    )
  })
  lines.push('')
  lines.push('图片为透明背景等距渲染（2×），只用于阅读，不参与数据恢复。')
  lines.push(
    'Images are transparent isometric renders (2×) for reading only; they are not used for data restore.'
  )
  lines.push('')
  return lines.join('\n')
}
