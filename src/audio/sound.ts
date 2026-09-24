/**
 * Web Audio API 程序化纯合成音效（零外部音频资产依赖，极简极速）
 */

let audioCtx: AudioContext | null = null
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const ctxCtor = window.AudioContext ?? ('webkitAudioContext' in window ? (window.webkitAudioContext as typeof AudioContext) : null)
    if (ctxCtor) {
      audioCtx = new ctxCtor()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export let soundMuted = false

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted
}

/**
 * 积木咬合声（Snap / Click）：
 * 短促白噪音脉冲 (~25ms) + 短衰减微方波，模拟乐高积木按压咬合的清脆质感
 */
export function playSnapSound(): void {
  if (soundMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  // 1. 白噪音爆破音 (冲击杂音)
  const bufferSize = Math.floor(ctx.sampleRate * 0.025) // 25ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const output = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1
  }

  const whiteNoise = ctx.createBufferSource()
  whiteNoise.buffer = noiseBuffer

  // 高通滤波：去除浑浊低频，只留塑料质感的高频冲击
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(1200, now)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.35, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

  whiteNoise.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(ctx.destination)

  whiteNoise.start(now)

  // 2. 瞬态方波（咔哒主体）
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(320, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.03)

  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(0.3, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

  osc.connect(oscGain)
  oscGain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.035)
}

/**
 * 果冻回弹音（Jelly Pop / Wobble）：
 * 新积木落地果冻回弹时的弹性滑音
 */
export function playJellySound(): void {
  if (soundMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

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
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.24)
}

/**
 * 大满贯 / 落成钟鸣声（Ceremony Harmonic Chord）：
 * 纯净明亮的谐波和弦，带来完成一整天或一座建筑的空灵成就感
 */
export function playCelebrationSound(): void {
  if (soundMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

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
    gain.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + 1.25)
  })
}

/**
 * 连击五声音阶音效（Pentatonic Combo Chime）：
 * C5 -> D5 -> E5 -> G5 -> A5 -> C6
 * 连续打卡时基频依次步进，带来如同敲击木琴积木般的触感与正向激励反馈
 */
const PENTATONIC_FREQS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]

export function playComboChime(comboIndex: number = 0): void {
  if (soundMuted) return
  const ctx = getAudioContext()
  if (!ctx) return

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
  gain.connect(ctx.destination)
  overtone.connect(overtoneGain)
  overtoneGain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.4)
  overtone.start(now)
  overtone.stop(now + 0.3)
}
