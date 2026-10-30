import { ScoreChart } from '../components/ScoreChart'
import { Figure, Hr, LinkButton, Page, PageTitle, SectionLabel } from '../components/ui'
import { computeStats, useAttempts } from '../data/local'
import { useAuth } from '../data/AuthContext'
import { MODE_COPY, useMode } from '../data/mode'
import { TIER_COLOR, TIER_TITLE, tierFor } from '../engine/score'
import { challengeText, challengeUrl } from '../share/challenge'
import { ShareBar, useShareCard } from '../share/ShareBar'

export function History() {
  const attempts = useAttempts()
  const stats = computeStats(attempts)
  const { profile } = useAuth()
  const mode = useMode()
  const from = profile?.username ?? undefined
  const best = stats.count ? { score: stats.best, tier: tierFor(stats.best), title: TIER_TITLE[tierFor(stats.best)] } : null
  const bestAt = best ? (attempts.find((a) => a.score === best.score)?.createdAt ?? '') : ''
  const card = useShareCard(null, best && { ...best, detail: 'My best so far' }, bestAt)

  return (
    <Page>
      <PageTitle sub="Every sip, scored.">History</PageTitle>

      <div className="mt-2 flex items-stretch divide-x divide-gold/20">
        <Figure size="md" label="Attempts" value={stats.count} />
        <Figure size="md" label="Best" value={stats.best} />
        <Figure size="md" label="Avg (10)" value={stats.average} />
        <Figure size="md" label="Streak" value={`${stats.streakDays}d`} />
      </div>

      {best && (
        <div className="mt-5">
          <ShareBar
            card={card?.blob ?? null}
            text={challengeText(best, from, `My best on Split The G is ${best.score}/100 ${MODE_COPY[mode].emoji}`)}
            link={challengeUrl(best.score, from)}
            label="Share your best"
          />
        </div>
      )}

      <Hr className="mt-6" />
      <div className="py-4">
        <ScoreChart attempts={attempts} />
      </div>
      <Hr />

      {attempts.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-cream/60 mb-4">No attempts yet. Pour one and give it a go.</p>
          <LinkButton to="/score">Score a pint</LinkButton>
        </div>
      ) : (
        <>
          <div className="pt-4">
            <SectionLabel>All attempts</SectionLabel>
          </div>
          <ul className="divide-y divide-gold/15">
            {attempts.map((a) => {
              const tier = tierFor(a.score)
              const d = new Date(a.createdAt)
              return (
                <li key={a.id} className="flex items-center gap-4 py-2.5">
                  <span className="font-display text-2xl w-12 text-right leading-none" style={{ color: TIER_COLOR[tier] }}>
                    {a.score}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-cream text-sm">{TIER_TITLE[tier]}</div>
                    <div className="text-cream/45 text-xs">
                      {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {a.offsetPct > 0 ? `${Math.abs(a.offsetPct).toFixed(1)}% low` : a.offsetPct < 0 ? `${Math.abs(a.offsetPct).toFixed(1)}% high` : 'centre'} ·{' '}
                      {a.glassType === 'official' ? 'official glass' : 'any glass'}
                    </div>
                  </div>
                  {a.synced && <span className="text-[10px] text-gold/50 uppercase tracking-wider">synced</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Page>
  )
}
