import type { ScoreResult } from '../engine/score'
import { TIER_COLOR } from '../engine/score'

export const APP_URL = 'https://bryansable.github.io/split-the-g/'

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

/**
 * Build a 1080x1350 share card: snapshot on top, score and copy below.
 */
export async function renderShareCard(snapshotUrl: string | null, result: ScoreResult, when: Date): Promise<Blob> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  const pad = 60
  const imgBox = { x: pad, y: pad, w: W - pad * 2, h: 760 }
  if (snapshotUrl) {
    const img = await loadImage(snapshotUrl)
    const scale = Math.max(imgBox.w / img.width, imgBox.h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.save()
    roundRect(ctx, imgBox.x, imgBox.y, imgBox.w, imgBox.h, 36)
    ctx.clip()
    ctx.drawImage(img, imgBox.x + (imgBox.w - dw) / 2, imgBox.y + (imgBox.h - dh) / 2, dw, dh)
    ctx.restore()
  } else {
    ctx.fillStyle = '#1a1a1a'
    roundRect(ctx, imgBox.x, imgBox.y, imgBox.w, imgBox.h, 36)
    ctx.fill()
  }

  const color = TIER_COLOR[result.tier]
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.font = 'bold 220px Georgia, serif'
  ctx.fillText(String(result.score), pad, imgBox.y + imgBox.h + 250)

  ctx.fillStyle = '#f5e6c8'
  ctx.font = 'bold 64px Georgia, serif'
  ctx.fillText(result.title, pad + 330, imgBox.y + imgBox.h + 170)
  ctx.font = '36px system-ui, sans-serif'
  ctx.fillStyle = '#c9bda6'
  ctx.fillText(result.detail, pad + 330, imgBox.y + imgBox.h + 230)

  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.fillStyle = '#f5e6c8'
  ctx.fillText('SPLIT THE G', pad, H - 110)
  ctx.font = '30px system-ui, sans-serif'
  ctx.fillStyle = '#8a8070'
  ctx.fillText(`${when.toLocaleDateString()}  ·  ${APP_URL.replace('https://', '')}`, pad, H - 60)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
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

export function shareText(result: ScoreResult): string {
  const emoji = result.tier === 'split' ? '🍺🎯' : '🍺'
  return `I scored ${result.score}/100 on Split The G ${emoji} ${result.title}. Think you can beat it? ${APP_URL}`
}

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'failed'

/**
 * Native share with the image when possible, otherwise share text, otherwise
 * copy text to the clipboard, otherwise trigger a download of the card.
 */
export async function shareResult(blob: Blob, result: ScoreResult): Promise<ShareOutcome> {
  const text = shareText(result)
  const file = new File([blob], 'split-the-g.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text, title: 'Split The G' })
      return 'shared'
    }
    if (nav.share) {
      await nav.share({ text, title: 'Split The G', url: APP_URL })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'split-the-g.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    return 'downloaded'
  }
}
