import { describe, expect, it } from 'vitest'
import { Stabilizer } from './stability'

const r = (rim: number, base: number, fraction: number | null = null) => ({ rimY: rim, baseY: base, left: 100, right: 300, fraction })

describe('Stabilizer', () => {
  it('reports a glass from the second sample', () => {
    const s = new Stabilizer()
    s.push(r(100, 500))
    expect(s.frame()).toBeNull()
    s.push(r(102, 502))
    expect(s.frame()?.rimY).toBe(101)
  })

  it('drops the glass after consecutive misses', () => {
    const s = new Stabilizer()
    for (let i = 0; i < 3; i++) s.push(r(100, 500))
    s.push(null)
    s.push(null)
    s.push(null)
    expect(s.frame()).not.toBeNull()
    s.push(null)
    expect(s.frame()).toBeNull()
    expect(s.hasGlass).toBe(false)
  })

  it('locks once four readings agree within 1% of the glass', () => {
    const s = new Stabilizer()
    s.push(r(100, 500, 0.3))
    s.push(r(100, 500, 0.302))
    expect(s.reading()?.locked).toBe(false)
    s.push(r(100, 500, 0.298))
    s.push(r(100, 500, 0.301))
    expect(s.reading()?.locked).toBe(true)
    expect(s.reading()?.fraction).toBeCloseTo(0.3005, 4)
    s.push(r(100, 500, 0.35))
    expect(s.reading()?.locked).toBe(false)
  })

  it('locks while the hand drifts, because readings are relative to each frame', () => {
    const s = new Stabilizer()
    // the glass slides 5 px down the screen per sample; the reading holds
    for (let i = 0; i < 4; i++) s.push(r(100 + 5 * i, 500 + 5 * i, 0.3))
    expect(s.reading()?.locked).toBe(true)
  })

  it('does not lock while the phone is swinging', () => {
    const s = new Stabilizer()
    for (let i = 0; i < 4; i++) s.push(r(100 + 30 * i, 500 + 30 * i, 0.3))
    expect(s.reading()?.locked).toBe(false)
  })

  it('a single outlier does not move the median', () => {
    const s = new Stabilizer()
    for (const f of [0.3, 0.301, 0.5, 0.299, 0.3]) s.push(r(100, 500, f))
    expect(s.reading()?.fraction).toBe(0.3)
  })

  it('needs a line in each of the last four samples to lock', () => {
    const s = new Stabilizer()
    for (const f of [0.3, 0.3, null, 0.3]) s.push(r(100, 500, f))
    expect(s.reading()?.locked).toBe(false)
  })
})
