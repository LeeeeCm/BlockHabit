import { describe, expect, it } from 'vitest'
import {
  buildChecks,
  DEFAULT_REPO,
  latestJsonUrl,
  requiredAssetSuffixes,
  summarize
} from './check-release.mjs'

/**
 * 发布后自检的纯逻辑单测（D-20261114-073 之后新增的发布工具）。
 * 这里只测「事实 → 检查项」的判定，不联网、不调 gh。
 */

const goodLatest = {
  version: '0.2.1',
  platforms: {
    'windows-x86_64': {
      signature: 'SIG-CONTENT',
      url: 'https://github.com/LeeeeCm/BlockHabit/releases/download/v0.2.1/BlockHabit_0.2.1_x64-setup.exe'
    }
  }
}

const goodRelease = {
  tagName: 'v0.2.1',
  isDraft: false,
  isPrerelease: false,
  assets: [
    { name: 'latest.json' },
    { name: 'BlockHabit_0.2.1_x64-setup.exe' },
    { name: 'BlockHabit_0.2.1_x64-setup.exe.sig' },
    { name: 'BlockHabit_0.2.1_x64-setup.exe.sha256' }
  ]
}

function baseArgs(overrides = {}) {
  return {
    version: '0.2.1',
    latestStatus: 200,
    latest: goodLatest,
    release: goodRelease,
    assets: goodRelease.assets,
    sigText: 'SIG-CONTENT\n',
    sha256Text: 'dee8a0d  BlockHabit_0.2.1_x64-setup.exe\n',
    expectedSha256: 'dee8a0d',
    exeHeadStatus: 200,
    ...overrides
  }
}

function failedNames(checks) {
  return checks.filter((c) => !c.ok).map((c) => c.name)
}

describe('check-release：地址与资产清单', () => {
  it('latest.json 地址与 updater 端点一致（releases/latest/download）', () => {
    expect(latestJsonUrl(DEFAULT_REPO, '0.2.1')).toBe(
      `https://github.com/${DEFAULT_REPO}/releases/latest/download/latest.json`
    )
  })

  it('必需资产后缀覆盖 exe / sig / latest.json', () => {
    expect(requiredAssetSuffixes()).toContain('latest.json')
    expect(requiredAssetSuffixes().some((s) => s.endsWith('x64-setup.exe'))).toBe(true)
    expect(requiredAssetSuffixes().some((s) => s.endsWith('.exe.sig'))).toBe(true)
    expect(requiredAssetSuffixes().some((s) => s.endsWith('.exe.sha256'))).toBe(true)
  })
})

describe('check-release：判定', () => {
  it('全部事实正常时 0 失败', () => {
    const result = summarize(buildChecks(baseArgs()))
    expect(result.ok).toBe(true)
    expect(result.failed).toBe(0)
    expect(result.total).toBeGreaterThanOrEqual(9)
  })

  it('latest.json 404 会失败并保留 HTTP 状态', () => {
    const checks = buildChecks(baseArgs({ latestStatus: 404, latest: null }))
    expect(failedNames(checks)).toContain('latest.json 公网可读（HTTP 200）')
  })

  it('版本不一致会失败（防止把旧 Release 当新版本发布）', () => {
    const checks = buildChecks(baseArgs({ latest: { ...goodLatest, version: '0.2.0' } }))
    expect(failedNames(checks)).toContain('latest.json version 与期望一致')
  })

  it('draft / prerelease 会被判定为未发布', () => {
    const checks = buildChecks(baseArgs({ release: { ...goodRelease, isDraft: true } }))
    expect(failedNames(checks)).toContain('Release 已发布（非 draft / 非 prerelease）')
  })

  it('缺 .sig 资产或 sig 内容不一致都会失败', () => {
    const missingSig = buildChecks(
      baseArgs({ assets: goodRelease.assets.filter((a) => !a.name.endsWith('.sig')) })
    )
    expect(failedNames(missingSig).some((n) => n.includes('.sig'))).toBe(true)

    const mismatch = buildChecks(baseArgs({ sigText: 'DIFFERENT' }))
    expect(failedNames(mismatch)).toContain('.sig 与 latest.json 的 signature 逐字节一致')
  })

  it('url 指向别的 tag 会失败', () => {
    const badUrl = {
      ...goodLatest,
      platforms: {
        'windows-x86_64': {
          signature: 'SIG-CONTENT',
          url: 'https://github.com/LeeeeCm/BlockHabit/releases/download/v0.2.0/x64-setup.exe'
        }
      }
    }
    const checks = buildChecks(baseArgs({ latest: badUrl }))
    expect(failedNames(checks)).toContain('latest.json 的 url 指向本 Release 的安装包')
  })

  it('给了期望 sha256 时不一致会失败（--download 路径）', () => {
    const checks = buildChecks(baseArgs({ exeSha256: 'aaa', expectedSha256: 'bbb' }))
    expect(failedNames(checks)).toContain('安装包 sha256 与 GitHub 记录的 digest 一致')
  })

  it('缺 .sha256 资产会失败（发布必须带校验文件）', () => {
    const checks = buildChecks(
      baseArgs({ assets: goodRelease.assets.filter((a) => !a.name.endsWith('.sha256')) })
    )
    expect(failedNames(checks).some((n) => n.includes('.sha256'))).toBe(true)
  })

  it('.sha256 内容与 GitHub digest 不一致会失败', () => {
    const checks = buildChecks(
      baseArgs({ sha256Text: '0000000  BlockHabit_0.2.1_x64-setup.exe\n' })
    )
    expect(failedNames(checks)).toContain('.sha256 资产的 hash 与 GitHub 记录的 digest 一致')
  })
})
