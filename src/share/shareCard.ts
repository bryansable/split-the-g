import type { ScoreResult } from '../engine/score'
import { TIER_COLOR } from '../engine/score'
import { getMode } from '../data/mode'

export const APP_URL = 'https://pintsplit.com/'

export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

/** Rounded-rect helper for older canvas implementations. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function palette() {
  return getMode() === 'sparkling'
    ? { ink: '#06101c', wood: '#0f2340', cream: '#e6f2ff', gold: '#62c6ff', muted: '#9fbad6' }
    : { ink: '#0d0906', wood: '#241710', cream: '#f3e6c9', gold: '#c9a447', muted: '#c9bda6' }
}

/**
 * 1080x1350 share card with the photo as the hero: full-bleed shot, a score
 * stamp in the top corner, and a band along the bottom with the wordmark and
 * the challenge line. `crop` (snapshot pixels) narrows the shot to the glass.
 */
export async function renderShareCard(
  snapshotUrl: string | null,
  result: ScoreResult,
  when: Date,
  crop: Crop | null = null,
): Promise<Blob> {
  const W = 1080
  const H = 1350
  const p = palette()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  try {
    await document.fonts.load('bold 200px Cinzel')
  } catch {
    /* fall back to Georgia */
  }
  const display = "Cinzel, Georgia, 'Times New Roman', serif"

  ctx.fillStyle = p.ink
  ctx.fillRect(0, 0, W, H)

  // Photo, cover-fit to the whole card.
  if (snapshotUrl) {
    const img = await loadImage(snapshotUrl)
    const sx = crop ? crop.x : 0
    const sy = crop ? crop.y : 0
    const sw = crop ? crop.w : img.width
    const sh = crop ? crop.h : img.height
    const scale = Math.max(W / sw, H / sh)
    const dw = sw * scale
    const dh = sh * scale
    ctx.drawImage(img, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh)
  }

  // Legibility gradients top and bottom.
  const top = ctx.createLinearGradient(0, 0, 0, 420)
  top.addColorStop(0, 'rgba(0,0,0,0.55)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 420)
  const bottom = ctx.createLinearGradient(0, H - 420, 0, H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, H - 420, W, 420)

  // Thin frame.
  ctx.strokeStyle = p.gold
  ctx.lineWidth = 6
  ctx.strokeRect(22, 22, W - 44, H - 44)

  // Score stamp, top-left, like a chalkboard hung on the wall.
  const color = TIER_COLOR[result.tier]
  const stamp = { x: 56, y: 56, w: 360, h: 300 }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 30
  ctx.fillStyle = p.wood
  roundRect(ctx, stamp.x, stamp.y, stamp.w, stamp.h, 28)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = p.gold
  ctx.lineWidth = 5
  roundRect(ctx, stamp.x, stamp.y, stamp.w, stamp.h, 28)
  ctx.stroke()
  ctx.strokeStyle = p.gold
  ctx.lineWidth = 1.5
  roundRect(ctx, stamp.x + 12, stamp.y + 12, stamp.w - 24, stamp.h - 24, 20)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = p.gold
  ctx.font = `600 24px ${display}`
  ctx.fillText('S P L I T   T H E   G', stamp.x + stamp.w / 2, stamp.y + 62)
  ctx.fillStyle = color
  ctx.font = `bold 170px ${display}`
  ctx.fillText(String(result.score), stamp.x + stamp.w / 2, stamp.y + 222)
  ctx.fillStyle = p.cream
  ctx.font = `bold 30px ${display}`
  ctx.fillText(result.title.toUpperCase(), stamp.x + stamp.w / 2, stamp.y + 272)

  // Bottom band: detail, challenge, link.
  ctx.textAlign = 'left'
  ctx.fillStyle = p.cream
  ctx.font = '38px system-ui, sans-serif'
  ctx.fillText(result.detail, 64, H - 220)
  ctx.fillStyle = p.gold
  ctx.font = `bold 64px ${display}`
  ctx.fillText('Can you beat it?', 64, H - 130)
  ctx.fillStyle = p.muted
  ctx.font = '34px system-ui, sans-serif'
  ctx.fillText(`${APP_URL.replace('https://', '').replace(/\/$/, '')}  ·  ${when.toLocaleDateString()}`, 64, H - 66)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9)
  })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export type ShareOutcome = 'shared' | 'text-only' | 'copied' | 'downloaded' | 'cancelled'

/** True when this browser can put an image on the share sheet. */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (!nav.share || !nav.canShare) return false
  try {
    return nav.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] })
  } catch {
    return false
  }
}

/**
 * Share the card image with the challenge text. Falls back to text-only
 * share, then clipboard, then a download of the card.
 */
export async function shareResult(blob: Blob, text: string): Promise<ShareOutcome> {
  const file = new File([blob], 'split-the-g.jpg', { type: 'image/jpeg' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text, title: 'Split The G' })
      return 'shared'
    }
    if (nav.share) {
      await nav.share({ text, title: 'Split The G' })
      return 'text-only'
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'split-the-g.jpg'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    return 'downloaded'
  }
}
