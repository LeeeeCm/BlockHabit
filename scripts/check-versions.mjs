#!/usr/bin/env node
/**
 * 版本号一致性门禁（C4 零依赖项 / D-20261111-048 F6 的前置）。
 *
 * 三个构建入口必须保持同一版本号，否则安装包、托盘标题与更新检查会出现不一致：
 *   - package.json        （npm 包版本）
 *   - src-tauri/tauri.conf.json（Tauri 应用版本 / 安装包版本）
 *   - src-tauri/Cargo.toml（Rust crate 版本）
 *
 * 用法：node scripts/check-versions.mjs [--json]
 * 退出码：0 一致；1 不一致或文件不可读。纯本地、零依赖、不联网。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '..')

/** 从 Cargo.toml 中取 [package] 段的 version（只解析本仓库已知格式，不引入 TOML 依赖） */
export function parseCargoPackageVersion(tomlText) {
  let inPackage = false
  for (const rawLine of String(tomlText ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      inPackage = line === '[package]'
      continue
    }
    if (!inPackage) continue
    const match = line.match(/^version\s*=\s*"([^"]+)"/)
    if (match) return match[1]
  }
  return null
}

/** 读取三个构建入口的版本号（供脚本与测试复用） */
export function readVersions(root = ROOT) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
  const pkg = JSON.parse(read('package.json'))
  const tauri = JSON.parse(read('src-tauri/tauri.conf.json'))
  const cargoVersion = parseCargoPackageVersion(read('src-tauri/Cargo.toml'))
  return {
    packageJson: pkg.version ?? null,
    tauriConf: tauri.version ?? null,
    cargoToml: cargoVersion
  }
}

/** 校验三个版本号一致；返回 { ok, versions, mismatches } */
export function checkVersions(root = ROOT) {
  const versions = readVersions(root)
  const entries = Object.entries(versions)
  const values = new Set(entries.map(([, value]) => value))
  const missing = entries.filter(([, value]) => !value).map(([key]) => key)
  const mismatches = values.size > 1 || missing.length > 0 ? entries : []
  return {
    ok: values.size === 1 && missing.length === 0,
    versions,
    missing,
    mismatches
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let result
  try {
    result = checkVersions()
  } catch (err) {
    console.error('✘ 版本号校验失败：无法读取构建文件', err instanceof Error ? err.message : err)
    process.exit(1)
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else if (result.ok) {
    console.log('✔ 版本号一致：' + Object.values(result.versions)[0])
  } else {
    console.error('✘ 版本号不一致：')
    for (const [file, version] of Object.entries(result.versions)) {
      console.error('  - ' + file + ': ' + (version ?? '(缺失)'))
    }
    if (result.missing.length > 0) console.error('  缺失字段：' + result.missing.join(', '))
    console.error(
      '  请同步 package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml 的版本号。'
    )
  }
  process.exit(result.ok ? 0 : 1)
}
