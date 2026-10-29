import { ScoreChart } from '../components/ScoreChart'
import { Card, LinkButton, PageTitle, Stat } from '../components/ui'
import { computeStats, useAttempts } from '../data/local'
import { TIER_COLOR, TIER_TITLE, tierFor } from '../engine/score'

export function History() {
  const attempts = useAttempts()
  const stats = computeStats(attempts)

  return (
    <div className="p-4 space-y-4">
      <PageTitle sub="Every sip, scored.">History</PageTitle>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Attempts" value={stats.count} />
        <Stat label="Best" value={stats.best} />
        <Stat label="Avg (10)" value={stats.average} />
        <Stat label="Streak" value={`${stats.streakDays}d`} />
      </div>

      <Card>
        <ScoreChart attempts={attempts} />
      </Card>

      {attempts.length === 0 ? (
        <Card className="text-center">
          <p className="text-cream/70 mb-3">No attempts yet. Pour one and give it a go.</p>
          <LinkButton to="/score">Score a pint</LinkButton>
        </Card>
      ) : (
        <ul className="space-y-2">
          {attempts.map((a) => {
            const tier = tierFor(a.score)
            const d = new Date(a.createdAt)
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-md bg-stout border border-gold/15 px-3 py-2">
                <span className="font-serif text-2xl w-12 text-right" style={{ color: TIER_COLOR[tier] }}>
                  {a.score}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-cream text-sm">{TIER_TITLE[tier]}</div>
                  <div className="text-cream/50 text-xs">
                    {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {a.offsetPct > 0 ? `${Math.abs(a.offsetPct).toFixed(1)}% low` : a.offsetPct < 0 ? `${Math.abs(a.offsetPct).toFixed(1)}% high` : 'centre'} ·{' '}
                    {a.glassType === 'official' ? 'official glass' : 'any glass'}
                  </div>
                </div>
                {a.synced && <span className="text-[10px] text-cream/40">☁</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
