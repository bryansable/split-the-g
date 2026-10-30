import { useEffect, useState } from 'react'
import { Cheers } from '../components/icons'
import { Button, Notice } from '../components/ui'
import { smsHref, whatsappHref } from './challenge'
import { renderShareCard, saveImage, shareResult, type CardContent, type Crop } from './shareCard'

/**
 * Renders a share card ahead of time. The share sheet has to open straight
 * from the tap (iPhone refuses it after a slow await), so the image must be
 * ready before the button is pressed.
 */
export function useShareCard(snapshotUrl: string | null, content: CardContent | null, when: string, crop: Crop | null = null) {
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const key = content && JSON.stringify([snapshotUrl, content, when, crop])

  useEffect(() => {
    if (!content) return
    let cancelled = false
    renderShareCard(snapshotUrl, content, new Date(when), crop)
      .then((blob) => {
        if (cancelled) return
        setCard((old) => {
          if (old) URL.revokeObjectURL(old.url)
          return { blob, url: URL.createObjectURL(blob) }
        })
      })
      .catch((e) => console.warn('card render failed', e))
    return () => {
      cancelled = true
    }
    // key covers every input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return card
}

const isPhone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

/**
 * The share controls: one big button for the phone's share sheet (Stories,
 * chats, anything installed), then direct Messages and WhatsApp links, copy
 * link and save image. Stories drop any text, so after a share the link is one
 * tap away for a link sticker.
 */
export function ShareBar({ card, text, link, label = 'Share your pint' }: { card: Blob | null; text: string; link: string; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  async function share() {
    if (!card) return
    setSharing(true)
    setMsg(null)
    try {
      const outcome = await shareResult(card, text)
      setMsg(
        outcome === 'shared'
          ? 'Posted to a story? Tap Copy link, then add a Link sticker so friends can take you on.'
          : outcome === 'text-only'
            ? 'This browser cannot share photos, so the score and link were shared as text. Use Save image for the card.'
            : outcome === 'copied'
              ? 'Sharing is not available here, so the score and link were copied. Use Save image for the card.'
              : outcome === 'downloaded'
                ? 'Card saved to your downloads.'
                : null,
      )
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSharing(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setMsg('Link copied. In your story, add a Link sticker and paste it.')
    } catch {
      setMsg(link)
    }
  }

  function save() {
    if (!card) return
    saveImage(card)
    setMsg('Card saved. Post it from your photos or files to any story.')
  }

  const chip = 'flex-1 rounded-md border border-gold/40 py-2 text-center text-xs font-display uppercase tracking-wide text-cream/85 hover:border-gold hover:text-gold'

  return (
    <div className="space-y-2.5">
      <Button size="lg" className="w-full" onClick={share} disabled={sharing || !card}>
        <Cheers size={22} />
        {sharing ? 'Opening…' : label}
      </Button>
      <div className="flex gap-2">
        {isPhone && (
          <a href={smsHref(text)} className={chip}>
            Messages
          </a>
        )}
        <a href={whatsappHref(text)} target="_blank" rel="noopener" className={chip}>
          WhatsApp
        </a>
        <button onClick={copyLink} className={chip}>
          Copy link
        </button>
        <button onClick={save} disabled={!card} className={chip}>
          Save image
        </button>
      </div>
      {msg && <Notice tone="ok">{msg}</Notice>}
    </div>
  )
}
