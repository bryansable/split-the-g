import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pint, Rule } from '../components/icons'
import { LinkButton, Page } from '../components/ui'
import { TIER_COLOR, tierFor } from '../engine/score'
import { saveChallenge } from '../share/challenge'

/** Landing page for a texted challenge link: shows the score to beat, then into Score. */
export function Challenge() {
  const [params] = useSearchParams()
  const score = Math.max(0, Math.min(100, Number(params.get('s')) || 0))
  const from = params.get('f')?.replace(/[^a-z0-9_]/gi, '').slice(0, 20) || undefined

  useEffect(() => {
    saveChallenge({ score, from })
  }, [score, from])

  return (
    <Page>
      <div className="flex-1 flex flex-col justify-center text-center py-10">
        <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80">{from ? `@${from} threw down` : 'A friend threw down'}</div>
        <div className="font-display leading-none mt-4" style={{ color: TIER_COLOR[tierFor(score)], fontSize: 112 }}>
          {score}
        </div>
        <div className="font-display text-cream text-2xl mt-2 tracking-wide">out of 100</div>
        <Rule className="my-5 mx-10" />
        <p className="text-cream/70 text-sm px-6">Pour a pint, take one sip, and land the line on the G. Beat their score and send it back.</p>
        <LinkButton to="/score" size="lg" className="mt-8 mx-auto">
          <Pint size={22} />
          Take the challenge
        </LinkButton>
      </div>
    </Page>
  )
}
