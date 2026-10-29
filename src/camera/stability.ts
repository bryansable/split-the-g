import type { GlassFrame } from '../engine/glass'

/**
 * Temporal stability for the live loop. Single frames are noisy; the user
 * sees a reading only once the glass has been found on consecutive samples
 * with a consistent frame, and the score only once the liquid line has
 * settled. All values are in container pixels.
 */

export interface FrameSample extends GlassFrame {
  left: number
  right: number
}

export interface StableFrame extends FrameSample {
  /** max-min spread of rim and base over the window, as a fraction of glass height */
  spread: number
}

const FRAME_WINDOW = 5
const LINE_WINDOW = 5
/** consecutive misses before the glass is considered gone */
const MISS_LIMIT = 4
/** rim/base agreement needed before the frame counts as stable */
const FRAME_SPREAD = 0.02
/** line agreement needed before the reading is locked */
const LINE_SPREAD = 0.01

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export class Stabilizer {
  private frames: FrameSample[] = []
  private lines: number[] = []
  private frameMisses = 0
  private lineMisses = 0

  reset() {
    this.frames = []
    this.lines = []
    this.frameMisses = 0
    this.lineMisses = 0
  }

  /** Feed one frame detection (or null when none was found). */
  pushFrame(f: FrameSample | null) {
    if (f) {
      this.frames.push(f)
      if (this.frames.length > FRAME_WINDOW) this.frames.shift()
      this.frameMisses = 0
    } else if (++this.frameMisses >= MISS_LIMIT) {
      this.frames = []
      this.lines = []
      this.lineMisses = 0
    }
  }

  /** Median frame over the window, with its spread; null until 3 agreeing samples exist. */
  frame(): StableFrame | null {
    if (this.frames.length < 3) return null
    const recent = this.frames.slice(-3)
    const rim = median(this.frames.map((f) => f.rimY))
    const base = median(this.frames.map((f) => f.baseY))
    const h = base - rim
    if (h <= 0) return null
    const spread =
      Math.max(
        Math.max(...recent.map((f) => f.rimY)) - Math.min(...recent.map((f) => f.rimY)),
        Math.max(...recent.map((f) => f.baseY)) - Math.min(...recent.map((f) => f.baseY)),
      ) / h
    if (spread > FRAME_SPREAD) return null
    return {
      rimY: rim,
      baseY: base,
      left: median(this.frames.map((f) => f.left)),
      right: median(this.frames.map((f) => f.right)),
      spread,
    }
  }

  /** Feed one liquid-line detection (or null). */
  pushLine(y: number | null) {
    if (y !== null) {
      this.lines.push(y)
      if (this.lines.length > LINE_WINDOW) this.lines.shift()
      this.lineMisses = 0
    } else if (++this.lineMisses >= MISS_LIMIT) {
      this.lines = []
    }
  }

  /** Median line and whether it has settled, given the glass height in px. */
  line(glassHeight: number): { y: number; locked: boolean } | null {
    if (this.lines.length < 2) return null
    const recent = this.lines.slice(-4)
    const spread = (Math.max(...recent) - Math.min(...recent)) / Math.max(1, glassHeight)
    return { y: median(this.lines), locked: recent.length >= 4 && spread <= LINE_SPREAD }
  }

  get hasGlass() {
    return this.frames.length > 0
  }
}
