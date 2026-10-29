import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

/** A hanging pub sign: the Home tab. */
export function PubSign(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 4h18" />
      <path d="M6 4v2M18 4v2" />
      <rect x="4" y="6" width="16" height="11" rx="1.5" />
      <path d="M8 11.5h8M9.5 14h5" />
      <path d="M12 17v3" />
    </svg>
  )
}

/** A pint with a head: the Score tab. */
export function Pint(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 4h10l-1 16H8L7 4Z" />
      <path d="M7.4 8.5h9.2" />
      <path d="M8.2 8.5c.2-1.6 1-2.5 2.3-2.5s1.6.9 2.5.9 1.4-.9 2.3-.9 1.6.7 1.7 2.5" fill="currentColor" stroke="none" opacity=".35" />
    </svg>
  )
}

/** A chalkboard with a rising line: the History tab. */
export function Chalkboard(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M6 13l3.5-3 3 2 5.5-5" />
      <path d="M8 17l-1.5 3M16 17l1.5 3" />
    </svg>
  )
}

/** Two pints clinking: the Friends tab. */
export function Cheers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 6l5 .8-1.2 11.2H6.6L4 6Z" />
      <path d="M20 6l-5 .8 1.2 11.2h1.2L20 6Z" />
      <path d="M5 10.2l3.6.6M19 10.2l-3.6.6" />
      <path d="M11.5 4.5l.5-1.5M12.5 4.5l-.5-1.5M12 4l.3.8" strokeWidth="1.2" />
    </svg>
  )
}

/** A trophy wreathed in leaves: the Contest tab. */
export function Trophy(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.5 3M16 6h2.5a2.5 2.5 0 0 1-2.5 3" />
      <path d="M12 13v3M9 19h6M10 16h4v3h-4z" />
      <path d="M3 13c1.5 0 2.5 1 2.5 2.5M21 13c-1.5 0-2.5 1-2.5 2.5" strokeWidth="1.2" />
    </svg>
  )
}

/** A shamrock: the brand mark. */
export function Shamrock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 12c-1.2-3.4-5.2-3.4-5.2-.8 0 2.2 3.1 2.6 5.2.8Z" />
      <path d="M12 12c3.4-1.2 3.4-5.2.8-5.2-2.2 0-2.6 3.1-.8 5.2Z" />
      <path d="M12 12c1.2 3.4 5.2 3.4 5.2.8 0-2.2-3.1-2.6-5.2-.8Z" />
      <path d="M12 12c-1 2.6-1.2 5-1.6 8" />
    </svg>
  )
}

/** A photo frame: the pick-photo control. */
export function Photo(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="9" r="1.5" />
    </svg>
  )
}

/** A small person silhouette: the profile link. */
export function Person(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  )
}

/** Decorative rule used under headings: ─── ✦ ─── */
export function Rule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-gold/70 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
      <Shamrock size={14} />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  )
}
