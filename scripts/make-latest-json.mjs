#!/usr/bin/env node
import fs from 'node:fs'

/**
 * C4 发布链路脚手架：生成 Tauri updater 的 latest.json。
 *
 * 只做纯数据组装与校验，不联网、不读取私钥；签名值来自 tauri build 产出的 .sig 文件，
 * 下载地址由发布流程（GitHub Release / 静态托管）提供（D-20261111-069 / D-20261112-071）。
 *
 * latest.json 规范：
 * {
 *   "version": "0.2.0",
 *   "notes": "…",
 *   "pub_date": "2026-11-12T00:00:00Z",
 *   "platforms": { "windows-x86_64": { "signature": "…", "url": "https://…" } }
 * }
 */

const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const PLATFORM_RE = /^[a-z0-9]+-[a-z0-9_]+$/

/** 生成 ISO 时间（去掉毫秒，Tauri 官方示例格式） */
export function formatPubDate(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function buildLatestJson({
  version,
  notes = '',
  pubDate = formatPubDate(),
  platform = 'windows-x86_64',
  signature,
  url
}) {
  if (typeof version !== 'string' || !VERSION_RE.test(version)) {
    throw new Error(`version 非法：${version}`)
  }
  if (typeof signature !== 'string' || signature.trim() === '') {
    throw new Error('signature 不能为空（应为 tauri build 产出的 .sig 内容）')
  }
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) {
    throw new Error(`url 必须是 https 地址：${url}`)
  }
  if (typeof platform !== 'string' || !PLATFORM_RE.test(platform)) {
    throw new Error(`platform 非法：${platform}`)
  }
  if (typeof notes !== 'string') throw new Error('notes 必须是字符串')
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      [platform]: { signature: signature.trim(), url }
    }
  }
}

/** 读取文件并去首尾空白（.sig 文件常带换行） */
export function readTextFile(file) {
  return fs.readFileSync(file, 'utf8').trim()
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith('--')) throw new Error(`未知参数：${key}`)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`参数缺少值：${key}`)
    out[key.slice(2)] = value
    i++
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.version) throw new Error('缺少 --version')
  if (!args.url) throw new Error('缺少 --url')
  const signature = args['signature-file'] ? readTextFile(args['signature-file']) : args.signature
  if (!signature) throw new Error('缺少 --signature 或 --signature-file')
  const notes = args['notes-file'] ? readTextFile(args['notes-file']) : (args.notes ?? '')
  const json = buildLatestJson({
    version: args.version,
    notes,
    pubDate: args['pub-date'],
    platform: args.platform ?? 'windows-x86_64',
    signature,
    url: args.url
  })
  const text = JSON.stringify(json, null, 2) + '\n'
  if (args.out) {
    fs.writeFileSync(args.out, text)
    console.log(`✔ 已写入 ${args.out}（version ${json.version}）`)
  } else {
    process.stdout.write(text)
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('make-latest-json.mjs')
) {
  try {
    main()
  } catch (error) {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
