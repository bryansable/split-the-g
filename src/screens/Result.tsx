import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdSlot } from '../ads/AdSlot'
import { LinkButton } from '../components/ui'
import { saveAttempt } from '../data/local'
import { uploadAttempts } from '../data/supabase'
import { useAuth } from '../data/AuthContext'
import type { GlassType } from '../data/types'
import { TIER_COLOR, type ScoreResult } from '../engine/score'
import { challengeText, challengeUrl, clearChallenge, loadChallenge } from '../share/challenge'
import { ShareBar, useShareCard } from '../share/ShareBar'
import { resultCard, type Crop } from '../share/shareCard'

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
  const [framing, setFraming] = useState<Framing>('scene')
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

  // The card that will be shared, also shown as the preview.
  const card = useShareCard(
    pending?.snapshotUrl ?? null,
    pending ? resultCard(pending.result) : null,
    pending?.createdAt ?? '',
    framing === 'glass' ? (pending?.glassCrop ?? null) : null,
  )

  if (!pending) return null
  const { result } = pending
  const color = TIER_COLOR[result.tier]
  const from = profile?.username ?? undefined
  const text = challengeText(result, from)
  const verdict =
    challenge &&
    (result.score > challenge.score
      ? `You beat ${challenge.from ? `@${challenge.from}` : 'their'} ${challenge.score}. Send it back.`
      : result.score === challenge.score
        ? `Dead heat with ${challenge.from ? `@${challenge.from}` : 'them'} at ${challenge.score}.`
        : `${challenge.from ? `@${challenge.from}` : 'They'} still lead${challenge.from ? 's' : ''} with ${challenge.score}. Another pint?`)

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
      <div className="mx-auto w-full max-w-[15rem]">
        {card ? (
          <img src={card.url} alt="Your share card" className="w-full rounded-lg border-2 border-gold/50" />
        ) : (
          <div className="aspect-[9/16] w-full rounded-lg border-2 border-gold/30 bg-stout" />
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

      <ShareBar card={card?.blob ?? null} text={text} link={challengeUrl(result.score, from)} />
      <div className="text-center">
        <LinkButton to="/score" variant="ghost" size="sm">
          Try again
        </LinkButton>
      </div>
      <AdSlot slot="result" />
      <p className="text-center text-xs text-cream/40">
        Saved to your history{session ? ' and synced' : ''}. <LinkButton to="/history" variant="ghost" size="sm">View history</LinkButton>
      </p>
    </div>
  )
}
