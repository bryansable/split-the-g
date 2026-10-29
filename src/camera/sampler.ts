import { detectLiquidLine, type Detection } from '../engine/detect'
import { detectGlass } from '../engine/frame'
import { containerToMedia, coverTransform, mediaToContainer, type CoverTransform } from '../engine/mapping'
import type { GlassFrame } from '../engine/glass'
import { ROI_HALF_WIDTH, SAMPLE_WIDTH, glassRoi } from '../engine/roi'

export type MediaSource =
  | { kind: 'video'; el: HTMLVideoElement }
  | { kind: 'image'; el: HTMLImageElement }

export function mediaSize(src: MediaSource): { w: number; h: number } {
  if (src.kind === 'video') return { w: src.el.videoWidth, h: src.el.videoHeight }
  return { w: src.el.naturalWidth, h: src.el.naturalHeight }
}

/** A downscaled copy of the current frame plus the maths to map it to the screen. */
export interface Sample {
  img: ImageData
  /** container <-> media (full-resolution) transform */
  t: CoverTransform
  /** sample px per media px */
  scale: number
  containerW: number
  containerH: number
}

export function grabSample(src: MediaSource, canvas: HTMLCanvasElement, containerW: number, containerH: number): Sample | null {
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
  return { img: ctx.getImageData(0, 0, sw, sh), t: coverTransform(containerW, containerH, w, h), scale, containerW, containerH }
}

function sampleToContainer(s: Sample, x: number, y: number) {
  return mediaToContainer(s.t, x / s.scale, y / s.scale)
}

function containerToSample(s: Sample, x: number, y: number) {
  const m = containerToMedia(s.t, x, y)
  return { x: m.x * s.scale, y: m.y * s.scale }
}

export interface GlassFix {
  /** rim/base in container px */
  frame: GlassFrame
  /** wall positions in container px */
  walls: { left: number; right: number }
  confidence: number
}

/** Find the glass in the sample and express it in container pixels. */
export function findGlass(s: Sample): GlassFix | null {
  const g = detectGlass(s.img)
  if (!g) return null
  const rim = sampleToContainer(s, 0, g.rimY).y
  const base = sampleToContainer(s, 0, g.baseY).y
  const left = sampleToContainer(s, g.leftX, 0).x
  const right = sampleToContainer(s, g.rightX, 0).x
  if (base - rim < s.containerH * 0.1) return null
  return { frame: { rimY: rim, baseY: base }, walls: { left, right }, confidence: g.confidence }
}

/**
 * Run liquid-line detection inside the glass column between rim and base.
 * Returns the line in container pixels.
 */
export function findLine(s: Sample, frame: GlassFrame, centreX = s.containerW / 2): { y: number; detection: Detection } | null {
  const rim = containerToSample(s, centreX, frame.rimY)
  const base = containerToSample(s, centreX, frame.baseY)
  const colHalf = containerToSample(s, centreX + s.containerW * ROI_HALF_WIDTH, 0).x - rim.x
  const roi = glassRoi(s.img.width, rim.y, base.y, rim.x)
  roi.x0 = rim.x - colHalf
  roi.x1 = rim.x + colHalf
  const detection = detectLiquidLine(s.img, roi)
  if (!detection) return null
  return { y: sampleToContainer(s, 0, detection.y).y, detection }
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
