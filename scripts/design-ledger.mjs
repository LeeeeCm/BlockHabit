#!/usr/bin/env node
/**
 * 设计台账校验器（design ledger guard）
 *
 * 作用：把 design/README.md 里的三条纪律变成可执行的门禁
 *   1. 每条设计必须有记录文件（records/D-YYYYMMDD-NNN-slug.md）且登记进 index.json 与 RECORDS.md
 *   2. 记录状态必须合法；approved/implemented/revoked 必须由人类填写审核人（reviewer !== pending）
 *   3. 相对 git HEAD 的删除必须先在 APPROVALS.md 取得人工批准（approved/done）
 *
 * 用法：
 *   node scripts/design-ledger.mjs            # 校验（有错退出码 1）
 *   node scripts/design-ledger.mjs --fix      # 依据 records/ 重新生成 index.json
 *   node scripts/design-ledger.mjs --json     # 机器可读输出
 *
 * 说明：front-matter 只支持行式 "key: value" 与内联数组 "[a, b]" 子集，够用且无依赖。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

export const STATUSES = [
  'proposed',
  'approved',
  'implemented',
  'superseded',
  'deprecated',
  'revoked'
]
/** 只能由人类设置的状态 */
export const HUMAN_ONLY_STATUSES = ['approved', 'implemented', 'revoked']
export const REQUIRED_FIELDS = [
  'id',
  'date',
  'title',
  'status',
  'owner',
  'surface',
  'axioms',
  'files',
  'reviewer'
]
export const RECORD_ID_RE = /^D-(\d{8})-(\d{3})$/
export const RECORD_FILE_RE = /^(D-\d{8}-\d{3})-[a-z0-9][a-z0-9-]*\.md$/
export const INDEX_VERSION = 1
/** 设计中枢必需的文件（缺任何一个都视为入口不完整） */
export const REQUIRED_HUB_FILES = [
  'README.md',
  'AESTHETIC.md',
  'TOKENS.md',
  'ART.md',
  'SURFACES.md',
  'VOICE.md',
  'RECORDS.md',
  'APPROVALS.md',
  'index.json'
]

/* ---------------------------------- 工具 ---------------------------------- */

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** 解析极简 front-matter（只支持本仓库约定子集） */
export function parseFrontMatter(raw) {
  const text = raw.replace(/^\uFEFF/, '')
  if (!text.startsWith('---'))
    return { data: null, body: text, error: '缺少 front-matter（文件必须以 --- 开头）' }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { data: null, body: text, error: 'front-matter 未闭合（缺少结束的 ---）' }
  const head = text.slice(3, end)
  const body = text.slice(end + 4)
  const data = {}
  for (const line of head.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!m) return { data: null, body, error: `无法解析的 front-matter 行：${line}` }
    const [, key, rawValue] = m
    const value = rawValue.trim()
    if (value === '') {
      data[key] = ''
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      data[key] = inner
        ? inner
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
        : []
    } else {
      data[key] = value.replace(/^['"]|['"]$/g, '')
    }
  }
  return { data, body, error: null }
}

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch {
    return null
  }
}

/** 当前 index.json（不存在视为空） */
function readIndex() {
  const raw = readIfExists(path.join(ROOT, 'design', 'index.json'))
  if (raw == null) return { records: [] }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.records))
      return { records: [], error: 'index.json 缺少 records 数组' }
    return parsed
  } catch (e) {
    return { records: [], error: `index.json 不是合法 JSON：${e.message}` }
  }
}

/* --------------------------------- 校验主体 -------------------------------- */

