/**
 * Maps between the on-screen container (what the overlay is drawn on) and the
 * underlying video/image pixels when the media is shown with object-fit: cover.
 */
export interface CoverTransform {
  scale: number
  /** Offset of the media's top-left inside the container, in container px (<= 0 when cropped). */
  ox: number
  oy: number
}

export function coverTransform(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
): CoverTransform {
  if (mediaW <= 0 || mediaH <= 0 || containerW <= 0 || containerH <= 0) {
    return { scale: 1, ox: 0, oy: 0 }
  }
  const scale = Math.max(containerW / mediaW, containerH / mediaH)
  return {
    scale,
    ox: (containerW - mediaW * scale) / 2,
    oy: (containerH - mediaH * scale) / 2,
  }
}

export function containerToMedia(t: CoverTransform, x: number, y: number) {
  return { x: (x - t.ox) / t.scale, y: (y - t.oy) / t.scale }
}

export function mediaToContainer(t: CoverTransform, x: number, y: number) {
  return { x: x * t.scale + t.ox, y: y * t.scale + t.oy }
}
