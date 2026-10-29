/**
 * Automatic glass framing: find the glass's side walls, rim and base in a
 * downscaled frame so the user does not have to line anything up.
 *
 * Method (classical, no ML, runs in a few ms on a 240px-wide frame):
 *   1. Horizontal-gradient magnitude per pixel (vertical edges).
 *   2. In a band around mid-height, score each column by its vertical-edge
 *      energy and pick the strongest wall candidate on each side of centre,
 *      preferring the one nearest the centre so a mug handle or a window
 *      frame further out does not win.
 *   3. Track each wall edge row by row upwards and downwards, allowing a few
 *      pixels of sideways drift per row for curved (tulip) glasses, until
 *      the edge disappears. Where the walls stop is the rim and the base.
 *   4. The rim is an ellipse seen from slightly above; the user reads the
 *      level against the FRONT of the glass, so the rim row is refined to the
 *      lowest strong horizontal edge in the top slice of the glass (the near
 *      arc of the rim).
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

export interface FrameOptions {
  /** Minimum column edge strength to count as a wall. */
  minWall?: number
  /** Sideways drift allowed per row while tracking a wall, px. */
  drift?: number
  /** Receives the wall candidates considered (tests and tuning). */
  debug?: (info: { lefts: WallTrack[]; rights: WallTrack[] }) => void
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

export interface WallTrack {
  x: number
  strength: number
  /** Rows where the tracked edge starts and ends. */
  top: number
  bottom: number
}

/**
 * Local maxima of the column profile in [x0, x1) that reach at least a third
 * of the range's peak, strongest first, each tracked up and down.
 */
function wallCandidates(
  gx: Float32Array,
  w: number,
  h: number,
  col: Float32Array,
  x0: number,
  x1: number,
  midY: number,
  minWall: number,
  drift: number,
  limit = 6,
): WallTrack[] {
  let peak = 0
  for (let x = x0; x < x1; x++) peak = Math.max(peak, col[x])
  if (peak < minWall) return []
  const picks: { x: number; strength: number }[] = []
  for (let x = x0 + 1; x < x1 - 1; x++) {
    const v = col[x]
    if (v < peak * 0.33 || v < minWall || v < col[x - 1] || v < col[x + 1]) continue
    // one pick per plateau / per 4px: a thick edge must not crowd out others
    const prev = picks[picks.length - 1]
    if (prev && x - prev.x <= 3) {
      if (v > prev.strength) picks[picks.length - 1] = { x, strength: v }
      continue
    }
    picks.push({ x, strength: v })
  }
  picks.sort((a, b) => b.strength - a.strength)
  return picks.slice(0, limit).map((p) => ({ ...p, ...trackWall(gx, w, h, p.x, midY, p.strength, drift) }))
}

/**
 * Score a left/right wall pair: long shared vertical run, ends that agree,
 * decent edge strength. The real walls of a glass are symmetric and run from
 * rim to base; reflections inside the glass, a mug handle, or a background
 * bar fail on length or on agreement.
 */
export function pairScore(l: WallTrack, r: WallTrack, w: number, h: number): number {
  const top = Math.max(l.top, r.top)
  const bottom = Math.min(l.bottom, r.bottom)
  const run = bottom - top
  if (run < h * 0.15 || r.x - l.x < w * 0.2) return 0
  const agree = 1 - Math.min(1, (Math.abs(l.top - r.top) + Math.abs(l.bottom - r.bottom)) / (h * 0.2))
  const strength = Math.min(l.strength, r.strength)
  return (run / h) * (0.4 + 0.6 * agree) * Math.sqrt(strength)
}

