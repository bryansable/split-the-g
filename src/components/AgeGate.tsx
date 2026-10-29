import { useState } from 'react'
import { Button } from './ui'
import { Rule } from './icons'

const KEY = 'stg.age.ok'

export function ageConfirmed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * First-visit question. The app is about beer, so ad networks and common
 * sense both want a legal-drinking-age check before anything else shows.
 */
export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const [declined, setDeclined] = useState(false)

  function confirm() {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* still let them in for this session */
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/95 flex items-center justify-center px-6" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="w-full max-w-sm rounded-lg border-2 border-gold/70 bg-stout px-6 py-7 text-center shadow-[0_0_0_4px_#241710,0_0_0_5px_rgba(201,164,71,.35)]">
        <div className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Before you come in</div>
        <h2 id="age-title" className="font-display text-2xl text-cream mt-3 tracking-wide">
          Are you of legal drinking age?
        </h2>
        <Rule className="my-4" />
        {declined ? (
          <p className="text-cream/70 text-sm">Come back when you are. This is a game about beer and it is only for adults.</p>
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
