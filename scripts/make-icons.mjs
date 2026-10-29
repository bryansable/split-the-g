// Generates public/icon-192.png, icon-512.png, apple-touch-icon.png and icon.svg
// with no image dependencies: a dark rounded square with a cream "G" ring.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [13, 9, 6] // stout black
const FG = [201, 164, 71] // pub gold

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y)
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance helpers in unit coordinates (0..1). */
function inG(u, v) {
  const cx = 0.5
  const cy = 0.5
  const dx = u - cx
  const dy = v - cy
  const r = Math.hypot(dx, dy)
  const ring = r > 0.21 && r < 0.33
  const ang = Math.atan2(dy, dx) // -pi..pi, 0 = right
  // gap in the ring on the upper-right (between -70deg and -5deg)
  const gap = ang > -1.22 && ang < -0.09
  const bar = dy > -0.06 && dy < 0.06 && dx > 0.0 && dx < 0.33
  const stem = dx > 0.21 && dx < 0.33 && dy > -0.06 && dy < 0.2
  return (ring && !gap) || bar || stem
}

function icon(size, rounded) {
  const ss = 3 // supersampling
  return png(size, (x, y) => {
    let cover = 0
    let shape = 0
    for (let sy = 0; sy < ss; sy++) {
      for (let sx = 0; sx < ss; sx++) {
        const u = (x + (sx + 0.5) / ss) / size
        const v = (y + (sy + 0.5) / ss) / size
        // rounded square mask
        const rr = rounded ? 0.18 : 0
        const px = Math.max(Math.abs(u - 0.5) - (0.5 - rr), 0)
        const py = Math.max(Math.abs(v - 0.5) - (0.5 - rr), 0)
        const inside = Math.hypot(px, py) <= rr
        if (inside) cover++
        if (inside && inG(u, v)) shape++
      }
    }
    const n = ss * ss
    const a = Math.round((255 * cover) / n)
    const t = cover ? shape / cover : 0
    const r = Math.round(BG[0] + (FG[0] - BG[0]) * t)
    const g = Math.round(BG[1] + (FG[1] - BG[1]) * t)
    const b = Math.round(BG[2] + (FG[2] - BG[2]) * t)
    return [r, g, b, a]
  })
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', icon(192, true))
writeFileSync('public/icon-512.png', icon(512, false))
writeFileSync('public/apple-touch-icon.png', icon(180, false))
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="18" fill="#0d0906"/>
<path d="M78 44 A28 28 0 1 0 78 56" fill="none" stroke="#c9a447" stroke-width="11" stroke-linecap="butt"/>
<path d="M50 50 H78 V66" fill="none" stroke="#c9a447" stroke-width="11"/>
</svg>
`,
)
console.log('icons written to public/')
