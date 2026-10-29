import { detectLiquidLine, type Detection } from '../engine/detect'
import { containerToMedia, coverTransform, mediaToContainer } from '../engine/mapping'
import type { GlassFrame } from '../engine/glass'

export type MediaSource =
  | { kind: 'video'; el: HTMLVideoElement }
  | { kind: 'image'; el: HTMLImageElement }

export function mediaSize(src: MediaSource): { w: number; h: number } {
  if (src.kind === 'video') return { w: src.el.videoWidth, h: src.el.videoHeight }
  return { w: src.el.naturalWidth, h: src.el.naturalHeight }
}

const SAMPLE_WIDTH = 240

/**
 * Downscale the current media frame, run detection inside the glass column
 * between rim and base, and return the liquid line in container pixels.
 */
export function sampleLine(
  src: MediaSource,
  canvas: HTMLCanvasElement,
  containerW: number,
  containerH: number,
  frame: GlassFrame,
): { y: number; detection: Detection } | null {
  const { w, h } = mediaSize(src)
  if (w === 0 || h === 0) return null
  const scale = SAMPLE_WIDTH / w
  const sw = SAMPLE_WIDTH
  const sh = Math.max(1, Math.round(h * scale))
  if (canvas.width !== sw || canvas.height !== sh) {
    canvas.width = sw
    canvas.height = sh
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(src.el, 0, 0, sw, sh)

  const t = coverTransform(containerW, containerH, w, h)
  const rim = containerToMedia(t, containerW / 2, frame.rimY)
  const base = containerToMedia(t, containerW / 2, frame.baseY)
  const halfW = containerW * 0.12 // central column of the glass
  const left = containerToMedia(t, containerW / 2 - halfW, 0).x
  const right = containerToMedia(t, containerW / 2 + halfW, 0).x

  const glassH = base.y - rim.y
  const roi = {
    x0: left * scale,
    x1: right * scale,
    // ignore the very top (empty glass / rim glare) and bottom
    y0: (rim.y + glassH * 0.04) * scale,
    y1: (base.y - glassH * 0.05) * scale,
  }
  const detection = detectLiquidLine(ctx.getImageData(0, 0, sw, sh), roi)
  if (!detection) return null
  const mediaY = detection.y / scale
  return { y: mediaToContainer(t, 0, mediaY).y, detection }
}

/**
 * Render the current frame (cover-cropped exactly as displayed) into a canvas
 * at `pixelRatio` times the container size. Returns the canvas.
 */
export function snapshot(src: MediaSource, containerW: number, containerH: number, pixelRatio = 2): HTMLCanvasElement {
  const { w, h } = mediaSize(src)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(containerW * pixelRatio)
  canvas.height = Math.round(containerH * pixelRatio)
  const ctx = canvas.getContext('2d')!
  const t = coverTransform(containerW, containerH, w, h)
  ctx.scale(pixelRatio, pixelRatio)
  ctx.drawImage(src.el, t.ox, t.oy, w * t.scale, h * t.scale)
  return canvas
}
