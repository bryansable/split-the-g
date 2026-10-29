import { describe, expect, it } from 'vitest'
import { glassRoi } from './roi'

describe('glassRoi', () => {
  it('skips the rim glare and the foot of the glass', () => {
    const roi = glassRoi(240, 50, 250)
    expect(roi.y0).toBeCloseTo(60) // 5% of 200 below the rim
    expect(roi.y1).toBeCloseTo(200) // stops 75% of the way down
    expect(roi.x0).toBeCloseTo(240 / 2 - 240 * 0.12)
    expect(roi.x1).toBeCloseTo(240 / 2 + 240 * 0.12)
  })
})
