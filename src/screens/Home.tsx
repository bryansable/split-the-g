import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pint, Rule } from '../components/icons'
import { LinkButton } from '../components/ui'
import { computeStats, dayKey, useAttempts } from '../data/local'
import { useAuth } from '../data/AuthContext'
import { TIER_COLOR, tierFor } from '../engine/score'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 text-center">
      <div className="font-display text-3xl text-cream leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gold/80">{label}</div>
    </div>
  )
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
  const contestLine = !cloudEnabled
    ? 'Local mode. Compete against yourself.'
    : session
      ? 'Best score of the day wins. Resets at midnight.'
      : 'Sign in to compete with friends.'

  return (
    <div className="px-5 pb-8">
      {/* the one framed element: the pub sign */}
      <div className="mx-auto mt-5 max-w-sm rounded-lg border-2 border-gold/70 bg-stout px-6 pt-5 pb-4 text-center shadow-[0_0_0_4px_#241710,0_0_0_5px_rgba(201,164,71,.35)]">
        <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Est. for the first sip</div>
        <div className="font-display text-5xl leading-[1.05] text-cream mt-2 tracking-wide">
          Split
          <br />
          The <span className="inline-block border-[3px] border-gold text-gold rounded-full px-3 leading-none py-1">G</span>
        </div>
        <Rule className="my-3" />
        <p className="text-cream/70 text-sm tracking-wide">Pour. Sip. Land the line on the G.</p>
      </div>

      <LinkButton to="/score" size="lg" className="w-full mt-5">
        <Pint size={22} />
        Score a pint
      </LinkButton>

      {/* figures: plain numbers, hairline dividers */}
      <div className="mt-7 flex items-stretch divide-x divide-gold/20">
        <Figure label="Today" value={bestToday ?? '–'} />
        <Figure label="Best" value={stats.count ? stats.best : '–'} />
        <Figure label="Splits" value={stats.splits} />
      </div>

      <hr className="mt-7 border-0 border-t border-gold/20" />

      {/* contest: one row */}
      <Link to="/contest" className="flex items-center justify-between gap-4 py-4">
        <div>
          <div className="font-display text-gold tracking-wider uppercase text-sm">Today's G-off</div>
          <div className="text-cream/60 text-xs mt-0.5">{contestLine}</div>
        </div>
        <span className="font-display text-gold text-xl" aria-hidden>
          ›
        </span>
      </Link>

      {attempts.length > 0 && (
        <>
          <hr className="border-0 border-t border-gold/20" />
          <Link to="/history" className="flex items-center justify-between gap-4 py-4">
            <div>
              <div className="font-display text-gold tracking-wider uppercase text-sm">Last orders</div>
              <div className="mt-1 flex gap-3 font-display text-xl">
                {attempts.slice(0, 5).map((a) => (
                  <span key={a.id} style={{ color: TIER_COLOR[tierFor(a.score)] }}>
                    {a.score}
                  </span>
                ))}
              </div>
            </div>
            <span className="font-display text-gold text-xl" aria-hidden>
              ›
            </span>
          </Link>
        </>
      )}

      <hr className="border-0 border-t border-gold/20" />

      <div className="py-4 text-xs leading-relaxed text-cream/55">
        <span className="text-gold">House rules.</span> Point the camera at your glass and the app finds it. One sip, then capture: the line is read at
        the front of the glass and compared with where the G sits on a classic pint. Any glass works, a ghost G shows the target.
        {showInstall && (
          <>
            {' '}
            <span className="text-gold">Add to your home screen</span> for the full-screen pub: iPhone, Share then Add to Home Screen; Android, menu
            then Install app.
          </>
        )}
      </div>
      <p className="text-[10px] text-cream/35 text-center">Independent fan project. Not affiliated with any brewery.</p>
    </div>
  )
}
