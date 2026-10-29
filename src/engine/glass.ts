/**
 * Glass geometry. Everything is expressed as a fraction of the rim-to-base
 * height so that glass size, camera distance and zoom do not matter.
 */

/** Approximate height of a 20 oz tulip pint glass, used only for "mm off" copy. */
export const GLASS_HEIGHT_MM = 150

/**
 * Where the centre of the "G" sits on the official tulip pint glass, as a
 * fraction of the rim-to-base height measured down from the rim.
 *
 * Calibration: on the branded tulip glass the harp sits in the upper bulge and
 * the GUINNESS wordmark sits directly under it, "fairly far down the glass".
 * The wordmark's vertical centre is roughly 30% of the way down. Adjust here if
 * you measure your own glass differently; nothing else hard-codes it.
 */
export const TARGET_FRACTION = 0.3

/**
 * Half-height of the G's horizontal bar as a fraction of glass height. A liquid
 * line anywhere inside this band counts as a perfect split.
 */
export const G_BAND = 0.02

/** Full height of the G letter (for drawing the ghost), fraction of glass height. */
export const G_LETTER_HEIGHT = 0.1

/** Rim and base positions in whatever unit the caller uses (pixels or fractions). */
export interface GlassFrame {
  rimY: number
  baseY: number
}

export const DEFAULT_FRAME: GlassFrame = { rimY: 0.2, baseY: 0.85 }

export function glassHeight(frame: GlassFrame): number {
  return frame.baseY - frame.rimY
}

/** Convert a y position into a fraction of glass height below the rim. */
export function lineFraction(y: number, frame: GlassFrame): number {
  const h = glassHeight(frame)
  if (h <= 0) return 0
  return (y - frame.rimY) / h
}

/** Convert a fraction of glass height into a y position. */
export function fractionToY(fraction: number, frame: GlassFrame): number {
  return frame.rimY + fraction * glassHeight(frame)
}

export function targetY(frame: GlassFrame, target = TARGET_FRACTION): number {
  return fractionToY(target, frame)
}

export function fractionToMm(fraction: number): number {
  return fraction * GLASS_HEIGHT_MM
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
