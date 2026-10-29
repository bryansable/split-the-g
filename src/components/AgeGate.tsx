import { useState } from 'react'
import { Button } from './ui'
import { Rule } from './icons'
import { setMode } from '../data/mode'

const KEY = 'stg.age.ok'

export function ageConfirmed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Shown before the pub edition on a first visit. Yes lets them in. No is not a
 * closed door: it switches to the sparkling edition, the same game with
 * sparkling water and no beer.
 */
export function AgeGate({ onConfirm, onSparkling }: { onConfirm: () => void; onSparkling: () => void }) {
  const [declined, setDeclined] = useState(false)

  function confirm() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* still let them in for this session */
    }
    onConfirm()
  }

  function sparkling() {
    setMode('sparkling')
    onSparkling()
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/95 flex items-center justify-center px-6" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="sign-frame w-full max-w-sm rounded-lg border-2 border-gold/70 bg-stout px-6 py-7 text-center">
        <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Before you come in</div>
        <h2 id="age-title" className="font-display text-2xl text-cream mt-3 tracking-wide">
          {declined ? 'Same game, no beer' : 'Are you of legal drinking age?'}
        </h2>
        <Rule className="my-4" />
        {declined ? (
          <>
            <p className="text-cream/70 text-sm">
              The sparkling edition is the same challenge with a glass of sparkling water: one sip, land the line on the G, scores, friends, the lot.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button size="lg" onClick={sparkling}>
                Play the sparkling edition
              </Button>
              <Button variant="ghost" onClick={() => setDeclined(false)}>
                Back
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-cream/70 text-sm">Split The G is a game about beer, for adults only where you live. Please drink responsibly.</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button size="lg" onClick={confirm}>
                Yes, I am
              </Button>
              <Button variant="ghost" onClick={() => setDeclined(true)}>
                No
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
