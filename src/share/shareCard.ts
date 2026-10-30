import type { ScoreResult, Tier } from '../engine/score'
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

/** What a card says. A result card also has the photo; History and the G-off share without one. */
export interface CardContent {
  score: number
  tier: Tier
  /** Under the score, e.g. "Split the G!" */
  title: string
  /** Small line above the headline, e.g. "4 mm too low" or "My best so far" */
  detail: string
  /** Big line near the bottom. */
  headline?: string
}

export function resultCard(result: ScoreResult): CardContent {
  return { score: result.score, tier: result.tier, title: result.title, detail: result.detail }
}

/**
 * 1080x1920 share card, shaped for Instagram and Snapchat Stories (and fine
 * in a chat): full-bleed photo, a score stamp near the top and the challenge
 * near the bottom. Text stays out of the top 260 px and bottom 300 px, where
 * the story apps draw their own bars. `crop` (snapshot pixels) narrows the
 * shot to the glass.
 */
export async function renderShareCard(
  snapshotUrl: string | null,
  content: CardContent,
  when: Date,
  crop: Crop | null = null,
): Promise<Blob> {
  const W = 1080
  const H = 1920
  const SAFE_TOP = 260
  const SAFE_BOTTOM = H - 300
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

  if (snapshotUrl) {
    // Photo, cover-fit to the whole card.
    const img = await loadImage(snapshotUrl)
    const sx = crop ? crop.x : 0
    const sy = crop ? crop.y : 0
    const sw = crop ? crop.w : img.width
    const sh = crop ? crop.h : img.height
    const scale = Math.max(W / sw, H / sh)
    const dw = sw * scale
    const dh = sh * scale
    ctx.drawImage(img, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh)
  } else {
    // No photo: a warm glow behind a large ringed G.
    const glow = ctx.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, 760)
    glow.addColorStop(0, p.wood)
    glow.addColorStop(1, p.ink)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.strokeStyle = p.gold
    ctx.lineWidth = 18
    ctx.beginPath()
    ctx.ellipse(W / 2, H * 0.5, 330, 380, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = p.gold
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 560px ${display}`
    ctx.fillText('G', W / 2, H * 0.52)
    ctx.restore()
  }

  // Legibility gradients top and bottom.
  const top = ctx.createLinearGradient(0, 0, 0, 760)
  top.addColorStop(0, 'rgba(0,0,0,0.6)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 760)
  const bottom = ctx.createLinearGradient(0, H - 900, 0, H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(0.45, 'rgba(0,0,0,0.7)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.9)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, H - 900, W, 900)

  // Thin frame.
  ctx.strokeStyle = p.gold
  ctx.lineWidth = 6
  ctx.strokeRect(22, 22, W - 44, H - 44)

  // Score stamp, centred under the story bar, like a chalkboard hung on the wall.
  const color = TIER_COLOR[content.tier]
  const stamp = { x: (W - 420) / 2, y: SAFE_TOP, w: 420, h: 340 }
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
  ctx.lineWidth = 1.5
  roundRect(ctx, stamp.x + 12, stamp.y + 12, stamp.w - 24, stamp.h - 24, 20)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = p.gold
  ctx.font = `600 26px ${display}`
  ctx.fillText('S P L I T   T H E   G', W / 2, stamp.y + 66)
  ctx.fillStyle = color
  ctx.font = `bold 190px ${display}`
  ctx.fillText(String(content.score), W / 2, stamp.y + 250)
  ctx.fillStyle = p.cream
  ctx.font = `bold 32px ${display}`
  ctx.fillText(content.title.toUpperCase(), W / 2, stamp.y + 308)

  // Bottom block, centred: detail, challenge, and the address as a pill.
  ctx.fillStyle = p.cream
  ctx.font = '42px system-ui, sans-serif'
  ctx.fillText(content.detail, W / 2, SAFE_BOTTOM - 290)
  ctx.fillStyle = p.gold
  ctx.font = `bold 84px ${display}`
  ctx.fillText(content.headline ?? 'Can you beat it?', W / 2, SAFE_BOTTOM - 180)
  const site = APP_URL.replace('https://', '').replace(/\/$/, '')
  ctx.font = `bold 44px ${display}`
  const pillW = ctx.measureText(site).width + 96
  ctx.fillStyle = p.gold
  roundRect(ctx, (W - pillW) / 2, SAFE_BOTTOM - 120, pillW, 84, 42)
  ctx.fill()
  ctx.fillStyle = p.ink
  ctx.fillText(site, W / 2, SAFE_BOTTOM - 63)
  ctx.fillStyle = p.muted
  ctx.font = '30px system-ui, sans-serif'
  ctx.fillText(when.toLocaleDateString(), W / 2, SAFE_BOTTOM + 10)

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
    saveImage(blob)
    return 'downloaded'
  }
}

/** Save the card to the device (downloads on desktop and Android, the Files app on iPhone). */
export function saveImage(blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'split-the-g.jpg'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
