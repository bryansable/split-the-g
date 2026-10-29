import type { Roi } from './detect'

/**
 * Where to look for the liquid line, given the rim and base rows in the same
 * pixel space as the image. Horizontally: a column through the middle of the
 * glass. Vertically: skip the rim glare at the top and the thick foot of the
 * glass at the bottom, where bright-to-dark edges fool the detector. No one
 * splits the G with the line in the bottom quarter of the glass.
 */
export const ROI_TOP = 0.05
export const ROI_BOTTOM = 0.75
export const ROI_HALF_WIDTH = 0.12

export function glassRoi(imageWidth: number, rimY: number, baseY: number, centreX = imageWidth / 2): Roi {
  const h = baseY - rimY
  const halfW = imageWidth * ROI_HALF_WIDTH
  return {
    x0: centreX - halfW,
    x1: centreX + halfW,
    y0: rimY + h * ROI_TOP,
    y1: rimY + h * ROI_BOTTOM,
  }
}
