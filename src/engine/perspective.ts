/**
 * Camera tilt correction.
 *
 * Reading the line as a straight fraction of the on-screen rim-to-base
 * distance is only exact when the phone is held upright. Aim it down at the
 * glass from above (or up from below) and the glass is foreshortened unevenly:
 * the half nearer the edge of the picture is stretched relative to the rest.
 *
 * With the camera's pitch (from the phone's orientation sensor) and its focal
 * length, every image row maps to the elevation angle of its ray. Points on
 * the front of the glass all sit at the same horizontal distance Z from the
 * camera, so their height relative to the lens is Z * tan(elevation). Z and
 * the camera's height cancel out of the fraction, which leaves an exact
 * reading from any angle:
 *
 *   fraction = (tan a_rim - tan a_line) / (tan a_rim - tan a_base)
 *
 * The same angles say whether the camera is above or below the rim and the
 * liquid, which decides which arc of each ellipse is the front of the glass.
 *
 * All values are in one pixel space (rows grow downwards). Pure functions.
 */
import { lineFraction, type GlassFrame } from './glass'

/**
 * Typical phone main camera: about 67 degrees across the long side of the
 * picture (26 mm equivalent). The exact value matters little: an error here
 * only scales a correction that is itself a few percent.
 */
export const CAMERA_LONG_FOV_DEG = 67

export interface View {
  /** Camera pitch in radians: 0 = level, positive = pointing up. */
  pitch: number
  /** Focal length in pixels. */
  f: number
  /** Row of the optical centre. */
  cy: number
}

/** Focal length in pixels for a picture of the given size. */
export function focalLength(width: number, height: number, fovDeg = CAMERA_LONG_FOV_DEG): number {
  return Math.max(width, height) / 2 / Math.tan((fovDeg * Math.PI) / 360)
}

/** tan of the elevation angle (up positive) of the ray through row y. */
export function elevationTan(y: number, v: View): number {
  return Math.tan(v.pitch - Math.atan((y - v.cy) / v.f))
}

/** Row where the ray is level: things above it on screen are above the lens. */
export function horizonY(v: View): number {
  return v.cy + v.f * Math.tan(v.pitch)
}

/** True if the point at row y is physically above the camera. */
export function isAboveCamera(y: number, v: View): boolean {
  return y < horizonY(v)
}

/** Fraction of glass height below the rim, corrected for tilt when a view is known. */
export function trueFraction(y: number, frame: GlassFrame, v: View | null): number {
  if (!v) return lineFraction(y, frame)
  const r = elevationTan(frame.rimY, v)
  const b = elevationTan(frame.baseY, v)
  if (r - b <= 0) return lineFraction(y, frame)
  return (r - elevationTan(y, v)) / (r - b)
}

/** Inverse of trueFraction: the row where a given fraction of the glass appears. */
export function fractionRow(fraction: number, frame: GlassFrame, v: View | null): number {
  if (!v) return frame.rimY + fraction * (frame.baseY - frame.rimY)
  const r = elevationTan(frame.rimY, v)
  const b = elevationTan(frame.baseY, v)
  if (r - b <= 0) return frame.rimY + fraction * (frame.baseY - frame.rimY)
  const t = r - fraction * (r - b)
  return v.cy + v.f * Math.tan(v.pitch - Math.atan(t))
}
