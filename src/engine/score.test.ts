import { describe, expect, it } from 'vitest'
import { scoreAttempt, tierFor } from './score'
import { G_BAND, TARGET_FRACTION } from './glass'

describe('scoreAttempt', () => {
  it('gives 100 anywhere inside the G band', () => {
    expect(scoreAttempt(TARGET_FRACTION).score).toBe(100)
    expect(scoreAttempt(TARGET_FRACTION + G_BAND).score).toBe(100)
    expect(scoreAttempt(TARGET_FRACTION - G_BAND).score).toBe(100)
    expect(scoreAttempt(TARGET_FRACTION).tier).toBe('split')
  })

  it('falls off linearly outside the band and clamps at 0', () => {
    const fivePct = scoreAttempt(TARGET_FRACTION + 0.05)
    expect(fivePct.score).toBe(100 - 6 * (5 - G_BAND * 100))
    expect(fivePct.offsetPct).toBeCloseTo(5)
    expect(scoreAttempt(TARGET_FRACTION + 0.5).score).toBe(0)
    expect(scoreAttempt(TARGET_FRACTION - 0.5).score).toBe(0)
  })

  it('is symmetric and reports direction', () => {
    const low = scoreAttempt(TARGET_FRACTION + 0.08)
    const high = scoreAttempt(TARGET_FRACTION - 0.08)
    expect(low.score).toBe(high.score)
    expect(low.detail).toMatch(/too low/)
    expect(high.detail).toMatch(/too high/)
    expect(low.offsetMm).toBeCloseTo(12)
  })

  it('maps scores to tiers', () => {
    expect(tierFor(100)).toBe('split')
    expect(tierFor(90)).toBe('close')
    expect(tierFor(70)).toBe('decent')
    expect(tierFor(10)).toBe('rookie')
  })
})
