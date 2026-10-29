/**
 * Accuracy harness shared by the fixture tests and the tuning script.
 * Everything is reported in percent of glass height (rim to base), because
 * that is the unit the score is computed in: 1% of glass height is 6 points.
 */
import { detectLiquidLine, type PixelSource } from './detect'
import { detectGlass, type FrameOptions, type GlassDetection } from './frame'
import { glassRoi } from './roi'

export interface Truth {
  rimY: number
  lineY: number
  baseY: number
  leftX: number
  rightX: number
}

export interface Report {
  /** detections scaled back to full-resolution pixels */
  rimY: number | null
  baseY: number | null
  lineY: number | null
  leftX: number | null
  rightX: number | null
  /** signed errors, percent of true glass height */
  rimErr: number | null
  baseErr: number | null
  lineErr: number | null
  /** error of the final reading (line as fraction of detected glass vs truth), in percent */
  fractionErr: number | null
  frameConfidence: number
  lineConfidence: number
}

/** Box-filter downscale to `targetW` wide, matching what the sampler does. */
export function downscale(img: PixelSource, targetW: number): PixelSource {
  const scale = targetW / img.width
  const w = targetW
  const h = Math.round(img.height * scale)
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / scale)
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / scale))
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale)
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / scale))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = sy0; sy < sy1 && sy < img.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < img.width; sx++) {
          const i = (sy * img.width + sx) * 4
          r += img.data[i]
          g += img.data[i + 1]
          b += img.data[i + 2]
          n++
        }
      }
      const o = (y * w + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

/** Run the full pipeline on a full-resolution image and compare with truth. */
export function evaluate(
  full: PixelSource,
  truth: Truth,
  sampleWidth: number,
  frameOpts: FrameOptions = {},
): Report & { glass: GlassDetection | null } {
  const img = downscale(full, sampleWidth)
  const s = img.width / full.width
  const H = truth.baseY - truth.rimY
  const pct = (px: number) => (100 * px) / H

  const g = detectGlass(img, frameOpts)
  if (!g) {
    return {
      rimY: null,
      baseY: null,
      lineY: null,
      leftX: null,
      rightX: null,
      rimErr: null,
      baseErr: null,
      lineErr: null,
      fractionErr: null,
      frameConfidence: 0,
      lineConfidence: 0,
      glass: null,
    }
  }
  const rimY = g.rimY / s
  const baseY = g.baseY / s
  const roi = glassRoi(img.width, g.rimY, g.baseY, (g.leftX + g.rightX) / 2)
  const d = detectLiquidLine(img, roi)
  const lineY = d ? d.y / s : null
  const trueFrac = (truth.lineY - truth.rimY) / H
  const gotFrac = lineY === null ? null : (lineY - rimY) / (baseY - rimY)
  return {
    rimY,
    baseY,
    lineY,
    leftX: g.leftX / s,
    rightX: g.rightX / s,
    rimErr: pct(rimY - truth.rimY),
    baseErr: pct(baseY - truth.baseY),
    lineErr: lineY === null ? null : pct(lineY - truth.lineY),
    fractionErr: gotFrac === null ? null : 100 * (gotFrac - trueFrac),
    frameConfidence: g.confidence,
    lineConfidence: d?.confidence ?? 0,
    glass: g,
  }
}

export function formatReport(name: string, r: Report): string {
  const f = (v: number | null) => (v === null ? '  n/a ' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%')
  return `${name}: rim ${f(r.rimErr)}  base ${f(r.baseErr)}  line ${f(r.lineErr)}  reading ${f(r.fractionErr)}  (frame conf ${r.frameConfidence.toFixed(2)}, line conf ${r.lineConfidence.toFixed(2)})`
}
