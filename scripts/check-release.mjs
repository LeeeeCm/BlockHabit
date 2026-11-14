#!/usr/bin/env node
/**
 * 发布后自检（2026-11-14 发布链路启用后新增）。
 *
 * 只做一件事：把「Release 真的存在、资产真的齐、latest.json 真的公网可读、
 * .sig 与清单里的 signature 真的逐字节一致」变成一条命令，发布后/回归时都能跑。
 *
 * 设计约束：
 * - 零依赖、纯 Node（仓库已有 Node），不依赖 PowerShell 版本差异（Windows PowerShell 5.1 的
 *   Invoke-WebRequest 在无 IE 首启配置时会抛 NonInteractive，是真实踩过的坑）。
 * - 只用公开 HTTP；私钥、secrets 一律不读、不打印。
 * - 纯逻辑（buildChecks）与 IO（runCli）分开，纯逻辑可单测。
 *
 * 用法：
 *   node scripts/check-release.mjs --version 0.2.1
 *   node scripts/check-release.mjs --version 0.2.1 --repo LeeeeCm/BlockHabit --download
 *
 * 退出码：0 全部通过；1 有失败项（会列出每一项）。
 */
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

export const DEFAULT_REPO = 'LeeeeCm/BlockHabit'
export const REQUIRED_ASSETS = [
  'latest.json',
  'x64-setup.exe',
  'x64-setup.exe.sig',
  'x64-setup.exe.sha256'
]

/** 从仓库名与版本拼出 latest.json 的公开地址（updater 用的就是这个 URL） */
export function latestJsonUrl(repo, version) {
  void version
  return `https://github.com/${repo}/releases/latest/download/latest.json`
}

/** 发布资产必须覆盖的基名（exe / sig / latest.json；msi 可选） */
export function requiredAssetSuffixes() {
  return [...REQUIRED_ASSETS]
}

/**
 * 纯逻辑：把「抓到的事实」变成一组可读的检查项。
 * 失败项不抛异常，全部收集后由 CLI 汇总，保证一次跑完能看到所有问题。
 */
export function buildChecks({
  version,
  latestStatus,
  latest,
  release,
  assets,
  sigText,
  sha256Text,
  exeHeadStatus,
  exeSha256,
  expectedSha256
}) {
  const checks = []
  const push = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail: detail ?? '' })

  push('latest.json 公网可读（HTTP 200）', latestStatus === 200, `HTTP ${latestStatus}`)
  push(
    'latest.json version 与期望一致',
    latest?.version === version,
    `期望 ${version}，实际 ${latest?.version}`
  )

  push(
    'GitHub Release 存在',
    Boolean(release),
    release ? release.tagName : 'gh release view 无结果'
  )
  push(
    'Release 已发布（非 draft / 非 prerelease）',
    release ? release.isDraft === false && release.isPrerelease === false : false,
    release ? `draft=${release.isDraft} prerelease=${release.isPrerelease}` : ''
  )

  const names = (assets ?? []).map((a) => a.name)
  for (const suffix of requiredAssetSuffixes()) {
    push(
      `资产包含 *${suffix}`,
      names.some((n) => n.endsWith(suffix)),
      names.join(', ')
    )
  }

  const platform = latest?.platforms?.['windows-x86_64']
  const url = platform?.url ?? ''
  push(
    'latest.json 的 url 指向本 Release 的安装包',
    typeof url === 'string' &&
      url.includes(`/releases/download/v${version}/`) &&
      /x64-setup\.exe$/.test(url),
    url
  )

  push(
    '.sig 与 latest.json 的 signature 逐字节一致',
    typeof sigText === 'string' &&
      typeof platform?.signature === 'string' &&
      sigText.trim() === platform.signature.trim(),
    sigText
      ? `sig=${sigText.length}B signature=${platform?.signature?.length ?? 0}B`
      : '未取到 .sig'
  )

  push('安装包公开可下（HEAD 200）', exeHeadStatus === 200, `HTTP ${exeHeadStatus}`)

  const recordedSha256 =
    typeof sha256Text === 'string' ? (sha256Text.trim().split(/\s+/)[0] ?? '').toLowerCase() : ''
  push(
    '.sha256 资产的 hash 与 GitHub 记录的 digest 一致',
    Boolean(recordedSha256) && Boolean(expectedSha256) && recordedSha256 === expectedSha256,
    recordedSha256
      ? `${recordedSha256} vs ${expectedSha256 || '(GitHub 未返回 digest)'}`
      : '未取到 .sha256'
  )

  if (exeSha256 && expectedSha256) {
    push(
      '安装包 sha256 与 GitHub 记录的 digest 一致',
      exeSha256 === expectedSha256,
      `${exeSha256} vs ${expectedSha256}`
    )
  }

  return checks
}

