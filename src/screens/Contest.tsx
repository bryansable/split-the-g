import { useEffect, useState } from 'react'
import { Card, LinkButton, Notice, PageTitle } from '../components/ui'
import { useAuth } from '../data/AuthContext'
import { dayKey, useAttempts } from '../data/local'
import { fetchLeaderboard, listFriendships } from '../data/supabase'
import type { LeaderboardRow } from '../data/types'
import { TIER_COLOR, tierFor } from '../engine/score'

function dayRange(offsetDays = 0) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + offsetDays)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function useCountdown() {
  const [left, setLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const { end } = dayRange()
      const ms = end.getTime() - Date.now()
      const h = Math.floor(ms / 3.6e6)
      const m = Math.floor((ms % 3.6e6) / 6e4)
      setLeft(`${h}h ${String(m).padStart(2, '0')}m`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return left
}

export function Contest() {
  const { cloudEnabled, session, profile } = useAuth()
  const attempts = useAttempts()
  const countdown = useCountdown()
  const [today, setToday] = useState<LeaderboardRow[] | null>(null)
  const [yesterday, setYesterday] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const myId = session?.user.id

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    ;(async () => {
      try {
        const friends = (await listFriendships(myId)).filter((f) => f.status === 'accepted').map((f) => (f.requesterId === myId ? f.addresseeId : f.requesterId))
        const t = dayRange()
        const y = dayRange(-1)
        const [a, b] = await Promise.all([fetchLeaderboard(myId, friends, t.start, t.end), fetchLeaderboard(myId, friends, y.start, y.end)])
        if (!cancelled) {
          setToday(a)
          setYesterday(b)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [myId, attempts.length])

  const todayKey = dayKey(new Date().toISOString())
  const mine = attempts.filter((a) => dayKey(a.createdAt) === todayKey)
  const myBest = mine.length ? Math.max(...mine.map((a) => a.score)) : null

  return (
    <div className="p-4 space-y-4">
      <PageTitle sub={`Best score of the day wins. Resets in ${countdown}.`}>Today's G-off</PageTitle>

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em]">Your best today</div>
          <div className="font-serif text-4xl" style={{ color: myBest === null ? '#f5e6c8' : TIER_COLOR[tierFor(myBest)] }}>
            {myBest ?? '–'}
          </div>
          <div className="text-cream/50 text-xs">{mine.length} attempt{mine.length === 1 ? '' : 's'}</div>
        </div>
        <LinkButton to="/score">Score a pint</LinkButton>
      </Card>

      {!cloudEnabled ? (
        <Notice tone="warn">Friend leaderboards need the cloud backend. This build is local-only.</Notice>
      ) : !session ? (
        <Card className="text-center space-y-3">
          <p className="text-cream/70">Sign in to see where you rank against your friends.</p>
          <LinkButton to="/profile">Sign in</LinkButton>
        </Card>
      ) : (
        <>
          {error && <Notice tone="warn">{error}</Notice>}
          <Card>
            <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em] mb-2">Leaderboard</div>
            {today === null ? (
              <p className="text-cream/50 text-sm">Loading…</p>
            ) : today.length === 0 ? (
              <p className="text-cream/50 text-sm">
                Nobody has scored yet today. {profile?.username ? '' : 'Pick a username in your profile. '}
                <LinkButton to="/friends" variant="ghost" size="sm">
                  Add friends
                </LinkButton>
              </p>
            ) : (
              <ol className="space-y-1">
                {today.map((r, i) => (
                  <li key={r.userId} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${r.isMe ? 'bg-white/10' : ''}`}>
                    <span className="w-6 text-cream/50 text-sm">{i === 0 ? '🏆' : i + 1}</span>
                    <span className="flex-1 text-cream">@{r.username}{r.isMe ? ' (you)' : ''}</span>
                    <span className="text-cream/40 text-xs">{r.attempts}×</span>
                    <span className="font-serif text-2xl w-12 text-right" style={{ color: TIER_COLOR[tierFor(r.best)] }}>
                      {r.best}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {yesterday && yesterday.length > 0 && (
            <Card className="text-sm text-cream/70">
              Yesterday's winner: <b className="text-cream">@{yesterday[0].username}</b> with {yesterday[0].best}.
            </Card>
          )}
        </>
      )}
    </div>
  )
}
