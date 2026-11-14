import { describe, expect, it } from 'vitest'
import { detectProvider, endpointHost, isJianguoyunEndpoint } from './WebdavPanel'

/**
 * D-20261115-079：CodeQL js/incomplete-url-substring-sanitization 首次扫描指出
 * 服务商识别用 URL 子串判断可被伪造；改为解析 host 后锁住行为。
 */

describe('WebDAV 服务商识别（host 判定）', () => {
  it('识别坚果云固定端点及其子域', () => {
    expect(isJianguoyunEndpoint('https://dav.jianguoyun.com/dav/')).toBe(true)
    expect(detectProvider('https://dav.jianguoyun.com/dav/')).toBe('jianguoyun')
    expect(detectProvider('https://JIANGUOYUN.com/')).toBe('jianguoyun')
  })

  it('host 之外的 jianguoyun.com 不再误判（回归 CodeQL 告警）', () => {
    expect(isJianguoyunEndpoint('https://evil.example/?x=jianguoyun.com')).toBe(false)
    expect(detectProvider('https://evil.example/?x=jianguoyun.com')).toBe('generic')
  })

  it('nextcloud / synology 仍按 path 标记识别', () => {
    expect(detectProvider('https://cloud.example.com/remote.php/dav/files/alice/')).toBe(
      'nextcloud'
    )
    expect(detectProvider('https://nas.example.com/home/BlockHabit')).toBe('synology')
  })

  it('非法或空 endpoint 不抛错，回退 generic', () => {
    expect(endpointHost('not a url')).toBe('')
    expect(detectProvider('')).toBe('generic')
    expect(detectProvider('not a url')).toBe('generic')
  })
})
