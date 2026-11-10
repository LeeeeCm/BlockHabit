/**
 * 档案包字节 / 压缩工具（B3 收尾拆分，见 D-20261110-062）。
 *
 * 从 archive.ts 抽出的纯字节层：CRC-32、SHA-256（WebCrypto + 纯 TS 兜底）、
 * UTF-8 编解码、无依赖 ZIP（STORE + 可选 DEFLATE）以及其中的常量与辅助函数。
 * 本文件无任何模块依赖；对外仍经 archive.ts barrel 导出，既有 import 路径与
 * 函数签名/行为逐字不变。
 */

/* ---------------- CRC32 / SHA-256 ---------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32（IEEE 802.3，ZIP 用），返回无符号 32 位 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** 纯 TS SHA-256 兜底（无 WebCrypto 的旧 WebView 仍能校验完整性） */
export function sha256HexPure(input: Uint8Array): string {
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const bitLength = input.length * 8
  const paddedLength = ((input.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[input.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = (w[i - 15] >>> 7) | (w[i - 15] << 25)
      const s1 = (w[i - 2] >>> 17) | (w[i - 2] << 15)
      const r0 = (w[i - 15] >>> 18) | (w[i - 15] << 14)
      const r1 = (w[i - 2] >>> 19) | (w[i - 2] << 13)
      const sh0 = w[i - 15] >>> 3
      const sh1 = w[i - 2] >>> 10
      w[i] = (w[i - 16] + (s0 ^ r0 ^ sh0) + w[i - 7] + (s1 ^ r1 ^ sh1)) >>> 0
    }
    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]
    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6) | (e << 26)
      const S2 = (e >>> 11) | (e << 21)
      const S3 = (e >>> 25) | (e << 7)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + (S1 ^ S2 ^ S3) + ch + k[i] + w[i]) >>> 0
      const S4 = (a >>> 2) | (a << 30)
      const S5 = (a >>> 13) | (a << 19)
      const S6 = (a >>> 22) | (a << 10)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = ((S4 ^ S5 ^ S6) + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false)
  return toHex(out)
}

/** SHA-256 十六进制摘要：优先 WebCrypto，失败/缺失时用纯 TS 兜底 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle =
    typeof crypto !== 'undefined' && crypto && typeof crypto.subtle?.digest === 'function'
      ? crypto.subtle
      : null
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource)
      return toHex(new Uint8Array(digest))
    } catch {
      // 旧 WebView / 非安全上下文：走纯 TS
    }
  }
  return sha256HexPure(bytes)
}

/* ---------------- UTF-8 / 字节拼接 ---------------- */

export function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  const escaped = unescape(encodeURIComponent(text))
  const out = new Uint8Array(escaped.length)
  for (let i = 0; i < escaped.length; i++) out[i] = escaped.charCodeAt(i)
  return out
}

export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return decodeURIComponent(escape(binary))
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/* ---------------- 无依赖 ZIP（STORE + 可选 DEFLATE） ---------------- */

export interface ZipEntryInput {
  /** ZIP 内相对路径（正斜杠） */
  path: string
  bytes: Uint8Array
}

/** MS-DOS 时间/日期（ZIP 本地头字段，1980 起） */
export function dosDateTime(now: Date): { time: number; date: number } {
  const year = Math.max(1980, now.getFullYear())
  const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  return { time, date }
}

/** 文本文件尝试 raw DEFLATE（CompressionStream）；不可用/更大时返回 null 降级 STORE */
async function tryDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const Ctor = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (typeof Ctor !== 'function' || typeof Blob === 'undefined' || typeof Response === 'undefined') {
    return null
  }
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new Ctor('deflate-raw'))
    const buffer = await new Response(stream).arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

/**
 * 生成 ZIP（method 0 STORE，文本可降级/升级为 method 8 DEFLATE）：
 * 本地文件头 → 数据 → 中央目录 → EOCD；UTF-8 文件名（bit 11），无 data descriptor。
 */
export async function buildZip(entries: ZipEntryInput[], now: Date = new Date()): Promise<Uint8Array> {
  const { time, date } = dosDateTime(now)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const pathBytes = utf8Encode(entry.path)
    const crc = crc32(entry.bytes)
    const deflated = entry.bytes.length >= 512 ? await tryDeflate(entry.bytes) : null
    const method = deflated && deflated.length < entry.bytes.length ? 8 : 0
    const data = method === 8 && deflated ? deflated : entry.bytes

    const local = new Uint8Array(30 + pathBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, method, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, entry.bytes.length, true)
    localView.setUint16(26, pathBytes.length, true)
    localView.setUint16(28, 0, true)
    local.set(pathBytes, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + pathBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, method, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, entry.bytes.length, true)
    centralView.setUint16(28, pathBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(pathBytes, 46)
    centralParts.push(central)

    offset += local.length + data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true)
  eocdView.setUint16(6, 0, true)
  eocdView.setUint16(8, entries.length, true)
  eocdView.setUint16(10, entries.length, true)
  eocdView.setUint32(12, centralSize, true)
  eocdView.setUint32(16, offset, true)
  eocdView.setUint16(20, 0, true)

  return concatBytes([...localParts, ...centralParts, eocd])
}
