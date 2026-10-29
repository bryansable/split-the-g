import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { detectLiquidLine, topCandidates, type PixelSource } from './detect'
import { glassRoi } from './roi'

/**
 * Real-photo regression tests. Fixtures are personal photos kept out of git
 * (fixtures/ is ignored), so each test is skipped when its file is missing.
 */

function loadPng(path: string): PixelSource {
  const png = PNG.sync.read(readFileSync(path))
  return { data: png.data, width: png.width, height: png.height }
}

/** Box-filter downscale to `targetW` wide, matching what the sampler does. */
function downscale(img: PixelSource, targetW: number): PixelSource {
  const scale = targetW / img.width
  const w = targetW
  const h = Math.round(img.height * scale)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / scale)
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / scale))
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale)
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / scale))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = sy0; sy < sy1 && sy < img.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < img.width; sx++) {
          const i = (sy * img.width + sx) * 4
          r += img.data[i]
          g += img.data[i + 1]
          b += img.data[i + 2]
          n++
        }
      }
      const o = (y * w + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

const SAMPLE_WIDTH = 240

describe('fixture: clear water in a mug (phone photo)', () => {
  const path = 'fixtures/water-mug.png'
  const run = existsSync(path) ? it : it.skip

  run('finds the water surface, not the foot of the glass', () => {
    const full = loadPng(path)
    const img = downscale(full, SAMPLE_WIDTH)
    const s = img.width / full.width
    // Where the user left the RIM/BASE guides (app defaults on a 1090x1500 frame)
    const rimY = 300 * s
    const baseY = 1275 * s
    const waterY = 505 * s
    const roi = glassRoi(img.width, rimY, baseY)
    const cands = topCandidates(img, roi, 6)
    console.log('water-mug candidates (expected ~%d):', waterY.toFixed(1), cands.map((c) => `${c.y}:${c.score.toFixed(1)}`).join('  '))
    const d = detectLiquidLine(img, roi)
    expect(d).not.toBeNull()
    expect(Math.abs(d!.y - waterY)).toBeLessThanOrEqual(3)
  })
})
