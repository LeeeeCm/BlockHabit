import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkVersions, parseCargoPackageVersion, readVersions, ROOT } from './check-versions.mjs'

/**
 * C4 零依赖项：版本号一致性门禁的单元测试。
 * 用临时目录构造三份构建文件，覆盖一致 / 不一致 / 缺失 / 解析边界。
 */
function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-versions-'))
  fs.mkdirSync(path.join(dir, 'src-tauri'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(files.packageJson ?? {}, null, 2))
  fs.writeFileSync(
    path.join(dir, 'src-tauri', 'tauri.conf.json'),
    JSON.stringify(files.tauriConf ?? {}, null, 2)
  )
  fs.writeFileSync(path.join(dir, 'src-tauri', 'Cargo.toml'), files.cargoToml ?? '')
  return dir
}

describe('parseCargoPackageVersion', () => {
  it('只取 [package] 段的 version，忽略其它段与注释', () => {
    const toml = [
      '[workspace]',
      'version = "9.9.9"',
      '',
      '[package]',
      'name = "blockhabit"',
      'version = "0.2.0"',
      '',
      '[dependencies]',
      'version = "1.2.3"'
    ].join('\n')
    expect(parseCargoPackageVersion(toml)).toBe('0.2.0')
  })

  it('缺失 [package] 或 version 时返回 null', () => {
    expect(parseCargoPackageVersion('[dependencies]\nversion = "1.0.0"')).toBeNull()
    expect(parseCargoPackageVersion('')).toBeNull()
  })
})

describe('checkVersions', () => {
  it('当前仓库三处版本一致', () => {
    const result = checkVersions(ROOT)
    expect(result.ok).toBe(true)
    expect(new Set(Object.values(result.versions)).size).toBe(1)
    expect(readVersions(ROOT).packageJson).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('三处一致时 ok=true', () => {
    const dir = makeRepo({
      packageJson: { version: '1.2.3' },
      tauriConf: { version: '1.2.3' },
      cargoToml: '[package]\nname = "blockhabit"\nversion = "1.2.3"\n'
    })
    expect(checkVersions(dir)).toMatchObject({ ok: true, missing: [] })
  })

  it('任意一处不一致时 ok=false 并列出三份版本', () => {
    const dir = makeRepo({
      packageJson: { version: '1.2.3' },
      tauriConf: { version: '1.2.4' },
      cargoToml: '[package]\nversion = "1.2.3"\n'
    })
    const result = checkVersions(dir)
    expect(result.ok).toBe(false)
    expect(result.versions).toEqual({
      packageJson: '1.2.3',
      tauriConf: '1.2.4',
      cargoToml: '1.2.3'
    })
  })

  it('缺少版本字段时 ok=false 并标出缺失项', () => {
    const dir = makeRepo({
      packageJson: { version: '1.2.3' },
      tauriConf: {},
      cargoToml: '[package]\nversion = "1.2.3"\n'
    })
    const result = checkVersions(dir)
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('tauriConf')
  })
})
