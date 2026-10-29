import { useMemo } from 'react'

/**
 * Rising stout bubbles for a hero background. Pure CSS animation, absolutely
 * positioned, so the parent needs `relative overflow-hidden`. Hidden when the
 * user prefers reduced motion (see index.css).
 */
export function Bubbles({ count = 22 }: { count?: number }) {
  const bubbles = useMemo(() => {
    // deterministic pseudo-random so the layout is stable across renders
    let seed = 7
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand() * 100,
      size: 3 + rand() * 9,
      duration: 7 + rand() * 9,
      delay: -rand() * 16,
      sway: 1.5 + rand() * 3,
      opacity: 0.25 + rand() * 0.4,
    }))
  }, [count])

  return (
    <div className="bubbles" aria-hidden>
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s, ${b.sway}s`,
            animationDelay: `${b.delay}s, ${b.delay}s`,
            opacity: b.opacity,
          }}
        />
      ))}
    </div>
  )
}
