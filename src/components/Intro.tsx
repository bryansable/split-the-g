import { useEffect, useState } from 'react'
import { Bubbles } from './Bubbles'

/**
 * Page-load reveal: a stout-black curtain full of rising bubbles. Its bottom
 * edge lifts away, so the screen underneath emerges from the bottom up as the
 * bubbles float off the top. Plays once per page load; skipped for users who
 * prefer reduced motion.
 */
export function Intro() {
  const [show, setShow] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  // Safety net in case animationend never fires (background tab, etc.).
  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(false), 2600)
    return () => window.clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div className="intro" aria-hidden onAnimationEnd={() => setShow(false)}>
      <Bubbles count={48} minDuration={1.2} maxDuration={2.2} minSize={4} maxSize={18} />
    </div>
  )
}
