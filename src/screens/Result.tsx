import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdSlot } from '../ads/AdSlot'
import { Cheers } from '../components/icons'
import { Button, LinkButton, Notice } from '../components/ui'
import { saveAttempt } from '../data/local'
import { uploadAttempts } from '../data/supabase'
import { useAuth } from '../data/AuthContext'
import type { GlassType } from '../data/types'
import { TIER_COLOR, type ScoreResult } from '../engine/score'
import { challengeText, clearChallenge, loadChallenge, smsHref } from '../share/challenge'
import { canShareFiles, renderShareCard, shareResult, type Crop, type ShareOutcome } from '../share/shareCard'

export interface PendingResult {
  id: string
  createdAt: string
  result: ScoreResult
  glassType: GlassType
  snapshotUrl: string | null
  /** Crop around the glass in snapshot pixels, when the glass was auto-framed. */
  glassCrop?: Crop
}

type Framing = 'scene' | 'glass'

const savedIds = new Set<string>()

export function Result() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const pending = state as PendingResult | null
  const { session, profile } = useAuth()
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [framing, setFraming] = useState<Framing>('scene')
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const cardBlob = useRef<Blob | null>(null)
  // A challenge this attempt was answering, if the user arrived via a texted link.
  const [challenge] = useState(() => loadChallenge())
  useEffect(() => {
    if (challenge) clearChallenge()
  }, [challenge])

  useEffect(() => {
    if (!pending) {
      navigate('/score', { replace: true })
      return
    }
    if (savedIds.has(pending.id)) return
    savedIds.add(pending.id)
    const attempt = {
      id: pending.id,
      score: pending.result.score,
      offsetPct: Math.round(pending.result.offsetPct * 100) / 100,
      glassType: pending.glassType,
      createdAt: pending.createdAt,
    }
    saveAttempt(attempt)
    if (session) {
      uploadAttempts(session.user.id, [attempt])
        .then(() => saveAttempt({ ...attempt, synced: true, userId: session.user.id }))
        .catch((e) => console.warn('upload failed, will retry on next sign-in', e))
    }
  }, [pending, navigate, session])

  // Render the card that will be shared, and show it as the preview.
  useEffect(() => {
    if (!pending) return
    let cancelled = false
    const crop = framing === 'glass' && pending.glassCrop ? pending.glassCrop : null
    renderShareCard(pending.snapshotUrl, pending.result, new Date(pending.createdAt), crop)
      .then((blob) => {
        if (cancelled) return
        cardBlob.current = blob
        setCardUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
      })
      .catch((e) => console.warn('card render failed', e))
    return () => {
      cancelled = true
    }
  }, [pending, framing])

  if (!pending) return null
  const { result } = pending
  const color = TIER_COLOR[result.tier]
  const text = challengeText(result, profile?.username ?? undefined)
  const textHref = smsHref(text)
  const verdict =
    challenge &&
    (result.score > challenge.score
      ? `You beat ${challenge.from ? `@${challenge.from}` : 'their'} ${challenge.score}. Send it back.`
      : result.score === challenge.score
        ? `Dead heat with ${challenge.from ? `@${challenge.from}` : 'them'} at ${challenge.score}.`
        : `${challenge.from ? `@${challenge.from}` : 'They'} still lead${challenge.from ? 's' : ''} with ${challenge.score}. Another pint?`)

  async function share() {
    if (!cardBlob.current) return
    setSharing(true)
    setShareMsg(null)
    try {
      const outcome: ShareOutcome = await shareResult(cardBlob.current, text)
      setShareMsg(
        outcome === 'shared'
          ? 'Shared.'
          : outcome === 'text-only'
            ? 'This browser cannot share photos, so the score and link were shared as text.'
            : outcome === 'copied'
              ? 'Sharing is not available here. The score and link were copied; the card was saved to your downloads.'
              : outcome === 'downloaded'
                ? 'Card saved to your downloads.'
                : null,
      )
    } catch (e) {
      setShareMsg((e as Error).message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="px-5 pt-5 pb-8 space-y-4">
      <div className="text-center">
        <div className="font-display leading-none" style={{ color, fontSize: 84 }}>
          {result.score}
        </div>
        <div className="font-display text-xl text-cream mt-1">{result.title}</div>
        <div className="text-cream/60 text-sm mt-1">{result.detail}</div>
      </div>

      {verdict && <p className="text-center text-sm text-gold">{verdict}</p>}

      {/* the card exactly as it will be shared */}
      <div className="mx-auto w-full max-w-xs">
        {cardUrl ? (
          <img src={cardUrl} alt="Your attempt" className="w-full rounded-lg border-2 border-gold/50" />
        ) : (
          <div className="aspect-[4/5] w-full rounded-lg border-2 border-gold/30 bg-stout" />
        )}
      </div>

      {pending.glassCrop && (
        <div className="mx-auto flex w-fit rounded-full border border-gold/40 p-0.5 text-xs">
          {(['scene', 'glass'] as Framing[]).map((f) => (
            <button
              key={f}
              className={`px-4 py-1.5 rounded-full font-display uppercase tracking-wide ${framing === f ? 'bg-gold text-ink' : 'text-cream/70'}`}
              onClick={() => setFraming(f)}
            >
              {f === 'scene' ? 'Whole scene' : 'Glass only'}
            </button>
          ))}
        </div>
      )}

      <Button size="lg" className="w-full" onClick={share} disabled={sharing || !cardUrl}>
        <Cheers size={22} />
        {sharing ? 'Opening…' : 'Share your pint'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        {canShareFiles() ? (
          <a href={textHref} className="text-gold underline-offset-4 hover:underline">
            Text without the photo
          </a>
        ) : (
          <a href={textHref} className="text-gold underline-offset-4 hover:underline">
            Text a friend
          </a>
        )}
        <LinkButton to="/score" variant="ghost" size="sm">
          Try again
        </LinkButton>
      </div>
      {shareMsg && <Notice tone="ok">{shareMsg}</Notice>}
      <AdSlot slot="result" />
      <p className="text-center text-xs text-cream/40">
        Saved to your history{session ? ' and synced' : ''}. <LinkButton to="/history" variant="ghost" size="sm">View history</LinkButton>
      </p>
    </div>
  )
}
