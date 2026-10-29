import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, LinkButton, Notice } from '../components/ui'
import { saveAttempt } from '../data/local'
import { uploadAttempts } from '../data/supabase'
import { useAuth } from '../data/AuthContext'
import type { GlassType } from '../data/types'
import { TIER_COLOR, type ScoreResult } from '../engine/score'
import { renderShareCard, shareResult, type ShareOutcome } from '../share/shareCard'
import { challengeText, clearChallenge, loadChallenge, smsHref } from '../share/challenge'
import { Cheers } from '../components/icons'

export interface PendingResult {
  id: string
  createdAt: string
  result: ScoreResult
  glassType: GlassType
  snapshotUrl: string | null
}

const savedIds = new Set<string>()

export function Result() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const pending = state as PendingResult | null
  const { session, profile } = useAuth()
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
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

  if (!pending) return null
  const { result } = pending
  const color = TIER_COLOR[result.tier]
  const textHref = smsHref(challengeText(result, profile?.username ?? undefined))
  const verdict =
    challenge &&
    (result.score > challenge.score
      ? `You beat ${challenge.from ? `@${challenge.from}` : 'their'} ${challenge.score}. Send it back.`
      : result.score === challenge.score
        ? `Dead heat with ${challenge.from ? `@${challenge.from}` : 'them'} at ${challenge.score}.`
        : `${challenge.from ? `@${challenge.from}` : 'They'} still lead${challenge.from ? 's' : ''} with ${challenge.score}. Another pint?`)

  async function share() {
    setSharing(true)
    setShareMsg(null)
    try {
      cardBlob.current ??= await renderShareCard(pending!.snapshotUrl, result, new Date(pending!.createdAt))
      const outcome: ShareOutcome = await shareResult(cardBlob.current, result)
      setShareMsg(
        outcome === 'shared'
          ? 'Shared!'
          : outcome === 'copied'
            ? 'Sharing is not available here, so the result text was copied to your clipboard.'
            : outcome === 'downloaded'
              ? 'Share card downloaded.'
              : null,
      )
    } catch (e) {
      setShareMsg((e as Error).message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      <div className="text-center">
        <div className="font-serif leading-none" style={{ color, fontSize: 96 }}>
          {result.score}
        </div>
        <div className="font-serif text-2xl text-cream mt-1">{result.title}</div>
        <div className="text-cream/60 text-sm mt-1">{result.detail}</div>
      </div>

      {pending.snapshotUrl && (
        <img src={pending.snapshotUrl} alt="Your attempt" className="w-full rounded-lg border-2 border-gold/50" />
      )}

      {verdict && <p className="text-center text-sm text-gold">{verdict}</p>}

      <a href={textHref} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold text-ink border border-gold font-display uppercase tracking-wide text-base px-5 py-3 active:scale-[0.98]">
        <Cheers size={22} />
        Text a friend to beat it
      </a>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={share} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share card'}
        </Button>
        <LinkButton to="/score" variant="secondary" className="flex-1">
          Try again
        </LinkButton>
      </div>
      {shareMsg && <Notice tone="ok">{shareMsg}</Notice>}
      <p className="text-center text-xs text-cream/40">
        Saved to your history{session ? ' and synced' : ''}. <LinkButton to="/history" variant="ghost" size="sm">View history</LinkButton>
      </p>
    </div>
  )
}
