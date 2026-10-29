import { useEffect, useState } from 'react'
import { Figure, Hr, LinkButton, Notice, Page, PageTitle, SectionLabel } from '../components/ui'
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
    <Page>
      <PageTitle sub={`Best score of the day wins. Resets in ${countdown}.`}>Today's G-off</PageTitle>

      <div className="mt-2 flex items-center">
        <div className="flex-1 flex divide-x divide-gold/20">
          <Figure
            label="Your best today"
            value={<span style={{ color: myBest === null ? undefined : TIER_COLOR[tierFor(myBest)] }}>{myBest ?? '–'}</span>}
          />
          <Figure label={mine.length === 1 ? 'attempt' : 'attempts'} value={mine.length} />
        </div>
        <LinkButton to="/score" size="sm" className="ml-4">
          Score
        </LinkButton>
      </div>

      <Hr className="mt-6" />

      {!cloudEnabled ? null : !session ? (
        <div className="py-6 text-center">
          <p className="text-cream/60 mb-4">Sign in to see where you rank against your friends.</p>
          <LinkButton to="/profile">Sign in</LinkButton>
        </div>
      ) : (
        <>
          {error && (
            <div className="pt-4">
              <Notice tone="warn">{error}</Notice>
            </div>
          )}
          <div className="pt-4">
            <SectionLabel>Leaderboard</SectionLabel>
          </div>
          {today === null ? (
            <p className="text-cream/50 text-sm py-2">Loading…</p>
          ) : today.length === 0 ? (
            <p className="text-cream/50 text-sm py-2">
              Nobody has scored yet today. {profile?.username ? '' : 'Pick a username in your profile. '}
              <LinkButton to="/friends" variant="ghost" size="sm">
                Add friends
              </LinkButton>
            </p>
          ) : (
            <ol className="divide-y divide-gold/15">
              {today.map((r, i) => (
                <li key={r.userId} className={`flex items-center gap-4 py-2.5 ${r.isMe ? 'text-gold' : 'text-cream'}`}>
                  <span className="w-6 font-display text-cream/50 text-sm">{i + 1}</span>
                  <span className="flex-1">
                    @{r.username}
                    {r.isMe ? ' (you)' : ''}
                  </span>
                  <span className="text-cream/40 text-xs">{r.attempts}×</span>
                  <span className="font-display text-2xl w-12 text-right leading-none" style={{ color: TIER_COLOR[tierFor(r.best)] }}>
                    {r.best}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {yesterday && yesterday.length > 0 && (
            <>
              <Hr className="mt-4" />
              <p className="py-4 text-sm text-cream/60">
                Yesterday's winner: <span className="text-gold">@{yesterday[0].username}</span> with {yesterday[0].best}.
              </p>
            </>
          )}
        </>
      )}
    </Page>
  )
}
