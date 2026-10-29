/**
 * Google AdSense wiring. Everything is keyed to build-time config so the app
 * shows nothing ad-related until the publisher ID exists:
 *
 *   VITE_ADSENSE_CLIENT       ca-pub-XXXXXXXXXXXXXXXX (from the AdSense account)
 *   VITE_ADSENSE_SLOT_HOME    numeric ad-unit ID for the Home banner
 *   VITE_ADSENSE_SLOT_RESULT  numeric ad-unit ID for the Result banner
 *
 * The AdSense script is loaded once, only after the age gate, and only in a
 * production build with a client ID. Google's own consent message (set up in
 * AdSense under Privacy & messaging) rides along with the script for EEA/UK.
 */

export const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() || ''

export const AD_SLOTS = {
  home: (import.meta.env.VITE_ADSENSE_SLOT_HOME as string | undefined)?.trim() || '',
  result: (import.meta.env.VITE_ADSENSE_SLOT_RESULT as string | undefined)?.trim() || '',
}

export const adsEnabled = Boolean(ADSENSE_CLIENT) && import.meta.env.PROD

let loading: Promise<void> | null = null

/** Insert the AdSense loader script once. Resolves when it has loaded. */
export function loadAdsense(): Promise<void> {
  if (!adsEnabled) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.async = true
    s.crossOrigin = 'anonymous'
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
    s.onload = () => resolve()
    s.onerror = () => resolve() // blocked by an ad blocker: carry on without ads
    document.head.appendChild(s)
  })
  return loading
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/** Ask AdSense to fill the <ins> elements that have not been filled yet. */
export function requestAd() {
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch {
    /* ad blocker or script not loaded */
  }
}
