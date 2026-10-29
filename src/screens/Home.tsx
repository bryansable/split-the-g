import { useEffect, useState } from 'react'
import { Pint, Rule } from '../components/icons'
import { Card, LinkButton, Notice, SectionLabel, Stat } from '../components/ui'
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
      {/* pub sign */}
      <div className="relative mx-auto max-w-sm rounded-lg border-2 border-gold/70 bg-stout px-6 pt-6 pb-5 text-center shadow-[0_0_0_4px_#241710,0_0_0_5px_rgba(201,164,71,.35)]">
        <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Est. for the first sip</div>
        <div className="font-display text-5xl leading-[1.05] text-cream mt-2 tracking-wide">
          Split
          <br />
          The <span className="inline-block border-[3px] border-gold text-gold rounded-full px-3 leading-none py-1">G</span>
        </div>
        <Rule className="my-3" />
        <p className="text-cream/70 text-sm tracking-wide">Pour. Sip. Land the line on the G.</p>
      </div>

      <LinkButton to="/score" size="lg" className="w-full">
        <Pint size={22} />
        Score a pint
      </LinkButton>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Today" value={bestToday ?? '–'} />
        <Stat label="Best" value={stats.count ? stats.best : '–'} />
        <Stat label="Splits" value={stats.splits} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-gold tracking-wider uppercase text-sm">Today's G-off</div>
            <div className="text-cream/65 text-xs mt-1">
              {!cloudEnabled
                ? 'Local mode: compete against yourself.'
                : session
                  ? 'Best score of the day wins. Resets at midnight.'
                  : 'Sign in to compete with friends.'}
            </div>
          </div>
          <LinkButton to="/contest" variant="secondary" size="sm">
            Board
          </LinkButton>
        </div>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <SectionLabel>Last orders</SectionLabel>
          <div className="flex gap-2">
            {attempts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex-1 rounded-md bg-stout border border-gold/15 py-2 text-center font-display text-xl" style={{ color: TIER_COLOR[tierFor(a.score)] }}>
                {a.score}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showInstall && (
        <Notice>
          <b className="text-gold">Add to your home screen</b> for the full-screen pub: iPhone: Share, then Add to Home Screen. Android: menu, then Install
          app.
        </Notice>
      )}

      <Card className="text-xs text-cream/60 leading-relaxed">
        <b className="text-gold">House rules.</b> Point the camera at your glass and the app finds it. One sip, then capture: the line is read at the front
        of the glass and compared with where the G sits on a classic pint. Any glass works, a ghost G shows the target. Independent fan project, not
        affiliated with any brewery.
      </Card>
    </div>
  )
}
