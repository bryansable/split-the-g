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
  /** Longest dark band (fraction of ROI height) still treated as a meniscus. */
  maxBandFraction?: number
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

  // The surface of the liquid is an ellipse seen from slightly above: a dark
  // band whose top is the far arc and whose bottom is the near arc at the
  // front of the glass, which is what the user reads the level against. If
  // the candidate sits on a bounded dark band, snap to the bottom of it.
  const lum = rowLuminance(img, { x0, x1, y0: roi.y0, y1: roi.y1 })
  const nearI = nearEdge(lum, bestI, flank, Math.max(3, Math.round(n * (opts.maxBandFraction ?? 0.1))))

  // Sub-row position of the edge between rows nearI-1 and nearI: weight by
  // how sharply luminance changes across the neighbouring row pairs.
  const y = Math.floor(roi.y0) + subRowEdge(lum, nearI)

  return {
    y,
    step: best,
    confidence: Math.min(1, best / 80),
  }
}

/**
 * Refine an edge located between rows i-1 and i to sub-row precision using
 * the luminance differences of the three row pairs around it (parabolic fit
 * on the gradient magnitude). Returns a value in [i-1, i+1].
 */
export function subRowEdge(lum: Float32Array, i: number): number {
  const n = lum.length
  if (i <= 1 || i >= n - 1) return i
  const g = (k: number) => Math.abs(lum[k] - lum[k - 1])
  const a = g(i - 1)
  const b = g(i)
  const c = g(i + 1)
  const denom = a - 2 * b + c
  if (denom >= 0 || b < a || b < c) return i
  const offset = (0.5 * (a - c)) / denom
  return i + Math.max(-1, Math.min(1, offset))
}

/**
 * Given the row scored as the surface, walk down while rows stay dark relative
 * to the brightness above the surface. Returns the row just below the band if
 * the band ends within `maxBand` rows (a meniscus), otherwise `i` (a step into
 * dark beer with no lower edge).
 */
export function nearEdge(lum: Float32Array, i: number, flank: number, maxBand: number): number {
  const n = lum.length
  const a0 = Math.max(0, i - flank - 2)
  const a1 = Math.max(a0 + 1, i - 2)
  const aboveRef = mean(lum, a0, a1)
  const depth = aboveRef - lum[i]
  if (depth <= 0) return i
  const limit = aboveRef - 0.4 * depth
  let j = i
  while (j + 1 < n && j - i < maxBand && lum[j + 1] < limit) j++
  if (j - i >= maxBand) return i
  return j + 1
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
