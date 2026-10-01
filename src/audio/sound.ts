/**
 * Web Audio API 程序化纯合成音效（零外部音频资产依赖，极简极速）
 * 支持多物理材质 ASMR 声学建模（经典塑料、温润原木、空灵晶体、机械合金）
 */
import { useAppStore } from '../store/appStore'
import type { SoundMaterial } from '../types'

let audioCtx: AudioContext | null = null
export function _resetAudioContextForTest(): void {
  audioCtx = null
}
async function withAudioContext(run: (ctx: AudioContext) => void): Promise<void> {
  if (typeof window === 'undefined' || soundMuted) return
  if (!audioCtx) {
    const ctxCtor =
      window.AudioContext ??
      ('webkitAudioContext' in window ? (window.webkitAudioContext as typeof AudioContext) : null)
    if (ctxCtor) {
      audioCtx = new ctxCtor()
    }
  }
  if (!audioCtx) return

  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume()
    } catch {
      // 恢复失败（如无用户手势授权）时静默跳过本次，避免事件积压（§7.14）
      return
    }
  }

  if (audioCtx.state === 'running') {
    run(audioCtx)
  }
}

export let soundMuted = false

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted
}

/** 主音量 0~100（settings.volume 持久化驱动；默认 100） */
let masterVolume = 100
let masterGainRef: { ctx: AudioContext; gain: GainNode } | null = null

export function setVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(100, Math.round(volume)))
  if (masterGainRef && masterGainRef.ctx === audioCtx) {
    masterGainRef.gain.gain.value = masterVolume / 100
  }
}

export function getMasterVolume(): number {
  return masterVolume
}

/** 所有音效统一经主音量节点输出（新建/复用与 ctx 生命周期绑定） */
function getMasterGain(ctx: AudioContext): GainNode {
  if (!masterGainRef || masterGainRef.ctx !== ctx) {
    const gain = ctx.createGain()
    gain.gain.value = masterVolume / 100
    gain.connect(getMasterGain(ctx))
    masterGainRef = { ctx, gain }
  }
  return masterGainRef.gain
}

/**
 * 积木咬合声（Snap / Click）：
 * 支持按物理材质（塑料/原木/晶体/合金）分别合成声学响应
 */
export function playSnapSound(overrideMaterial?: SoundMaterial): void {
  if (soundMuted) return
  const material = overrideMaterial ?? useAppStore.getState().settings.soundMaterial ?? 'classic'
  if (material === 'mute') return
  void withAudioContext((ctx) => {
    const now = ctx.currentTime
  switch (material) {
    case 'walnut': {
      // 沉静原木：短促低频木质击打 (正弦波 280Hz -> 85Hz，低通共鸣)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(280, now)
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.055)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, now)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.42, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(getMasterGain(ctx))
      osc.start(now)
      osc.stop(now + 0.06)
      break
    }
    case 'crystal': {
      // 空灵晶体：高频双音晶体撞击 (2200Hz + 3300Hz, 35ms 泛音衰减)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      osc1.type = 'sine'
      osc2.type = 'triangle'
      osc1.frequency.setValueAtTime(2200, now)
      osc2.frequency.setValueAtTime(3300, now)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(getMasterGain(ctx))
      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.045)
      osc2.stop(now + 0.045)
      break
    }
    case 'metal': {
      // 机械合金：微高通带通冲击 + 750Hz 机械微谐振
      const bufferSize = Math.floor(ctx.sampleRate * 0.018)
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1
      const whiteNoise = ctx.createBufferSource()
      whiteNoise.buffer = noiseBuffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1800, now)
      filter.Q.setValueAtTime(3.5, now)

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.28, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
      whiteNoise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(getMasterGain(ctx))
      whiteNoise.start(now)

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(750, now)
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.03)
      const oscGain = ctx.createGain()
      oscGain.gain.setValueAtTime(0.16, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
      osc.connect(oscGain)
      oscGain.connect(getMasterGain(ctx))
      osc.start(now)
      osc.stop(now + 0.035)
      break
    }
    case 'classic':
    default: {
      // 经典塑料乐高咬合 (原有高通微噪 + 三角波)
      const bufferSize = Math.floor(ctx.sampleRate * 0.025)
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1
      const whiteNoise = ctx.createBufferSource()
      whiteNoise.buffer = noiseBuffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.setValueAtTime(1200, now)

      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.35, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

      whiteNoise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(getMasterGain(ctx))
      whiteNoise.start(now)

      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.03)

      const oscGain = ctx.createGain()
      oscGain.gain.setValueAtTime(0.3, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

      osc.connect(oscGain)
      oscGain.connect(getMasterGain(ctx))

      osc.start(now)
      osc.stop(now + 0.035)
      break
    }
  }
  })
}

/**
 * 果冻回弹音（Jelly Pop / Wobble）：
 * 新积木落地果冻回弹时的弹性滑音
 */
export function playJellySound(): void {
  void withAudioContext((ctx) => {
    const now = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, now)
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.08)
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.18)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

  osc.connect(gain)
  gain.connect(getMasterGain(ctx))

  osc.start(now)
  osc.stop(now + 0.24)
  })
}

/**
 * 大满贯 / 落成钟鸣声（Ceremony Harmonic Chord）：
 * 纯净明亮的谐波和弦，带来完成一整天或一座建筑的空灵成就感
 */
export function playCelebrationSound(): void {
  void withAudioContext((ctx) => {
    const now = ctx.currentTime
  // 经典 C 大调五度和弦：C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
  const notes = [523.25, 659.25, 783.99, 1046.5]

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + idx * 0.06)

    const gain = ctx.createGain()
    const startTime = now + idx * 0.06
    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.linearRampToValueAtTime(0.12, startTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2)

    osc.connect(gain)
    gain.connect(getMasterGain(ctx))

    osc.start(startTime)
    osc.stop(startTime + 1.25)
  })
  })
}

/**
 * 连击五声音阶音效（Pentatonic Combo Chime）：
 * C5 -> D5 -> E5 -> G5 -> A5 -> C6
 * 连续打卡时基频依次步进，带来如同敲击木琴积木般的触感与正向激励反馈
 */
const PENTATONIC_FREQS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]

export function playComboChime(comboIndex: number = 0): void {
  void withAudioContext((ctx) => {
    const now = ctx.currentTime
  const freq = PENTATONIC_FREQS[Math.min(comboIndex, PENTATONIC_FREQS.length - 1)]

  // 主音：温暖清脆木琴/积木敲击声
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  // 泛音：微小八度高光
  const overtone = ctx.createOscillator()
  overtone.type = 'sine'
  overtone.frequency.setValueAtTime(freq * 2, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.22, now + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)

  const overtoneGain = ctx.createGain()
  overtoneGain.gain.setValueAtTime(0.001, now)
  overtoneGain.gain.linearRampToValueAtTime(0.08, now + 0.01)
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)

  osc.connect(gain)
  gain.connect(getMasterGain(ctx))
  overtone.connect(overtoneGain)
  overtoneGain.connect(getMasterGain(ctx))

  osc.start(now)
  osc.stop(now + 0.4)
  overtone.start(now)
  overtone.stop(now + 0.3)
  })
}
