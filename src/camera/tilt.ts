/**
 * Phone tilt from the orientation sensor, for the camera's tilt correction.
 *
 * With the phone in portrait, beta is 90 when it is upright and drops towards
 * 0 as it is laid back face-up, so the rear camera's pitch is beta - 90 (up
 * positive). gamma is the sideways lean, which tilts the glass on screen.
 *
 * iOS only delivers orientation events after DeviceOrientationEvent.
 * requestPermission() is called from a tap, so the first tap on any link to
 * the score screen asks for it (see installTiltPermissionOnTap).
 */

export interface Tilt {
  /** Camera pitch, radians, 0 = level, positive = pointing up. */
  pitch: number
  /** Sideways lean, radians. */
  roll: number
}

const DEG = Math.PI / 180
/** Readings older than this are stale (sensor stopped or never started). */
const MAX_AGE_MS = 1000
/** Steeper than this is a laptop lying flat or a bad reading, not someone aiming at a glass. */
const MAX_PITCH = 70 * DEG

let latest: (Tilt & { at: number }) | null = null
let listening = false
let asked = false

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta === null || e.gamma === null) return
  latest = { pitch: (e.beta - 90) * DEG, roll: e.gamma * DEG, at: performance.now() }
}

function listen() {
  if (listening || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
  window.addEventListener('deviceorientation', onOrientation)
  listening = true
}

/** Start listening, asking for permission where the browser requires it. Call from a tap. */
export async function requestTilt(): Promise<void> {
  if (listening || asked || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
  if (typeof D.requestPermission !== 'function') {
    listen()
    return
  }
  asked = true
  try {
    if ((await D.requestPermission()) === 'granted') listen()
  } catch {
    // denied or not from a gesture: carry on without tilt correction
  }
}

/** Ask for tilt access on the first tap on a link to the score screen. */
export function installTiltPermissionOnTap() {
  if (typeof window === 'undefined') return
  const D = typeof DeviceOrientationEvent === 'undefined' ? undefined : (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
  if (!D) return
  if (typeof D.requestPermission !== 'function') {
    listen()
    return
  }
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.('a[href$="/score"]')
    if (!a) return
    window.removeEventListener('click', onClick, true)
    void requestTilt()
  }
  window.addEventListener('click', onClick, true)
}

/** Latest tilt, or null when unknown, stale, implausible, or the phone is in landscape. */
export function currentTilt(): Tilt | null {
  if (!latest || performance.now() - latest.at > MAX_AGE_MS) return null
  if (window.innerWidth > window.innerHeight) return null
  if (Math.abs(latest.pitch) > MAX_PITCH) return null
  return { pitch: latest.pitch, roll: latest.roll }
}
