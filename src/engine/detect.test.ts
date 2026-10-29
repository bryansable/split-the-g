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

  it('ignores dark-to-bright edges and flat images', () => {
    const inverted = frame(40, 60, 25, 20, 235)
    expect(detectLiquidLine(inverted, { x0: 10, x1: 30, y0: 0, y1: 60 })).toBeNull()
    const flat = frame(40, 60, 25, 120, 120)
    expect(detectLiquidLine(flat, { x0: 10, x1: 30, y0: 0, y1: 60 })).toBeNull()
  })

  it('respects the ROI rows', () => {
    const img = frame(40, 60, 25, 235, 20)
    expect(detectLiquidLine(img, { x0: 10, x1: 30, y0: 30, y1: 60 })).toBeNull()
  })
})
