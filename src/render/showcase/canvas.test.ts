import { describe, expect, it } from 'vitest'
import { relativeLuminance, type IsoPalette } from '../isoColor'
import { SANDBOX_TINTS, buildSandboxBasePalette } from './canvas'

const light: IsoPalette = {
  top: '#f4f4f4',
  left: '#c9c9c9',
  right: '#8a8a8a',
  ghost: '#d0d0d0',
  line: '#e0e0e0',
  accent: '#f5b301',
  ink: '#0a0a0a'
}

const dark: IsoPalette = {
  top: '#424242',
  left: '#303030',
  right: '#1c1c1c',
  ghost: '#333333',
  line: '#2a2a2a',
  accent: '#f5b301',
  ink: '#f4f4f4'
}

describe('沙盘设计底色（D-20261128-128）', () => {
  it('素盘保持主题原底座，不染色', () => {
    expect(buildSandboxBasePalette(light, 'bare')).toBe(light)
    expect(SANDBOX_TINTS.bare).toBeNull()
  })

  it('三种设计都产生可见但不同的底座色', () => {
    const moss = buildSandboxBasePalette(light, 'moss')
    const stone = buildSandboxBasePalette(light, 'stone')
    const bloom = buildSandboxBasePalette(light, 'bloom')
    expect(new Set([moss.top, stone.top, bloom.top, light.top]).size).toBe(4)
    expect(SANDBOX_TINTS.moss).toBe('#4f776a')
    expect(SANDBOX_TINTS.stone).toBe('#a89f91')
    expect(SANDBOX_TINTS.bloom).toBe('#e9c46a')
  })

  it('染色后仍保持顶面最亮、右面最暗（纸白与墨黑）', () => {
    for (const palette of [light, dark]) {
      for (const design of ['moss', 'stone', 'bloom'] as const) {
        const tinted = buildSandboxBasePalette(palette, design)
        const top = relativeLuminance(tinted.top)
        const left = relativeLuminance(tinted.left)
        const right = relativeLuminance(tinted.right)
        expect(top).toBeGreaterThan(left)
        expect(left).toBeGreaterThan(right)
      }
    }
  })

  it('底座色只改变顶/左/右，不动 ink、ghost、accent', () => {
    const tinted = buildSandboxBasePalette(light, 'moss')
    expect(tinted.ink).toBe(light.ink)
    expect(tinted.ghost).toBe(light.ghost)
    expect(tinted.accent).toBe(light.accent)
  })
})
