import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  playSnapSound,
  playJellySound,
  playCelebrationSound,
  playComboChime,
  setSoundMuted,
  _resetAudioContextForTest,
} from './sound'

describe('Web Audio sound synthesis', () => {
  let origAudioContext: typeof window.AudioContext
  beforeEach(() => {
    _resetAudioContextForTest()
    setSoundMuted(false)
    origAudioContext = window.AudioContext
  })

  afterEach(() => {
    _resetAudioContextForTest()
    window.AudioContext = origAudioContext
    setSoundMuted(false)
  })

  it('skips audio playback when muted', () => {
    const resumeSpy = vi.fn().mockResolvedValue(undefined)
    window.AudioContext = class MockAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume = resumeSpy
      createOscillator = vi.fn()
      createGain = vi.fn()
      createBiquadFilter = vi.fn()
    } as unknown as typeof window.AudioContext

    setSoundMuted(true)
    playSnapSound()
    playJellySound()
    playCelebrationSound()
    playComboChime()

    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('calls resume when context state is suspended', async () => {
    const resumeSpy = vi.fn().mockResolvedValue(undefined)
    const startSpy = vi.fn()

    window.AudioContext = class MockAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume = resumeSpy.mockImplementation(async () => {
        this.state = 'running'
      })
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: startSpy,
          stop: vi.fn(),
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        }
      }
      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        }
      }
    } as unknown as typeof window.AudioContext

    playSnapSound('walnut')
    await vi.waitFor(() => {
      expect(resumeSpy).toHaveBeenCalled()
    })
  })

  it('silently skips without throwing if resume rejects', async () => {
    const resumeSpy = vi.fn().mockRejectedValue(new Error('Autoplay blocked'))
    const startSpy = vi.fn()

    window.AudioContext = class MockAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume = resumeSpy
      createOscillator() {
        return { start: startSpy }
      }
      createGain = vi.fn()
    } as unknown as typeof window.AudioContext

    expect(() => {
      playSnapSound('walnut')
    }).not.toThrow()

    await vi.waitFor(() => {
      expect(resumeSpy).toHaveBeenCalled()
    })
    expect(startSpy).not.toHaveBeenCalled()
  })
})
