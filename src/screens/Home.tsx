import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdSlot } from '../ads/AdSlot'
import { Bubbles } from '../components/Bubbles'
import { Pint, Rule } from '../components/icons'
import { Figure, Hr, LinkButton } from '../components/ui'
import { computeStats, dayKey, useAttempts } from '../data/local'
import { useAuth } from '../data/AuthContext'
import { MODE_COPY, setMode, useMode } from '../data/mode'
import { TIER_COLOR, tierFor } from '../engine/score'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** Everything fits one phone screen: the layout stretches between the sign and the footer line. */
export function Home() {
  const attempts = useAttempts()
  const stats = computeStats(attempts)
  const { session, cloudEnabled } = useAuth()
  const mode = useMode()
  const copy = MODE_COPY[mode]
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    setShowInstall(!isStandalone() && /iPhone|iPad|Android/i.test(navigator.userAgent))
  }, [])

  const today = dayKey(new Date().toISOString())
  const todays = attempts.filter((a) => dayKey(a.createdAt) === today)
  const bestToday = todays.length ? Math.max(...todays.map((a) => a.score)) : null
  const contestLine = session ? 'Best score of the day wins. Resets at midnight.' : 'Sign in to compete with friends.'

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between gap-3 px-5 pt-4 pb-3">
      {/* the one framed element: the pub sign */}
      <div className="sign-frame relative overflow-hidden mx-auto w-full max-w-sm rounded-lg border-2 border-gold/70 bg-stout px-5 pt-3.5 pb-3 text-center">
        <Bubbles count={mode === 'sparkling' ? 28 : 16} />
        <div className="relative z-10">
          <div className="text-[9px] uppercase tracking-[0.35em] text-gold/80">{mode === 'sparkling' ? copy.edition : 'Est. for the first sip'}</div>
          <div className="font-display text-4xl leading-[1.05] text-cream mt-1.5 tracking-wide">
            Split The <span className="inline-block border-[3px] border-gold text-gold rounded-full px-2.5 leading-none py-0.5">G</span>
          </div>
          <Rule className="my-2" />
          <p className="text-cream/70 text-xs tracking-wide">{copy.tagline}</p>
        </div>
      </div>

      <LinkButton to="/score" size="lg" className="w-full">
        <Pint size={22} />
        {copy.scoreButton}
      </LinkButton>

      {/* figures: plain numbers, hairline dividers */}
      <div className="flex items-stretch divide-x divide-gold/20">
        <Figure size="md" label="Today" value={bestToday ?? '–'} />
        <Figure size="md" label="Best" value={stats.count ? stats.best : '–'} />
        <Figure size="md" label="Splits" value={stats.splits} />
      </div>

      {/* rows: hairline-separated, the column spreads the slack between blocks */}
      <div className="flex flex-col">
        <Hr />
        {cloudEnabled && (
          <>
            <Link to="/contest" className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="font-display text-gold tracking-wider uppercase text-sm">Today's G-off</div>
                <div className="text-cream/60 text-xs mt-0.5">{contestLine}</div>
              </div>
              <span className="font-display text-gold text-xl" aria-hidden>
                ›
              </span>
            </Link>
            <Hr />
          </>
        )}
        <Link to="/history" className="flex items-center justify-between gap-4 py-3">
          <div>
            <div className="font-display text-gold tracking-wider uppercase text-sm">Previous attempts</div>
            {attempts.length > 0 ? (
              <div className="mt-1 flex gap-3 font-display text-xl leading-none">
                {attempts.slice(0, 5).map((a) => (
                  <span key={a.id} style={{ color: TIER_COLOR[tierFor(a.score)] }}>
                    {a.score}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-cream/60 text-xs mt-0.5">None yet. Pour one.</div>
            )}
          </div>
          <span className="font-display text-gold text-xl" aria-hidden>
            ›
          </span>
        </Link>
        <Hr />
      </div>

      <AdSlot slot="home" />

      <p className="text-[10px] text-cream/40 text-center leading-snug">
        {showInstall && (
          <>
            <span className="text-gold/80">Add to home screen</span> for full screen: Share, then Add to Home Screen.{' '}
          </>
        )}
        {mode === 'pub' ? (
          'Independent fan project. Not affiliated with any brewery.'
        ) : (
          <>
            Alcohol-free edition. Same game, sparkling water.{' '}
            <button className="text-gold/80 underline-offset-2 hover:underline" onClick={() => setMode('pub')}>
              Of legal drinking age now? Switch to the pub edition
            </button>
            .
          </>
        )}{' '}
        <Link to="/how-to-play" className="text-gold/80 underline-offset-2 hover:underline">
          How to play
        </Link>{' '}
        ·{' '}
        <Link to="/privacy" className="text-gold/80 underline-offset-2 hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  )
}