export function checkDesignLedger() {
  const errors = []
  const warnings = []
  const designDir = path.join(ROOT, 'design')
  const recordsDir = path.join(designDir, 'records')

  // 0. 入口完整性
  if (!fs.existsSync(designDir)) {
    errors.push('缺少 design/ 目录（设计中枢不存在）')
    return { ok: false, errors, warnings, records: [] }
  }
  for (const f of REQUIRED_HUB_FILES) {
    if (!fs.existsSync(path.join(designDir, f))) errors.push(`设计中枢缺少必需文件 design/${f}`)
  }
  const agents = readIfExists(path.join(ROOT, 'AGENTS.md'))
  if (agents == null) errors.push('仓库根缺少 AGENTS.md（代理规则入口）')
  else if (!agents.includes('design/README.md'))
    errors.push('AGENTS.md 未指向 design/README.md（唯一设计入口必须被引用）')

  // 1. 逐条记录校验
  const records = []
  if (!fs.existsSync(recordsDir)) {
    errors.push('缺少 design/records/ 目录')
  } else {
    const files = fs
      .readdirSync(recordsDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
    for (const file of files) {
      const full = path.join(recordsDir, file)
      const raw = readIfExists(full) ?? ''
      const { data, body, error } = parseFrontMatter(raw)
      if (error) {
        errors.push(`${file}: ${error}`)
        continue
      }
      const missing = REQUIRED_FIELDS.filter((k) => !(k in data))
      if (missing.length) errors.push(`${file}: front-matter 缺少字段 ${missing.join(', ')}`)
      const id = data.id
      if (!id || !RECORD_ID_RE.test(id)) {
        errors.push(`${file}: id 非法（应为 D-YYYYMMDD-NNN）：${id ?? '(空)'}`)
      }
      const fileMatch = file.match(RECORD_FILE_RE)
      if (!fileMatch) {
        errors.push(`${file}: 文件名不符合 D-YYYYMMDD-NNN-slug.md`)
      } else if (id && fileMatch[1] !== id) {
        errors.push(`${file}: 文件名 id 与 front-matter id 不一致（${fileMatch[1]} vs ${id}）`)
      }
      if (id && RECORD_ID_RE.test(id)) {
        const ymd = id.match(RECORD_ID_RE)[1]
        const dateStr = String(data.date ?? '').replace(/-/g, '')
        if (dateStr !== ymd)
          errors.push(`${file}: date(${data.date}) 与 id 中的日期(${ymd}) 不一致`)
      }
      if (!STATUSES.includes(data.status)) {
        errors.push(`${file}: status 非法 "${data.status}"（允许：${STATUSES.join(' | ')}）`)
      } else if (HUMAN_ONLY_STATUSES.includes(data.status)) {
        const reviewer = String(data.reviewer ?? '').trim()
        if (!reviewer || reviewer === 'pending') {
          errors.push(
            `${file}: status=${data.status} 但 reviewer 仍为 pending —— 该状态只能由人类审核后设置`
          )
        }
      }
      if ((body ?? '').replace(/\s/g, '').length < 120) {
        errors.push(`${file}: 正文过短（<120 字），记录必须写清背景/决定/取舍/影响面/验收`)
      }
      records.push({
        id,
        date: data.date,
        title: data.title,
        status: data.status,
        owner: data.owner,
        reviewer: data.reviewer,
        file: `design/records/${file}`
      })
    }
  }
  // id 唯一 + 编号不复用（同日序号唯一）
  const seen = new Map()
  for (const r of records) {
    if (!r.id) continue
    if (seen.has(r.id)) errors.push(`记录 id 重复：${r.id}（${seen.get(r.id)} 与 ${r.file}）`)
    else seen.set(r.id, r.file)
  }
  if (records.length === 0) warnings.push('design/records/ 下没有任何记录')

  // 2. index.json 与 records 双向一致
  const index = readIndex()
  if (index.error) errors.push(index.error)
  const indexIds = new Set()
  for (const entry of index.records ?? []) {
    if (!entry || !entry.id) {
      errors.push('index.json 存在缺少 id 的条目')
      continue
    }
    indexIds.add(entry.id)
    const rec = records.find((r) => r.id === entry.id)
    if (!rec) {
      errors.push(`index.json 登记了不存在的记录：${entry.id}`)
      continue
    }
    if (entry.file && entry.file.replace(/\\/g, '/') !== rec.file) {
      errors.push(`index.json 中 ${entry.id} 的 file 与实际不符（${entry.file} vs ${rec.file}）`)
    }
    if (entry.status && entry.status !== rec.status) {
      errors.push(
        `index.json 中 ${entry.id} 的状态过期（${entry.status} → 实际 ${rec.status}），请运行 --fix`
      )
    }
    if (entry.title && entry.title !== rec.title) {
      warnings.push(`index.json 中 ${entry.id} 的 title 与实际不一致`)
    }
  }
  for (const rec of records) {
    if (!indexIds.has(rec.id)) errors.push(`记录未登记进 index.json：${rec.id}（${rec.file}）`)
  }

  // 3. RECORDS.md 台账包含每条记录
  const ledger = readIfExists(path.join(designDir, 'RECORDS.md'))
  if (ledger == null) {
    errors.push('缺少 design/RECORDS.md')
  } else {
    for (const rec of records) {
      if (rec.id && !ledger.includes(rec.id)) errors.push(`RECORDS.md 台账缺少记录行：${rec.id}`)
    }
  }

  // 4. 未审批删除检测（对照 git HEAD）
  const approvals = readIfExists(path.join(designDir, 'APPROVALS.md')) ?? ''
  const headFiles = git(['ls-tree', '-r', '--name-only', 'HEAD', 'design/'])
  if (headFiles == null) {
    warnings.push('无法读取 git HEAD，跳过删除检测')
  } else {
    const tracked = headFiles.split(/\r?\n/).filter(Boolean)
    for (const rel of tracked) {
      if (
        !rel.endsWith('.md') &&
        !rel.endsWith('.json') &&
        !rel.endsWith('.svg') &&
        !rel.endsWith('.png') &&
        !rel.endsWith('.jpg')
      )
        continue
      const abs = path.join(ROOT, rel)
      if (fs.existsSync(abs)) continue
      // 已删除：必须有已批准/已完成的审批条目指向它
      const approved = approvals
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.includes(rel) ||
            (rel.startsWith('design/records/') && line.includes(path.basename(rel)))
        )
        .some((line) => /\b(approved|done)\b/.test(line))
      if (!approved)
        errors.push(`检测到未审批删除：${rel} —— 请先在 design/APPROVALS.md 取得人工批准`)
    }
  }

  return { ok: errors.length === 0, errors, warnings, records }
}

