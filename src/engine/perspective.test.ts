import { describe, expect, it } from 'vitest'
import { lineFraction } from './glass'
import { focalLength, fractionRow, horizonY, isAboveCamera, trueFraction, type View } from './perspective'

/**
 * Project a point on the front of the glass (height Y mm above the table, at
 * horizontal distance Z mm) through a camera at height camY mm, pitched by
 * `pitch` radians, into an image row.
 */
function project(Y: number, Z: number, camY: number, pitch: number, f: number, cy: number): number {
  const elev = Math.atan2(Y - camY, Z)
  return cy + f * Math.tan(pitch - elev)
}

const GLASS = 150 // mm
const G = 0.3 // line 30% down from the rim
const f = focalLength(720, 1280)
const cy = 640

function shot(camY: number, Z: number) {
  // aim the camera at the middle of the glass, as people do
  const pitch = Math.atan2(GLASS / 2 - camY, Z)
  const rimY = project(GLASS, Z, camY, pitch, f, cy)
  const baseY = project(0, Z, camY, pitch, f, cy)
  const lineY = project(GLASS * (1 - G), Z, camY, pitch, f, cy)
  return { frame: { rimY, baseY }, lineY, view: { pitch, f, cy } as View }
}

describe('trueFraction', () => {
  it('recovers the true level from well above the glass, where the plain reading is off', () => {
    const s = shot(380, 250)
    const naive = lineFraction(s.lineY, s.frame)
    expect(Math.abs(naive - G)).toBeGreaterThan(0.01) // 1% = 6 points
    expect(trueFraction(s.lineY, s.frame, s.view)).toBeCloseTo(G, 6)
  })

  it('recovers the true level from below the glass', () => {
    const s = shot(-120, 220)
    expect(trueFraction(s.lineY, s.frame, s.view)).toBeCloseTo(G, 6)
  })

  it('matches the plain reading with a level camera', () => {
    const frame = { rimY: 300, baseY: 900 }
    const v: View = { pitch: 0, f, cy }
    expect(trueFraction(480, frame, v)).toBeCloseTo(lineFraction(480, frame), 9)
  })

  it('falls back to the plain reading without a view', () => {
    const frame = { rimY: 300, baseY: 900 }
    expect(trueFraction(480, frame, null)).toBe(lineFraction(480, frame))
  })

  it('fractionRow inverts trueFraction', () => {
    const s = shot(380, 250)
    for (const p of [0, 0.1, 0.3, 0.75, 1]) {
      expect(trueFraction(fractionRow(p, s.frame, s.view), s.frame, s.view)).toBeCloseTo(p, 9)
    }
  })
})

describe('horizon', () => {
  it('splits what is above the lens from what is below', () => {
    // camera held at G height and aimed at the middle: rim above, base below
    const s = shot(GLASS * (1 - G), 250)
    expect(isAboveCamera(s.frame.rimY, s.view)).toBe(true)
    expect(isAboveCamera(s.frame.baseY, s.view)).toBe(false)
    expect(horizonY(s.view)).toBeCloseTo(s.lineY, 6)
  })
})
