import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import type { PixelSource } from './detect'
import { evaluate, formatReport, type Truth } from './harness'
import { SAMPLE_WIDTH } from './roi'

/**
 * Real-photo regression tests. Each fixture is a PNG plus a JSON file with
 * hand-measured ground truth (full-resolution pixels). Fixtures are personal
 * photos kept out of git (fixtures/ is ignored), so the suite skips when the
 * folder is empty.
 *
 * Pass criteria, in percent of glass height: the final reading (line as a
 * fraction of the glass) within 1%, and the line itself within 1%.
 */

const DIR = 'fixtures'
const TOLERANCE = 1.0

function loadPng(path: string): PixelSource {
  const png = PNG.sync.read(readFileSync(path))
  return { data: png.data, width: png.width, height: png.height }
}

const fixtures = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const meta = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { image: string; truth: Truth }
        return { name: f.replace(/\.json$/, ''), image: join(DIR, meta.image), truth: meta.truth }
      })
      .filter((f) => existsSync(f.image))
  : []

describe('real-photo accuracy', () => {
  if (fixtures.length === 0) {
    it.skip('no fixtures present', () => undefined)
    return
  }
  for (const fx of fixtures) {
    it(`${fx.name}: reading within ${TOLERANCE}% of glass height`, () => {
      const r = evaluate(loadPng(fx.image), fx.truth, SAMPLE_WIDTH)
      console.log(formatReport(fx.name, r))
      expect(r.glass, 'glass not found').not.toBeNull()
      expect(r.lineErr, 'line not found').not.toBeNull()
      expect(Math.abs(r.lineErr!)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(r.fractionErr!)).toBeLessThanOrEqual(TOLERANCE)
    })
  }
})
