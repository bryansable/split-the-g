import { describe, expect, it } from 'vitest'
import { Stabilizer } from './stability'

const f = (rim: number, base: number) => ({ rimY: rim, baseY: base, left: 100, right: 300 })

describe('Stabilizer', () => {
  it('needs three agreeing frames before it reports a glass', () => {
    const s = new Stabilizer()
    s.pushFrame(f(100, 500))
    s.pushFrame(f(101, 502))
    expect(s.frame()).toBeNull()
    s.pushFrame(f(99, 499))
    expect(s.frame()?.rimY).toBe(100)
  })

  it('withholds the frame while samples disagree', () => {
    const s = new Stabilizer()
    s.pushFrame(f(100, 500))
    s.pushFrame(f(140, 500))
    s.pushFrame(f(100, 500))
    expect(s.frame()).toBeNull()
  })

  it('drops the glass after consecutive misses', () => {
    const s = new Stabilizer()
    for (let i = 0; i < 3; i++) s.pushFrame(f(100, 500))
    s.pushFrame(null)
    s.pushFrame(null)
    s.pushFrame(null)
    expect(s.frame()).not.toBeNull()
    s.pushFrame(null)
    expect(s.frame()).toBeNull()
    expect(s.hasGlass).toBe(false)
  })

  it('locks the line once four samples agree within 1% of glass height', () => {
    const s = new Stabilizer()
    s.pushLine(220)
    s.pushLine(221)
    expect(s.line(400)?.locked).toBe(false)
    s.pushLine(219)
    s.pushLine(220)
    expect(s.line(400)?.locked).toBe(true)
    expect(s.line(400)?.y).toBeCloseTo(220)
    s.pushLine(240)
    expect(s.line(400)?.locked).toBe(false)
  })

  it('a single outlier does not move the median', () => {
    const s = new Stabilizer()
    for (const y of [220, 221, 300, 219, 220]) s.pushLine(y)
    expect(s.line(400)?.y).toBe(220)
  })
})