/* --------------------------------- 修复模式 -------------------------------- */

export function regenerateIndex() {
  const recordsDir = path.join(ROOT, 'design', 'records')
  const records = []
  if (fs.existsSync(recordsDir)) {
    for (const file of fs
      .readdirSync(recordsDir)
      .filter((f) => f.endsWith('.md'))
      .sort()) {
      const raw = readIfExists(path.join(recordsDir, file)) ?? ''
      const { data } = parseFrontMatter(raw)
      if (!data || !data.id) continue
      records.push({
        id: data.id,
        date: data.date,
        title: data.title,
        status: data.status,
        owner: data.owner,
        reviewer: data.reviewer,
        file: `design/records/${file}`
      })
    }
  }
  records.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const payload = {
    version: INDEX_VERSION,
    note: '本文件由 scripts/design-ledger.mjs --fix 生成；手工修改后请立即运行 npm run design:check 校验。',
    records
  }
  fs.writeFileSync(
    path.join(ROOT, 'design', 'index.json'),
    JSON.stringify(payload, null, 2) + '\n',
    'utf8'
  )
  return payload
}

/* ----------------------------------- CLI ---------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const argv = process.argv.slice(2)
  if (argv.includes('--fix')) {
    const payload = regenerateIndex()
    console.log(`✔ 已依据 records/ 重新生成 design/index.json（${payload.records.length} 条记录）`)
  }
  const result = checkDesignLedger()
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (!result.ok) {
      console.error('✘ 设计台账校验失败：')
      for (const e of result.errors) console.error('  - ' + e)
    }
    for (const w of result.warnings) console.warn('  ! ' + w)
    if (result.ok) {
      console.log(`✔ 设计台账校验通过（${result.records.length} 条记录，设计中枢完整）`)
    }
  }
  process.exit(result.ok ? 0 : 1)
}
