/**
 * Liquid-line detection on a downscaled camera frame.
 *
 * Idea: inside a narrow column through the middle of the glass, foam/head is
 * bright and the beer below it is darker (black for stout, amber for lager).
 * The beer line is therefore the row with the strongest *downward* luminance
 * step. Pure function so it can be unit tested without a DOM.
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
  /** Raw luminance step (0-255). */
  step: number
}

export interface DetectOptions {
  /** Minimum luminance drop (0-255) to accept as a liquid line. */
  minStep?: number
  /** Rows averaged on each side of the candidate edge. */
  window?: number
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

export function detectLiquidLine(img: PixelSource, roi: Roi, opts: DetectOptions = {}): Detection | null {
  const minStep = opts.minStep ?? 28
  const win = Math.max(1, opts.window ?? 3)
  const lum = rowLuminance(img, roi)
  const n = lum.length
  if (n < win * 2 + 1) return null

  let bestI = -1
  let bestStep = 0
  // Candidate edge between row i and i+1: mean(above) - mean(below)
  for (let i = win - 1; i < n - win; i++) {
    let above = 0
    let below = 0
    for (let k = 0; k < win; k++) {
      above += lum[i - k]
      below += lum[i + 1 + k]
    }
    const step = (above - below) / win
    if (step > bestStep) {
      bestStep = step
      bestI = i
    }
  }
  if (bestI < 0 || bestStep < minStep) return null
  return {
    y: Math.floor(roi.y0) + bestI + 1,
    step: bestStep,
    confidence: Math.min(1, bestStep / 90),
  }
}
