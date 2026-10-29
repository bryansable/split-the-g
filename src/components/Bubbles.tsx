import { useMemo } from 'react'

export interface BubblesProps {
  count?: number
  /** Rise time range in seconds. Slow and ambient by default. */
  minDuration?: number
  maxDuration?: number
  /** Bubble diameter range in px. */
  minSize?: number
  maxSize?: number
}

/**
 * Rising stout bubbles for a background. Pure CSS animation, absolutely
 * positioned, so the parent needs `relative overflow-hidden`. Hidden when the
 * user prefers reduced motion (see index.css).
 */
export function Bubbles({ count = 22, minDuration = 7, maxDuration = 16, minSize = 3, maxSize = 12 }: BubblesProps) {
  const bubbles = useMemo(() => {
    // deterministic pseudo-random so the layout is stable across renders
    let seed = 7
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    return Array.from({ length: count }, (_, i) => {
      const duration = minDuration + rand() * (maxDuration - minDuration)
      return {
        id: i,
        left: rand() * 100,
        size: minSize + rand() * (maxSize - minSize),
        duration,
        delay: -rand() * duration,
        sway: 1.5 + rand() * 3,
        opacity: 0.25 + rand() * 0.4,
      }
    })
  }, [count, minDuration, maxDuration, minSize, maxSize])

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
