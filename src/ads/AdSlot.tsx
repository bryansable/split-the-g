import { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled, loadAdsense, requestAd } from './adsense'

/**
 * One responsive AdSense display unit. Renders nothing at all unless ads are
 * configured, so screens look identical with and without them.
 */
export function AdSlot({ slot, className = '' }: { slot: keyof typeof AD_SLOTS; className?: string }) {
  const id = AD_SLOTS[slot]
  const ref = useRef<HTMLModElement>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (!adsEnabled || !id || requested.current) return
    requested.current = true
    let cancelled = false
    loadAdsense().then(() => {
      if (!cancelled) requestAd()
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!adsEnabled || !id) return null
  return (
    <div className={`ad-slot w-full overflow-hidden ${className}`} aria-label="Advertisement">
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={id}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
