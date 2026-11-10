import { describe, it, expect } from 'vitest'
import {
  JIANGUOYUN_ENDPOINT,
  PROVIDER_ORDER,
  PROVIDER_PRESETS,
  buildEndpoint,
  normalizeServerBase,
  switchProvider,
  type ProviderId,
} from './providers'

describe('providers：WebDAV 服务商预设', () => {
  it('PROVIDER_ORDER 覆盖四个预设且与 PRESETS 键一致', () => {
    expect(PROVIDER_ORDER).toEqual(['nextcloud', 'jianguoyun', 'synology', 'generic'])
    for (const id of PROVIDER_ORDER) {
      expect(PROVIDER_PRESETS[id].id).toBe(id)
      expect(typeof PROVIDER_PRESETS[id].buildEndpoint).toBe('function')
    }
  })

  it('requiresServer / requiresAppPassword 标志符合产品设定', () => {
    expect(PROVIDER_PRESETS.nextcloud.requiresServer).toBe(true)
    expect(PROVIDER_PRESETS.nextcloud.requiresAppPassword).toBe(true)
    expect(PROVIDER_PRESETS.jianguoyun.requiresServer).toBe(false)
    expect(PROVIDER_PRESETS.jianguoyun.requiresAppPassword).toBe(true)
    expect(PROVIDER_PRESETS.synology.requiresServer).toBe(true)
    expect(PROVIDER_PRESETS.synology.requiresAppPassword).toBe(false)
    expect(PROVIDER_PRESETS.generic.requiresServer).toBe(true)
    expect(PROVIDER_PRESETS.generic.requiresAppPassword).toBe(false)
  })

  it('Nextcloud：base + /remote.php/dav/files/<username>/BlockHabit/', () => {
    expect(buildEndpoint('nextcloud', 'https://cloud.example.com', 'alice')).toBe(
      'https://cloud.example.com/remote.php/dav/files/alice/BlockHabit/',
    )
  })

  it('Nextcloud：无协议输入自动补 https、尾斜杠被规范化', () => {
    expect(buildEndpoint('nextcloud', 'cloud.example.com/', 'alice')).toBe(
      'https://cloud.example.com/remote.php/dav/files/alice/BlockHabit/',
    )
    expect(buildEndpoint('nextcloud', '  HTTPS://cloud.example.com//  ', 'alice')).toBe(
      'https://cloud.example.com/remote.php/dav/files/alice/BlockHabit/',
    )
  })

  it('Nextcloud：用户名做 URL 编码（中文/空格/特殊字符）', () => {
    const username = '张三 三+1'
    const endpoint = buildEndpoint('nextcloud', 'https://cloud.example.com', username)
    expect(endpoint).toContain(encodeURIComponent(username))
    expect(endpoint).toContain('/remote.php/dav/files/')
    // 不允许把原始空格/中文直接拼进 URL
    expect(endpoint).not.toContain(' ')
    expect(endpoint).not.toContain('张三')
    expect(endpoint).toBe(
      `https://cloud.example.com/remote.php/dav/files/${encodeURIComponent(username)}/BlockHabit/`,
    )
  })

  it('Nextcloud：缺 base 或 username 时返回空串（信息不足不生成半截 URL）', () => {
    expect(buildEndpoint('nextcloud', '', 'alice')).toBe('')
    expect(buildEndpoint('nextcloud', 'https://cloud.example.com', '')).toBe('')
    expect(buildEndpoint('nextcloud', 'https://cloud.example.com', '   ')).toBe('')
  })

  it('坚果云：固定端点，忽略 base/username', () => {
    expect(buildEndpoint('jianguoyun', '', '')).toBe(JIANGUOYUN_ENDPOINT)
    expect(buildEndpoint('jianguoyun', 'https://whatever.example.com', 'whoever')).toBe(JIANGUOYUN_ENDPOINT)
    expect(JIANGUOYUN_ENDPOINT).toBe('https://dav.jianguoyun.com/dav/BlockHabit/')
  })

  it('群晖：base + /home/BlockHabit/', () => {
    expect(buildEndpoint('synology', 'https://nas.example.com:5006', 'alice')).toBe(
      'https://nas.example.com:5006/home/BlockHabit/',
    )
    expect(buildEndpoint('synology', 'nas.example.com', 'alice')).toBe(
      'https://nas.example.com/home/BlockHabit/',
    )
    expect(buildEndpoint('synology', '', 'alice')).toBe('')
  })

  it('通用：规范化输入并补尾斜杠，保留路径', () => {
    expect(buildEndpoint('generic', 'dav.example.com/dav', '')).toBe('https://dav.example.com/dav/')
    expect(buildEndpoint('generic', 'https://dav.example.com/dav/', '')).toBe('https://dav.example.com/dav/')
    expect(buildEndpoint('generic', 'https://dav.example.com/dav?x=1#hash', '')).toBe(
      'https://dav.example.com/dav/',
    )
    expect(buildEndpoint('generic', '', '')).toBe('')
  })

  it('未知服务商 id 返回空串（防御脏数据）', () => {
    expect(buildEndpoint('nope' as ProviderId, 'https://dav.example.com', 'alice')).toBe('')
  })

  it('normalizeServerBase：补协议 / 去尾斜杠 / 合并重复斜杠 / 去 query', () => {
    expect(normalizeServerBase('')).toBe('')
    expect(normalizeServerBase('   ')).toBe('')
    expect(normalizeServerBase('dav.example.com')).toBe('https://dav.example.com')
    expect(normalizeServerBase('//dav.example.com')).toBe('https://dav.example.com')
    expect(normalizeServerBase('HTTP://DAV.example.com//')).toBe('http://DAV.example.com')
    expect(normalizeServerBase('https://dav.example.com/a//b///')).toBe('https://dav.example.com/a/b')
    expect(normalizeServerBase('https://dav.example.com/a?query=1#f')).toBe('https://dav.example.com/a')
  })

  it('切换服务商：旧 endpoint 绝不沿用，一律按新预设重建', () => {
    const before = {
      providerId: 'nextcloud' as ProviderId,
      base: 'https://cloud.example.com',
      username: 'alice',
      endpoint: buildEndpoint('nextcloud', 'https://cloud.example.com', 'alice'),
    }
    const toGeneric = switchProvider(before, 'generic')
    expect(toGeneric.providerId).toBe('generic')
    expect(toGeneric.endpoint).not.toBe(before.endpoint)
    expect(toGeneric.endpoint).toBe('https://cloud.example.com/')

    // base 为空时切到需要服务器的预设 → endpoint 清空，不残留旧地址
    const cleared = switchProvider({ ...before, base: '' }, 'synology')
    expect(cleared.endpoint).toBe('')
    expect(cleared.providerId).toBe('synology')

    // 切到坚果云：固定端点 + 清空 base
    const toJianguoyun = switchProvider(before, 'jianguoyun')
    expect(toJianguoyun.endpoint).toBe(JIANGUOYUN_ENDPOINT)
    expect(toJianguoyun.base).toBe('')
  })

  it('切回同一服务商：按当前 base/username 重建（幂等）', () => {
    const state = {
      providerId: 'nextcloud' as ProviderId,
      base: 'https://cloud.example.com',
      username: 'alice',
      endpoint: 'stale-endpoint',
    }
    const rebuilt = switchProvider(state, 'nextcloud')
    expect(rebuilt.endpoint).toBe(buildEndpoint('nextcloud', state.base, state.username))
  })
})
