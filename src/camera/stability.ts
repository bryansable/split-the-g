import type { GlassFrame } from '../engine/glass'

/**
 * Temporal stability for the live loop. Single frames are noisy, so the
 * reading shown is a median over recent samples and it locks once the last
 * few agree.
 *
 * Each sample's reading is taken against that same sample's rim and base, as
 * a fraction of the glass. A hand-held phone moves the whole glass around the
 * screen from frame to frame, but the line moves with it, so the fraction
 * holds steady even while the pixel positions do not. That is what lets the
 * reading lock in well under a second instead of waiting for a perfectly
 * still hand. Frame positions are in container pixels.
 */

export interface FrameSample extends GlassFrame {
  left: number
  right: number
}

export interface Reading extends FrameSample {
  /** Line as a fraction of this sample's glass height, or null when no line was found. */
  fraction: number | null
}

export interface StableFrame extends FrameSample {
  /** max-min spread of rim and base over recent samples, as a fraction of glass height */
  spread: number
}

const WINDOW = 6
/** consecutive misses before the glass is considered gone */
const MISS_LIMIT = 4
/** recent samples whose readings must agree before the reading locks */
const LOCK_COUNT = 4
/** reading agreement needed to lock: 1% of glass height (6 points) */
const LOCK_SPREAD = 0.01
/** frame movement beyond this (fraction of glass height) means the phone is swinging: blur, no lock */
const MOTION_SPREAD = 0.08

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values)
}

export class Stabilizer {
  private samples: Reading[] = []
  private misses = 0

  reset() {
    this.samples = []
    this.misses = 0
  }

  /** Feed one sample (or null when no glass was found). */
  push(r: Reading | null) {
    if (r) {
      this.samples.push(r)
      if (this.samples.length > WINDOW) this.samples.shift()
      this.misses = 0
    } else if (++this.misses >= MISS_LIMIT) {
      this.samples = []
    }
  }

  /** Median frame over the window; null until two samples exist. */
  frame(): StableFrame | null {
    if (this.samples.length < 2) return null
    const rim = median(this.samples.map((f) => f.rimY))
    const base = median(this.samples.map((f) => f.baseY))
    const h = base - rim
    if (h <= 0) return null
    const recent = this.samples.slice(-3)
    const spread = Math.max(range(recent.map((f) => f.rimY)), range(recent.map((f) => f.baseY))) / h
    return {
      rimY: rim,
      baseY: base,
      left: median(this.samples.map((f) => f.left)),
      right: median(this.samples.map((f) => f.right)),
      spread,
    }
  }

  /** Median reading and whether it has locked. */
  reading(): { fraction: number; locked: boolean } | null {
    const fractions = this.samples.map((s) => s.fraction).filter((f): f is number => f !== null)
    if (fractions.length < 2) return null
    const recent = this.samples.slice(-LOCK_COUNT)
    const recentFractions = recent.map((s) => s.fraction).filter((f): f is number => f !== null)
    const steady = (this.frame()?.spread ?? Infinity) <= MOTION_SPREAD
    const locked = steady && recentFractions.length === LOCK_COUNT && range(recentFractions) <= LOCK_SPREAD
    return { fraction: median(locked ? recentFractions : fractions), locked }
  }

  get hasGlass() {
    return this.samples.length > 0
  }
}
