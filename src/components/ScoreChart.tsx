import { TIER_COLOR, tierFor } from '../engine/score'
import type { Attempt } from '../data/types'

/** Simple SVG line chart of scores over time, oldest on the left. */
export function ScoreChart({ attempts, height = 160 }: { attempts: Attempt[]; height?: number }) {
  const data = attempts.slice().reverse().slice(-40)
  const W = 600
  const H = height
  const padL = 30
  const padR = 12
  const padT = 12
  const padB = 18
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = data.length
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (score: number) => padT + (1 - score / 100) * innerH
  const points = data.map((a, i) => `${x(i)},${y(a.score)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Score history chart">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#f5e6c8" strokeOpacity={0.12} />
          <text x={padL - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#f5e6c8" fillOpacity={0.5}>
            {v}
          </text>
        </g>
      ))}
      <rect x={padL} y={y(100)} width={innerW} height={y(85) - y(100)} fill="#4ade80" fillOpacity={0.08} />
      {n > 1 && <polyline points={points} fill="none" stroke="#f5e6c8" strokeOpacity={0.6} strokeWidth={2} strokeLinejoin="round" />}
      {data.map((a, i) => (
        <circle key={a.id} cx={x(i)} cy={y(a.score)} r={4.5} fill={TIER_COLOR[tierFor(a.score)]} />
      ))}
      {n === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={14} fill="#f5e6c8" fillOpacity={0.5}>
          No attempts yet
        </text>
      )}
    </svg>
  )
}
