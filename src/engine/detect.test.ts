import { describe, expect, it } from 'vitest'
import { detectLiquidLine, rowLuminance, type PixelSource } from './detect'

/** Build a synthetic frame: rows [0, lineY) are `top` grey, rows from lineY are `bottom` grey. */
function frame(width: number, height: number, lineY: number, top: number, bottom: number): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const v = y < lineY ? top : bottom
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

/** Paint rows [y0, y1) grey `v`, optionally only in columns where `cols(x)` is true. */
function paintRows(img: PixelSource, y0: number, y1: number, v: number, cols: (x: number) => boolean = () => true) {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!cols(x)) continue
      const i = (y * img.width + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    }
  }
}

describe('rowLuminance', () => {
  it('averages the ROI columns per row', () => {
    const img = frame(10, 4, 2, 200, 50)
    const lum = rowLuminance(img, { x0: 2, x1: 8, y0: 0, y1: 4 })
    expect(Array.from(lum)).toEqual([200, 200, 50, 50])
  })
})

describe('detectLiquidLine', () => {
  it('finds a bright-to-dark edge (foam over stout)', () => {
    const img = frame(40, 60, 25, 235, 20)
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 5, y1: 55 })
    expect(d).not.toBeNull()
    expect(d!.y).toBe(25)
    expect(d!.confidence).toBeGreaterThan(0.9)
  })

  it('finds a softer edge (foam over lager)', () => {
    const img = frame(40, 60, 33, 240, 150)
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 0, y1: 60 })
    expect(d?.y).toBe(33)
  })

  it('also accepts dark-to-bright edges, at a lower score', () => {
    const down = detectLiquidLine(frame(40, 60, 25, 235, 20), { x0: 10, x1: 30, y0: 0, y1: 60 })!
    const up = detectLiquidLine(frame(40, 60, 25, 20, 235), { x0: 10, x1: 30, y0: 0, y1: 60 })!
    expect(up.y).toBe(25)
    expect(up.step).toBeLessThan(down.step)
  })

  it('finds a thin dark meniscus line in a uniform field (clear water)', () => {
    const img = frame(40, 60, 0, 150, 150)
    // two dark rows at y=30..31
    for (let y = 30; y < 32; y++) {
      for (let x = 0; x < 40; x++) {
        const i = (y * 40 + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 90
      }
    }
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 0, y1: 60 })
    expect(d).not.toBeNull()
    // reports the near edge: the first bright row below the dark band
    expect(d!.y).toBe(32)
  })

  it('returns null on a flat image', () => {
    const flat = frame(40, 60, 25, 120, 120)
    expect(detectLiquidLine(flat, { x0: 10, x1: 30, y0: 0, y1: 60 })).toBeNull()
  })

  it('needs at least two of three strips to agree', () => {
    // edge only in the left third of the column
    const img = frame(60, 60, 0, 200, 200)
    for (let y = 25; y < 60; y++) {
      for (let x = 10; x < 20; x++) {
        const i = (y * 60 + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 20
      }
    }
    expect(detectLiquidLine(img, { x0: 10, x1: 40, y0: 0, y1: 60 })).toBeNull()
  })

  it('ignores a ring of foam lacing above the head (stout continues below the real line)', () => {
    // dark pub background, a bright lacing ring left on the glass by the sip,
    // then the head, then stout. The ring's lower edge is the strongest step.
    const img = frame(40, 120, 0, 20, 20)
    paintRows(img, 30, 34, 230)
    paintRows(img, 60, 80, 220)
    paintRows(img, 80, 120, 50)
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 5, y1: 115 })
    expect(d?.y).toBe(80)
  })

  it('ignores printed lettering on the glass over the stout', () => {
    // dim head over stout, with the wordmark (white strokes on half the
    // columns) printed below the line. Its edges are stronger than the line.
    const img = frame(40, 120, 40, 120, 40)
    paintRows(img, 60, 70, 250, (x) => x % 4 < 2)
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 5, y1: 115 })
    expect(d?.y).toBe(40)
  })

  it('still finds a dim line through heavy sensor noise, with lacing above', () => {
    const img = frame(40, 120, 0, 25, 25)
    paintRows(img, 20, 23, 200)
    paintRows(img, 45, 70, 150)
    paintRows(img, 70, 120, 45)
    let seed = 7
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const v = Math.max(0, Math.min(255, img.data[i] + ((seed % 61) - 30)))
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    }
    const d = detectLiquidLine(img, { x0: 10, x1: 30, y0: 5, y1: 115 })
    expect(d).not.toBeNull()
    expect(Math.abs(d!.y - 70)).toBeLessThanOrEqual(1)
  })

  it('respects the ROI rows', () => {
    const img = frame(40, 60, 25, 235, 20)
    expect(detectLiquidLine(img, { x0: 10, x1: 30, y0: 30, y1: 60 })).toBeNull()
  })
})
