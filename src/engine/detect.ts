/**
 * Liquid-line detection on a downscaled camera frame.
 *
 * A liquid surface shows up as one of three horizontal signatures inside the
 * glass column:
 *   - step-down: bright foam/head above, darker beer below (stout, lager with head)
 *   - step-up:   darker liquid below a brighter empty glass, or the reverse lighting
 *   - valley:    a thin dark meniscus line with similar brightness on both sides
 *                (clear liquids, water, pale lager without a head)
 *
 * Each row is scored on all three and the best row wins. To reject reflections
 * and highlights that only cross part of the glass, the column is split into
 * three vertical strips and a row's score is the median of the strip scores,
 * so at least two strips must agree.
 *
 * Pure functions so they can be unit tested without a DOM.
 */

export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array | number[]
  width: number
  height: number
}

/** Region of interest in pixels: [x0, x1) x [y0, y1). */
export interface Roi {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface Detection {
  /** Row of the liquid line in source pixels. */
  y: number
  /** 0-1, how strong the edge was. */
  confidence: number
  /** Raw edge score (luminance units, 0-255). */
  step: number
}

export interface DetectOptions {
  /** Minimum row score to accept as a liquid line. */
  minScore?: number
  /** Rows averaged on each side of a candidate step. */
  window?: number
  /** Rows averaged on each side of a candidate valley, beyond a 1-row gap. */
  flank?: number
  /** Vertical strips the ROI is split into (odd number; median across strips). */
  strips?: number
}

export function rowLuminance(img: PixelSource, roi: Roi): Float32Array {
  const x0 = Math.max(0, Math.floor(roi.x0))
  const x1 = Math.min(img.width, Math.ceil(roi.x1))
  const y0 = Math.max(0, Math.floor(roi.y0))
  const y1 = Math.min(img.height, Math.ceil(roi.y1))
  const rows = Math.max(0, y1 - y0)
  const out = new Float32Array(rows)
  const w = x1 - x0
  if (w <= 0) return out
  const d = img.data
  for (let r = 0; r < rows; r++) {
    const y = y0 + r
    let sum = 0
    let i = (y * img.width + x0) * 4
    for (let x = 0; x < w; x++, i += 4) {
      // Rec. 601 luma
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    }
    out[r] = sum / w
  }
  return out
}

function mean(a: Float32Array, from: number, to: number): number {
  let s = 0
  for (let i = from; i < to; i++) s += a[i]
  return s / (to - from)
}

/**
 * Score every row of a luminance profile for "looks like a liquid surface".
 * Row i scores the edge between rows i-1 and i, or a thin dark line centred on i.
 * Rows too close to the ends score 0.
 */
export function scoreRows(lum: Float32Array, win = 3, flank = 4): Float32Array {
  const n = lum.length
  const out = new Float32Array(n)
  const margin = Math.max(win, flank + 2)
  for (let i = margin; i < n - margin; i++) {
    const above = mean(lum, i - win, i)
    const below = mean(lum, i, i + win)
    const stepDown = above - below
    const stepUp = below - above
    const aboveFlank = mean(lum, i - flank - 2, i - 2)
    const belowFlank = mean(lum, i + 2, i + flank + 2)
    const centre = mean(lum, i - 1, i + 2)
    const valley = Math.min(aboveFlank, belowFlank) - centre
    out[i] = Math.max(stepDown, 0.8 * stepUp, 1.3 * valley, 0)
  }
  return out
}

export function detectLiquidLine(img: PixelSource, roi: Roi, opts: DetectOptions = {}): Detection | null {
  const minScore = opts.minScore ?? 18
  const win = Math.max(1, opts.window ?? 3)
  const flank = Math.max(1, opts.flank ?? 4)
  const strips = Math.max(1, opts.strips ?? 3)

  const x0 = Math.max(0, Math.floor(roi.x0))
  const x1 = Math.min(img.width, Math.ceil(roi.x1))
  if (x1 - x0 < strips) return null
  const stripW = (x1 - x0) / strips
  const perStrip: Float32Array[] = []
  for (let s = 0; s < strips; s++) {
    const sx0 = x0 + s * stripW
    const sx1 = s === strips - 1 ? x1 : x0 + (s + 1) * stripW
    perStrip.push(scoreRows(rowLuminance(img, { x0: sx0, x1: sx1, y0: roi.y0, y1: roi.y1 }), win, flank))
  }
  const n = perStrip[0].length
  if (n === 0) return null

  let bestI = -1
  let best = 0
  const tmp = new Float32Array(strips)
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < strips; s++) tmp[s] = perStrip[s][i]
    const sorted = Array.from(tmp).sort((a, b) => a - b)
    const score = sorted[Math.floor(strips / 2)]
    if (score > best) {
      best = score
      bestI = i
    }
  }
  if (bestI < 0 || best < minScore) return null
  return {
    y: Math.floor(roi.y0) + bestI,
    step: best,
    confidence: Math.min(1, best / 80),
  }
}

/**
 * Debug helper: the strongest `count` rows with their scores (median across strips).
 */
export function topCandidates(img: PixelSource, roi: Roi, count = 5, opts: DetectOptions = {}): { y: number; score: number }[] {
  const win = Math.max(1, opts.window ?? 3)
  const flank = Math.max(1, opts.flank ?? 4)
  const strips = Math.max(1, opts.strips ?? 3)
  const x0 = Math.max(0, Math.floor(roi.x0))
  const x1 = Math.min(img.width, Math.ceil(roi.x1))
  const stripW = (x1 - x0) / strips
  const perStrip: Float32Array[] = []
  for (let s = 0; s < strips; s++) {
    const sx0 = x0 + s * stripW
    const sx1 = s === strips - 1 ? x1 : x0 + (s + 1) * stripW
    perStrip.push(scoreRows(rowLuminance(img, { x0: sx0, x1: sx1, y0: roi.y0, y1: roi.y1 }), win, flank))
  }
  const n = perStrip[0]?.length ?? 0
  const rows: { y: number; score: number }[] = []
  for (let i = 0; i < n; i++) {
    const vals = perStrip.map((p) => p[i]).sort((a, b) => a - b)
    rows.push({ y: Math.floor(roi.y0) + i, score: vals[Math.floor(strips / 2)] })
  }
  rows.sort((a, b) => b.score - a.score)
  // keep only local maxima that are at least 3 rows apart
  const picked: { y: number; score: number }[] = []
  for (const r of rows) {
    if (picked.every((p) => Math.abs(p.y - r.y) > 3)) picked.push(r)
    if (picked.length >= count) break
  }
  return picked
}
