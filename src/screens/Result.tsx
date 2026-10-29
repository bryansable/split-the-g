import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, LinkButton, Notice } from '../components/ui'
import { saveAttempt } from '../data/local'
import { uploadAttempts } from '../data/supabase'
import { useAuth } from '../data/AuthContext'
import type { GlassType } from '../data/types'
import { TIER_COLOR, type ScoreResult } from '../engine/score'
import { renderShareCard, shareResult, type ShareOutcome } from '../share/shareCard'

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
  const { session } = useAuth()
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const cardBlob = useRef<Blob | null>(null)

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
    <div className="p-4 pb-8 space-y-4">
      <div className="text-center">
        <div className="font-serif leading-none" style={{ color, fontSize: 96 }}>
          {result.score}
        </div>
        <div className="font-serif text-2xl text-cream mt-1">{result.title}</div>
        <div className="text-cream/60 text-sm mt-1">{result.detail}</div>
      </div>

      {pending.snapshotUrl && (
        <img src={pending.snapshotUrl} alt="Your attempt" className="w-full rounded-2xl border border-white/10" />
      )}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={share} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share'}
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