/** Follow a vertical edge from (x0, y0) up and down; return the rows where it ends. */
function trackWall(gx: Float32Array, w: number, h: number, x0: number, y0: number, strength: number, drift: number) {
  const thr = Math.max(6, strength * 0.35)
  const maxMiss = Math.max(3, Math.round(h * 0.04))

  function run(dir: -1 | 1): number {
    let x = x0
    let miss = 0
    let last = y0
    for (let y = y0 + dir; y >= 0 && y < h; y += dir) {
      let bestX = x
      let bestV = -1
      for (let dx = -drift; dx <= drift; dx++) {
        const xx = x + dx
        if (xx < 1 || xx >= w - 1) continue
        const v = gx[y * w + xx]
        if (v > bestV) {
          bestV = v
          bestX = xx
        }
      }
      if (bestV >= thr) {
        x = bestX
        last = y
        miss = 0
      } else if (++miss > maxMiss) {
        break
      }
    }
    return last
  }

  return { top: run(-1), bottom: run(1) }
}

export function detectGlass(img: PixelSource, opts: FrameOptions = {}): GlassDetection | null {
  const { width: w, height: h } = img
  if (w < 40 || h < 40) return null
  const minWall = opts.minWall ?? 8
  const drift = opts.drift ?? 3
  const g = toGray(img)
  const gx = horizontalGradient(g, w, h)

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
  const lefts = wallCandidates(gx, w, h, col, Math.floor(w * 0.03), Math.floor(w * 0.47), midY, minWall, drift)
  const rights = wallCandidates(gx, w, h, col, Math.ceil(w * 0.53), Math.floor(w * 0.97), midY, minWall, drift)
  if (opts.debug) opts.debug({ lefts, rights })

  let left: WallTrack | null = null
  let right: WallTrack | null = null
  let bestPair = 0
  for (const l of lefts) {
    for (const r of rights) {
      const s = pairScore(l, r, w, h)
      if (s > bestPair) {
        bestPair = s
        left = l
        right = r
      }
    }
  }
  if (!left || !right) return null
  const L = left
  const R = right

  // Conservative: a wall that runs on along a background edge is cut by the other.
  const rimTop = Math.max(L.top, R.top)
  const base = Math.min(L.bottom, R.bottom)
  const H = base - rimTop
  if (H < h * 0.15) return null

  // Horizontal-edge strength per row across the middle of the glass.
  const span = right.x - left.x
  const xa = Math.round(left.x + span * 0.3)
  const xb = Math.round(left.x + span * 0.7)
  const rowEdge = (y: number) => {
    let s = 0
    for (let x = xa; x <= xb; x++) s += Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x])
    return s / (xb - xa + 1)
  }

  // Front rim: lowest strong horizontal edge in the top slice of the glass
  // (the near arc of the rim ellipse).
  const rimStart = Math.max(1, rimTop)
  const rimEnd = Math.min(h - 2, rimTop + Math.max(3, Math.round(H * 0.1)))
  const rimEdges: number[] = []
  let peakEdge = 0
  for (let y = rimStart; y <= rimEnd; y++) {
    const v = rowEdge(y)
    rimEdges.push(v)
    peakEdge = Math.max(peakEdge, v)
  }
  let rimY = rimTop
  for (let k = rimEdges.length - 1; k >= 0; k--) {
    if (rimEdges[k] >= peakEdge * 0.5) {
      rimY = rimStart + k
      break
    }
  }

  // Front base: the walls stop where the foot starts to flare, so look a
  // little below for the strongest horizontal edge (the bottom of the glass
  // or its contact shadow).
  const baseStart = Math.max(1, base - Math.round(H * 0.02))
  const baseEnd = Math.min(h - 2, base + Math.round(H * 0.08))
  let baseY = base
  let basePeak = 0
  for (let y = baseStart; y <= baseEnd; y++) {
    const v = rowEdge(y)
    if (v > basePeak) {
      basePeak = v
      baseY = y
    }
  }
  if (basePeak < 6) baseY = base

  // Confidence: wall agreement and relative strength.
  const topAgree = 1 - Math.min(1, Math.abs(L.top - R.top) / (h * 0.1))
  const botAgree = 1 - Math.min(1, Math.abs(L.bottom - R.bottom) / (h * 0.1))
  const strength = Math.min(1, Math.min(left.strength, right.strength) / 30)
  const confidence = Math.max(0, Math.min(1, 0.4 * topAgree + 0.3 * botAgree + 0.3 * strength))

  return { rimY, rimTopY: rimTop, baseY, leftX: left.x, rightX: right.x, confidence }
}
