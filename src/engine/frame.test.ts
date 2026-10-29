import { describe, expect, it } from 'vitest'
import { detectGlass } from './frame'
import type { PixelSource } from './detect'

/** Grey canvas with a darker-outlined "glass" rectangle and a liquid band. */
function scene(w: number, h: number, left: number, right: number, rim: number, base: number): PixelSource {
  const data = new Uint8ClampedArray(w * h * 4)
  const set = (x: number, y: number, v: number) => {
    const i = (y * w + x) * 4
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = 255
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, 170)
  // walls
  for (let y = rim; y <= base; y++) {
    set(left, y, 40)
    set(left + 1, y, 60)
    set(right, y, 40)
    set(right - 1, y, 60)
  }
  // rim and base lines
  for (let x = left; x <= right; x++) {
    set(x, rim, 50)
    set(x, base, 50)
  }
  return { data, width: w, height: h }
}

describe('detectGlass', () => {
  it('finds walls, rim and base of a synthetic glass', () => {
    const img = scene(240, 320, 70, 170, 60, 270)
    const d = detectGlass(img)
    expect(d).not.toBeNull()
    expect(Math.abs(d!.leftX - 70)).toBeLessThanOrEqual(2)
    expect(Math.abs(d!.rightX - 170)).toBeLessThanOrEqual(2)
    expect(Math.abs(d!.rimY - 60)).toBeLessThanOrEqual(3)
    expect(Math.abs(d!.baseY - 270)).toBeLessThanOrEqual(3)
    expect(d!.confidence).toBeGreaterThan(0.5)
  })

  it('prefers the wall nearest the centre over a stronger edge further out', () => {
    const img = scene(240, 320, 70, 170, 60, 270)
    // a strong full-height background bar on the right
    for (let y = 0; y < 320; y++) {
      for (let x = 205; x < 209; x++) {
        const i = (y * 240 + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 0
      }
    }
    const d = detectGlass(img)
    expect(d).not.toBeNull()
    expect(Math.abs(d!.rightX - 170)).toBeLessThanOrEqual(2)
    expect(Math.abs(d!.baseY - 270)).toBeLessThanOrEqual(3)
  })

  it('returns null on a flat frame', () => {
    const data = new Uint8ClampedArray(240 * 320 * 4).fill(128)
    expect(detectGlass({ data, width: 240, height: 320 })).toBeNull()
  })
})
