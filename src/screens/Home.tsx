import { useEffect, useState } from 'react'
import { Card, LinkButton, Notice, Stat } from '../components/ui'
import { computeStats, dayKey, useAttempts } from '../data/local'
import { useAuth } from '../data/AuthContext'
import { TIER_COLOR, tierFor } from '../engine/score'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function Home() {
  const attempts = useAttempts()
  const stats = computeStats(attempts)
  const { session, cloudEnabled } = useAuth()
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    setShowInstall(!isStandalone() && /iPhone|iPad|Android/i.test(navigator.userAgent))
  }, [])

  const today = dayKey(new Date().toISOString())
  const todays = attempts.filter((a) => dayKey(a.createdAt) === today)
  const bestToday = todays.length ? Math.max(...todays.map((a) => a.score)) : null

  return (
    <div className="p-4 space-y-4">
      <div className="text-center pt-6 pb-2">
        <div className="font-serif text-6xl text-cream leading-none">
          Split
          <br />
          The <span className="inline-block border-4 border-cream rounded-full px-3">G</span>
        </div>
        <p className="text-cream/60 mt-3 text-sm">One sip. Land the line on the G. Get scored.</p>
      </div>

      <LinkButton to="/score" size="lg" className="w-full">
        Score a pint
      </LinkButton>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Today" value={bestToday ?? '–'} />
        <Stat label="Best" value={stats.count ? stats.best : '–'} />
        <Stat label="Splits" value={stats.splits} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-cream font-semibold">Today's contest</div>
            <div className="text-cream/60 text-xs">
              {!cloudEnabled
                ? 'Local mode: compete against yourself.'
                : session
                  ? 'Best score of the day wins. Resets at midnight.'
                  : 'Sign in to compete with friends.'}
            </div>
          </div>
          <LinkButton to="/contest" variant="secondary" size="sm">
            Leaderboard
          </LinkButton>
        </div>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <div className="text-cream/60 text-xs uppercase tracking-wider mb-2">Recent</div>
          <div className="flex gap-2">
            {attempts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex-1 rounded-lg bg-white/5 py-2 text-center font-serif text-xl" style={{ color: TIER_COLOR[tierFor(a.score)] }}>
                {a.score}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showInstall && (
        <Notice>
          <b>Add to your home screen</b> for the full-screen experience: iPhone: Share → Add to Home Screen. Android: menu → Install app.
        </Notice>
      )}

      <Card className="text-xs text-cream/50 leading-relaxed">
        <b className="text-cream/70">How it works.</b> Line up the RIM and BASE guides with your glass. The app finds the beer line and compares it to
        where the G sits on a classic pint glass. Works with any glass: a ghost G shows you the target. Independent fan project, not affiliated with
        any brewery.
      </Card>
    </div>
  )
}
