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
  for (let i = margin; i < n - margin; i++) out[i] = rowSignature(lum, i, win, flank).score
  return out
}

type EdgeKind = 'down' | 'up' | 'valley'

/** The three liquid-surface signatures at row i of a profile, weighted, and which one wins. */
function rowSignature(lum: Float32Array, i: number, win: number, flank: number) {
  const above = mean(lum, i - win, i)
  const below = mean(lum, i, i + win)
  const aboveFlank = mean(lum, i - flank - 2, i - 2)
  const belowFlank = mean(lum, i + 2, i + flank + 2)
  const centre = mean(lum, i - 1, i + 2)
  const down = above - below
  const up = 0.8 * (below - above)
  const valley = 1.3 * (Math.min(aboveFlank, belowFlank) - centre)
  const score = Math.max(down, up, valley, 0)
  const kind: EdgeKind = score === down ? 'down' : score === up ? 'up' : 'valley'
  return { score, kind, above, below }
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

  const scores = new Float32Array(n)
  const tmp = new Float32Array(strips)
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < strips; s++) tmp[s] = perStrip[s][i]
    const sorted = Array.from(tmp).sort((a, b) => a - b)
    scores[i] = sorted[Math.floor(strips / 2)]
  }
  const candidates = peakRows(scores, minScore, 8)
  if (candidates.length === 0) return null

  // The strongest edge is not always the surface: a ring of foam lacing left
  // above the head, the top of the head itself, or the printed wordmark can
  // all out-score a dim foam-to-stout line. Rerank the strongest candidates by
  // how plausible each is as the surface and keep the best.
  const block = grayBlock(img, { x0, x1, y0: roi.y0, y1: roi.y1 })
  const lum = block.rows
  let bestI = candidates[0]
  let bestRank = -1
  for (const i of candidates) {
    const rank = scores[i] * plausibility(block, i, win, flank)
    if (rank > bestRank) {
      bestRank = rank
      bestI = i
    }
  }
  const best = scores[bestI]

  // The surface of the liquid is an ellipse seen from slightly above: a dark
  // band whose top is the far arc and whose bottom is the near arc at the
  // front of the glass, which is what the user reads the level against. If
  // the candidate sits on a bounded dark band, snap to the bottom of it.
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

/** Local maxima of a row-score profile at or above `min`, strongest first, at least 4 rows apart. */
function peakRows(scores: Float32Array, min: number, limit: number): number[] {
  const peaks: number[] = []
  for (let i = 0; i < scores.length; i++) {
    const v = scores[i]
    if (v < min || (i > 0 && v < scores[i - 1]) || (i + 1 < scores.length && v < scores[i + 1])) continue
    peaks.push(i)
  }
  peaks.sort((a, b) => scores[b] - scores[a])
  const picked: number[] = []
  for (const i of peaks) {
    if (picked.every((p) => Math.abs(p - i) > 3)) picked.push(i)
    if (picked.length >= limit) break
  }
  return picked
}

/** Luma of every pixel in the ROI (row-major) plus the per-row means. */
interface GrayBlock {
  px: Float32Array
  rows: Float32Array
  w: number
  n: number
}

function grayBlock(img: PixelSource, roi: Roi): GrayBlock {
  const x0 = Math.max(0, Math.floor(roi.x0))
  const x1 = Math.min(img.width, Math.ceil(roi.x1))
  const y0 = Math.max(0, Math.floor(roi.y0))
  const y1 = Math.min(img.height, Math.ceil(roi.y1))
  const w = Math.max(0, x1 - x0)
  const n = Math.max(0, y1 - y0)
  const px = new Float32Array(w * n)
  const rows = new Float32Array(n)
  const d = img.data
  for (let r = 0; r < n; r++) {
    let sum = 0
    for (let c = 0; c < w; c++) {
      const i = ((y0 + r) * img.width + x0 + c) * 4
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      px[r * w + c] = v
      sum += v
    }
    rows[r] = w > 0 ? sum / w : 0
  }
  return { px, rows, w, n }
}

/**
 * 0-1: how much a candidate row looks like the liquid surface rather than
 * something else with a horizontal edge. Two checks:
 *   - coverage: a surface crosses the whole column. Count the pixel columns
 *     that show the same signature at at least 40% of the row's strength;
 *     printed lettering and partial reflections only cover some of them.
 *   - continuity: for a step, the side below the line is the liquid and stays
 *     that way down to the end of the search. Below a lacing ring or the top
 *     of the head, the profile swings back past the midpoint of the step.
 */
function plausibility(b: GrayBlock, i: number, win: number, flank: number): number {
  const sig = rowSignature(b.rows, i, win, flank)
  if (sig.score <= 0) return 0

  const col = new Float32Array(b.n)
  let covered = 0
  for (let c = 0; c < b.w; c++) {
    for (let r = 0; r < b.n; r++) col[r] = b.px[r * b.w + c]
    const s = rowSignature(col, i, win, flank)
    const v = sig.kind === 'down' ? s.above - s.below : sig.kind === 'up' ? 0.8 * (s.below - s.above) : s.score
    if (v >= 0.4 * sig.score) covered++
  }
  const coverage = covered / b.w
  let p = coverage * coverage

  if (sig.kind !== 'valley') {
    const mid = (sig.above + sig.below) / 2
    const from = i + win
    let swung = 0
    for (let r = from; r < b.n; r++) {
      if (sig.kind === 'down' ? b.rows[r] > mid : b.rows[r] < mid) swung++
    }
    const frac = b.n > from ? swung / (b.n - from) : 0
    p *= Math.max(0, 1 - 2 * frac)
  }
  return p
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
