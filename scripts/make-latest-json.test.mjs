import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildLatestJson, formatPubDate, readTextFile } from './make-latest-json.mjs'

/**
 * C4 发布链路脚手架：latest.json 组装与校验（纯函数，不联网）。
 */
describe('buildLatestJson', () => {
  it('生成 Tauri updater 结构：version/notes/pub_date/platforms', () => {
    const json = buildLatestJson({
      version: '0.2.0',
      notes: 'test notes',
      pubDate: '2026-11-12T00:00:00Z',
      signature: 'sig-abc',
      url: 'https://example.com/BlockHabit_0.2.0_x64-setup.exe'
    })
    expect(json).toEqual({
      version: '0.2.0',
      notes: 'test notes',
      pub_date: '2026-11-12T00:00:00Z',
      platforms: {
        'windows-x86_64': {
          signature: 'sig-abc',
          url: 'https://example.com/BlockHabit_0.2.0_x64-setup.exe'
        }
      }
    })
  })

  it('可指定平台；signature 去首尾空白', () => {
    const json = buildLatestJson({
      version: '1.2.3',
      signature: '  sig  ',
      url: 'https://example.com/a.exe',
      platform: 'darwin-aarch64'
    })
    expect(json.platforms['darwin-aarch64'].signature).toBe('sig')
  })

  it('version 非法时报错（空 / 两段 / 非数字）', () => {
    for (const version of ['', '1.2', 'v1.2.3', '1.2.x']) {
      expect(() => buildLatestJson({ version, signature: 's', url: 'https://e.com/a' })).toThrow(
        /version/
      )
    }
  })

  it('signature 为空时报错', () => {
    expect(() =>
      buildLatestJson({ version: '1.2.3', signature: '  ', url: 'https://e.com/a' })
    ).toThrow(/signature/)
  })

  it('url 必须是 https', () => {
    for (const url of ['http://e.com/a', 'ftp://e.com/a', '']) {
      expect(() => buildLatestJson({ version: '1.2.3', signature: 's', url })).toThrow(/url/)
    }
  })

  it('platform 非法时报错', () => {
    expect(() =>
      buildLatestJson({
        version: '1.2.3',
        signature: 's',
        url: 'https://e.com/a',
        platform: 'Windows'
      })
    ).toThrow(/platform/)
  })
})

describe('formatPubDate / readTextFile', () => {
  it('formatPubDate 去掉毫秒并保持 Z 结尾', () => {
    expect(formatPubDate(new Date('2026-11-12T01:02:03.456Z'))).toBe('2026-11-12T01:02:03Z')
  })

  it('readTextFile 读取并 trim 签名文件', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-latest-'))
    const file = path.join(dir, 'a.sig')
    fs.writeFileSync(file, '  sig\n')
    expect(readTextFile(file)).toBe('sig')
  })
})
