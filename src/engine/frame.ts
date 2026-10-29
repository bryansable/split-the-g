/**
 * Automatic glass framing: find the glass's side walls, rim and base in a
 * downscaled frame so the user does not have to line anything up.
 *
 * Method (classical, no ML, a few ms on a 320px-wide frame):
 *   1. Horizontal-gradient magnitude per pixel (vertical edges) and vertical-
 *      gradient magnitude (horizontal edges).
 *   2. In a band around mid-height, score each column by vertical-edge energy
 *      and collect wall candidates on each side of centre.
 *   3. For each candidate pair, build a per-row "wall presence" profile from
 *      the edge energy inside a FIXED window around each wall column. Unlike
 *      a row-by-row tracker it cannot wander onto a reflection or a stripe
 *      inside the glass. Extend from mid-height up and down while at least
 *      one wall stays present in a sliding window; that gives the glass's
 *      vertical extent. Score pairs by run length, how often both walls agree,
 *      and edge strength.
 *   4. Rim: the rim is an ellipse seen from slightly above. Find the strongest
 *      horizontal edge near the top of the run (the rim ring), then the lowest
 *      strong edge just below it (the near arc), which is where the user reads
 *      the level. Base: the strongest horizontal edge near the bottom of the
 *      run (the foot meeting the table), which is immune to the run overshooting
 *      into a reflection.
 */
import type { PixelSource } from './detect'

export interface GlassDetection {
  /** Front (near) rim row, image px. */
  rimY: number
  /** Topmost rim row (far arc), image px. */
  rimTopY: number
  /** Bottom of the glass, image px. */
  baseY: number
  leftX: number
  rightX: number
  /** 0-1 */
  confidence: number
}

export interface WallTrack {
  x: number
  strength: number
  /** Rows where the wall's presence run starts and ends. */
  top: number
  bottom: number
  /** Fraction of rows in the run where this wall is present. */
  fill: number
}

export interface FrameOptions {
  /** Minimum column edge strength to count as a wall. */
  minWall?: number
  /** Half-width of the presence window around a wall column, fraction of frame width. */
  window?: number
  /** Fraction of a wall's mid-height strength a row must reach to count as present. */
  presence?: number
  /** Receives the wall candidates considered (tests and tuning). */
  debug?: (info: { lefts: WallTrack[]; rights: WallTrack[]; chosen?: { l: WallTrack; r: WallTrack; top: number; bottom: number } }) => void
}

export function toGray(img: PixelSource): Float32Array {
  const { width: w, height: h, data: d } = img
  const g = new Float32Array(w * h)
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    g[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]
  }
  return g
}

/** |I(x+1) - I(x-1)| for every pixel; zero on the image border. */
export function horizontalGradient(g: Float32Array, w: number, h: number): Float32Array {
  const gx = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      gx[row + x] = Math.abs(g[row + x + 1] - g[row + x - 1])
    }
  }
  return gx
}

/** |I(y+1) - I(y-1)| for every pixel; zero on the top and bottom rows. */
export function verticalGradient(g: Float32Array, w: number, h: number): Float32Array {
  const gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      gy[y * w + x] = Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x])
    }
  }
  return gy
}

interface Pick {
  x: number
  strength: number
}

/** Local maxima of the column profile in [x0, x1), strongest first, plateaus collapsed. */
function columnPeaks(col: Float32Array, x0: number, x1: number, minWall: number, limit: number): Pick[] {
  let peak = 0
  for (let x = x0; x < x1; x++) peak = Math.max(peak, col[x])
  if (peak < minWall) return []
  const picks: Pick[] = []
  for (let x = x0 + 1; x < x1 - 1; x++) {
    const v = col[x]
    if (v < peak * 0.33 || v < minWall || v < col[x - 1] || v < col[x + 1]) continue
    const prev = picks[picks.length - 1]
    if (prev && x - prev.x <= 3) {
      if (v > prev.strength) picks[picks.length - 1] = { x, strength: v }
      continue
    }
    picks.push({ x, strength: v })
  }
  picks.sort((a, b) => b.strength - a.strength)
  return picks.slice(0, limit)
}

/** Per-row max edge energy inside a fixed window around column x. */
function presenceProfile(gx: Float32Array, w: number, h: number, x: number, win: number): Float32Array {
  const out = new Float32Array(h)
  const a = Math.max(1, x - win)
  const b = Math.min(w - 2, x + win)
  for (let y = 0; y < h; y++) {
    let m = 0
    const row = y * w
    for (let xx = a; xx <= b; xx++) if (gx[row + xx] > m) m = gx[row + xx]
    out[y] = m
  }
  return out
}