export function summarize(checks) {
  const failed = checks.filter((c) => !c.ok)
  return { ok: failed.length === 0, total: checks.length, failed: failed.length, checks }
}

/* ---------------------------------- CLI ---------------------------------- */

function parseArgs(argv) {
  const out = { repo: DEFAULT_REPO, download: false }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === '--download') {
      out.download = true
      continue
    }
    if (key === '--json') {
      out.json = true
      continue
    }
    if (key === '--version' || key === '--repo') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`参数缺少值：${key}`)
      out[key.slice(2)] = value
      i++
      continue
    }
    throw new Error(`未知参数：${key}`)
  }
  if (!out.version) throw new Error('缺少 --version（例如 --version 0.2.1）')
  return out
}

function ghRelease(repo, version) {
  try {
    const json = execFileSync(
      'gh',
      [
        'release',
        'view',
        `v${version}`,
        '--repo',
        repo,
        '--json',
        'tagName,isDraft,isPrerelease,assets'
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function httpStatus(url, method = 'GET') {
  try {
    const res = await fetch(url, { method, redirect: 'follow' })
    return res.status
  } catch {
    return 0
  }
}

async function runCli(argv) {
  const args = parseArgs(argv)
  const url = latestJsonUrl(args.repo, args.version)

  const latestStatus = await httpStatus(url)
  let latest = null
  if (latestStatus === 200) {
    const res = await fetch(url, { redirect: 'follow' })
    latest = JSON.parse(await res.text())
  }

  const platform = latest?.platforms?.['windows-x86_64']
  const exeUrl = platform?.url ?? ''
  let sigText = ''
  let sha256Text = ''
  if (exeUrl) {
    const sigRes = await fetch(exeUrl + '.sig', { redirect: 'follow' })
    if (sigRes.status === 200) sigText = await sigRes.text()
    const shaRes = await fetch(exeUrl + '.sha256', { redirect: 'follow' })
    if (shaRes.status === 200) sha256Text = await shaRes.text()
  }

  const release = ghRelease(args.repo, args.version)
  const exeHeadStatus = exeUrl ? await httpStatus(exeUrl, 'HEAD') : 0

  // GitHub 资产 API 的 digest 与 .sha256 资产无关，随时可取；用于核对 .sha256 内容
  const exeAsset = (release?.assets ?? []).find((a) => exeUrl.endsWith(a.name))
  const expectedSha256 = String(exeAsset?.digest ?? '')
    .replace(/^sha256:/, '')
    .toLowerCase()

  let exeSha256 = ''
  if (args.download && exeUrl) {
    const res = await fetch(exeUrl, { redirect: 'follow' })
    const buf = Buffer.from(await res.arrayBuffer())
    exeSha256 = crypto.createHash('sha256').update(buf).digest('hex')
  }

  const checks = buildChecks({
    version: args.version,
    latestStatus,
    latest,
    release,
    assets: release?.assets,
    sigText,
    sha256Text,
    exeHeadStatus,
    exeSha256,
    expectedSha256
  })
  const result = summarize(checks)

  if (args.json) {
    console.log(JSON.stringify({ repo: args.repo, version: args.version, ...result }, null, 2))
  } else {
    console.log(`发布自检 ${args.repo} v${args.version}`)
    for (const c of checks) {
      console.log(`${c.ok ? '✔' : '✘'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
    }
    console.log(
      result.ok ? `全部通过（${result.total} 项）` : `失败 ${result.failed}/${result.total} 项`
    )
  }
  return result.ok ? 0 : 1
}

const isMain =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/check-release.mjs')
if (isMain) {
  try {
    process.exitCode = await runCli(process.argv.slice(2))
  } catch (error) {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
