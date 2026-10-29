import { describe, expect, it } from 'vitest'
import { containerToMedia, coverTransform, mediaToContainer } from './mapping'

describe('coverTransform', () => {
  it('crops the wider side when the media is wider than the container', () => {
    // portrait container, landscape media
    const t = coverTransform(300, 600, 1280, 720)
    expect(t.scale).toBeCloseTo(600 / 720)
    expect(t.oy).toBeCloseTo(0)
    expect(t.ox).toBeLessThan(0)
    const centre = containerToMedia(t, 150, 300)
    expect(centre.x).toBeCloseTo(640)
    expect(centre.y).toBeCloseTo(360)
  })

  it('round-trips', () => {
    const t = coverTransform(390, 700, 720, 1280)
    const m = containerToMedia(t, 100, 200)
    const c = mediaToContainer(t, m.x, m.y)
    expect(c.x).toBeCloseTo(100)
    expect(c.y).toBeCloseTo(200)
  })
})