/**
 * Extend from y0 in direction dir while, within a sliding window of `k`
 * rows ahead, at least half the rows have a wall present. Returns the last
 * present row reached.
 */
function extend(present: Uint8Array, y0: number, dir: -1 | 1, k: number): number {
  const n = present.length
  let last = y0
  let y = y0
  while (true) {
    let count = 0
    let lastHit = -1
    for (let j = 1; j <= k; j++) {
      const yy = y + dir * j
      if (yy < 0 || yy >= n) break
      if (present[yy]) {
        count++
        lastHit = yy
      }
    }
    if (count * 2 < k || lastHit < 0) break
    last = lastHit
    y = lastHit
  }
  return last
}

export function detectGlass(img: PixelSource, opts: FrameOptions = {}): GlassDetection | null {
  const { width: w, height: h } = img
  if (w < 40 || h < 40) return null
  const minWall = opts.minWall ?? 8
  const win = Math.max(2, Math.round((opts.window ?? 0.035) * w))
  const presenceFrac = opts.presence ?? 0.4
  const g = toGray(img)
  const gx = horizontalGradient(g, w, h)
  const gy = verticalGradient(g, w, h)

  // Column edge energy across the middle band of the frame.
  const y0 = Math.floor(h * 0.35)
  const y1 = Math.ceil(h * 0.65)
  const col = new Float32Array(w)
  for (let x = 1; x < w - 1; x++) {
    let s = 0
    for (let y = y0; y < y1; y++) {
      const i = y * w + x
      s += Math.max(gx[i - 1], gx[i], gx[i + 1])
    }
    col[x] = s / (y1 - y0)
  }

  const midY = Math.floor((y0 + y1) / 2)
  const k = Math.max(3, Math.round(h * 0.08))
  const leftPicks = columnPeaks(col, Math.floor(w * 0.03), Math.floor(w * 0.47), minWall, 6)
  const rightPicks = columnPeaks(col, Math.ceil(w * 0.53), Math.floor(w * 0.97), minWall, 6)
  if (leftPicks.length === 0 || rightPicks.length === 0) return null

  // Presence per candidate (computed once each).
  const profiles = new Map<number, Uint8Array>()
  const presentFor = (p: Pick): Uint8Array => {
    let pr = profiles.get(p.x)
    if (!pr) {
      const prof = presenceProfile(gx, w, h, p.x, win)
      const thr = Math.max(5, p.strength * presenceFrac)
      pr = new Uint8Array(h)
      for (let y = 0; y < h; y++) pr[y] = prof[y] >= thr ? 1 : 0
      profiles.set(p.x, pr)
    }
    return pr
  }

  const toTrack = (p: Pick, pr: Uint8Array, top: number, bottom: number): WallTrack => {
    let hits = 0
    for (let y = top; y <= bottom; y++) hits += pr[y]
    return { x: p.x, strength: p.strength, top, bottom, fill: hits / Math.max(1, bottom - top + 1) }
  }

  let best: { l: WallTrack; r: WallTrack; top: number; bottom: number; score: number } | null = null
  const lefts: WallTrack[] = []
  const rights: WallTrack[] = []
  for (const lp of leftPicks) {
    for (const rp of rightPicks) {
      if (rp.x - lp.x < w * 0.2) continue
      const pl = presentFor(lp)
      const pr = presentFor(rp)
      // either wall present
      const either = new Uint8Array(h)
      let bothCount = 0
      let eitherCount = 0
      for (let y = 0; y < h; y++) either[y] = pl[y] | pr[y]
      if (!either[midY] && !either[midY - 1] && !either[midY + 1]) continue
      const top = extend(either, midY, -1, k)
      const bottom = extend(either, midY, 1, k)
      for (let y = top; y <= bottom; y++) {
        if (pl[y] && pr[y]) bothCount++
        if (either[y]) eitherCount++
      }
      const run = bottom - top
      if (run < h * 0.15) continue
      const both = bothCount / Math.max(1, eitherCount)
      const strength = Math.min(lp.strength, rp.strength)
      // Rows where both walls agree are what make a glass; a lone full-height
      // background edge paired with one wall scores no better than the wall alone.
      const score = (bothCount / h) * (0.5 + 0.5 * both) * Math.sqrt(strength)
      const lt = toTrack(lp, pl, top, bottom)
      const rt = toTrack(rp, pr, top, bottom)
      lefts.push(lt)
      rights.push(rt)
      if (!best || score > best.score) best = { l: lt, r: rt, top, bottom, score }
    }
  }
  if (opts.debug) opts.debug({ lefts, rights, chosen: best ? { l: best.l, r: best.r, top: best.top, bottom: best.bottom } : undefined })
  if (!best) return null

  const { l, r, top, bottom } = best
  const H0 = bottom - top

  // Horizontal-edge strength per row across the middle of the glass.
  const span = r.x - l.x
  const xa = Math.round(l.x + span * 0.3)
  const xb = Math.round(l.x + span * 0.7)
  const rowEdgeRaw = (y: number) => {
    if (y < 1 || y >= h - 1) return 0
    let s = 0
    const row = y * w
    for (let x = xa; x <= xb; x++) s += gy[row + x]
    return s / (xb - xa + 1)
  }
  // 3-row smoothing keeps the thresholds below resolution-independent.
  const rowEdge = (y: number) => (rowEdgeRaw(y - 1) + rowEdgeRaw(y) + rowEdgeRaw(y + 1)) / 3
  // Texture across the full glass width: glass and foot are busy, table is not.
  const texture = (y: number) => {
    if (y < 1 || y >= h - 1) return 0
    let s = 0
    const row = y * w
    for (let x = l.x; x <= r.x; x++) s += gx[row + x] + gy[row + x]
    return s / (r.x - l.x + 1)
  }
  const textureBand = (a: number, b: number) => {
    let s = 0
    let n = 0
    for (let y = Math.max(1, a); y <= Math.min(h - 2, b); y++) {
      s += texture(y)
      n++
    }
    return n ? s / n : 0
  }

  // Rim ring: strongest horizontal edge at the top of the run (allowing a
  // little above, since the far arc can sit above where the walls start).
  // The window stays short so the liquid line, lower down, cannot win.
  const rimLo = Math.max(1, top - Math.round(H0 * 0.06))
  const rimHi = Math.min(h - 2, top + Math.round(H0 * 0.12))
  let rimTop = top
  let rimPeak = 0
  for (let y = rimLo; y <= rimHi; y++) {
    const v = rowEdge(y)
    if (v > rimPeak) {
      rimPeak = v
      rimTop = y
    }
  }
  // Near arc: the lowest row within the rim band that still carries an edge.
  // Seen from slightly above, the near arc is a much softer edge than the far
  // arc (about a third as strong), hence the low relative threshold.
  let rimY = rimTop
  const bandEnd = Math.min(h - 2, rimTop + Math.max(2, Math.round(H0 * 0.08)))
  for (let y = bandEnd; y >= rimTop; y--) {
    if (rowEdge(y) >= rimPeak * 0.3) {
      rimY = y
      break
    }
  }

  // Base: where the foot meets the table. The run may overshoot into a
  // reflection on a glossy surface, so look for the lowest row in the bottom
  // stretch that has a real horizontal edge AND a texture cliff below it:
  // the glass and its foot are busy with highlights, the table is not, and a
  // reflection never has the cliff.
  const baseLo = Math.max(1, bottom - Math.round(H0 * 0.2))
  const baseHi = Math.min(h - 2, bottom + Math.round(H0 * 0.03))
  let basePeak = 0
  let texPeak = 0
  for (let y = baseLo; y <= baseHi; y++) {
    basePeak = Math.max(basePeak, rowEdge(y))
    texPeak = Math.max(texPeak, texture(y))
  }
  const gap = Math.max(1, Math.round(H0 * 0.005))
  const band = Math.max(2, Math.round(H0 * 0.02))
  let baseY = -1
  for (let y = baseHi; y >= baseLo; y--) {
    if (rowEdge(y) < basePeak * 0.35) continue
    const above = textureBand(y - gap - band, y - gap)
    const below = textureBand(y + gap, y + gap + band)
    // A reflection's end is also a cliff, but what sits above it is faint;
    // the real foot is among the busiest rows in the stretch.
    if (below < above * 0.6 && above >= texPeak * 0.35) {
      baseY = y
      break
    }
  }
  if (baseY < 0) {
    // No cliff found (matte table, or the foot is cut off): fall back to the
    // strongest edge in the stretch.
    baseY = bottom
    let best = 0
    for (let y = baseLo; y <= baseHi; y++) {
      const v = rowEdge(y)
      if (v > best) {
        best = v
        baseY = y
      }
    }
  }

  if (baseY - rimY < h * 0.12) return null

  const strength = Math.min(1, Math.min(l.strength, r.strength) / 30)
  const both = Math.min(1, (l.fill + r.fill) / 2 / 0.7)
  const confidence = Math.max(0, Math.min(1, 0.45 * both + 0.3 * strength + 0.25 * Math.min(1, H0 / (h * 0.5))))

  return { rimY, rimTopY: rimTop, baseY, leftX: l.x, rightX: r.x, confidence }
}
