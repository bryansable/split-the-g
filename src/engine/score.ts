import { G_BAND, TARGET_FRACTION, fractionToMm } from './glass'

export type Tier = 'split' | 'close' | 'decent' | 'rookie'

export interface ScoreResult {
  /** 0-100 */
  score: number
  /** Signed offset as a percentage of glass height. Positive = line below the G (drank too much). */
  offsetPct: number
  /** Same offset in millimetres on a standard pint. */
  offsetMm: number
  tier: Tier
  /** Short headline, e.g. "Split the G!" */
  title: string
  /** Direction copy, e.g. "4 mm too low" */
  detail: string
}

/** Points lost per percent of glass height outside the G band. */
export const PENALTY_PER_PCT = 6

export function tierFor(score: number): Tier {
  if (score >= 100) return 'split'
  if (score >= 85) return 'close'
  if (score >= 60) return 'decent'
  return 'rookie'
}

export const TIER_TITLE: Record<Tier, string> = {
  split: 'Split the G!',
  close: 'So close',
  decent: 'Decent sip',
  rookie: 'Rookie pour',
}

export const TIER_COLOR: Record<Tier, string> = {
  split: '#4ade80',
  close: '#a3e635',
  decent: '#fbbf24',
  rookie: '#f87171',
}

export function scoreAttempt(
  lineFraction: number,
  target = TARGET_FRACTION,
  band = G_BAND,
): ScoreResult {
  const offset = lineFraction - target
  const offsetPct = offset * 100
  const bandPct = band * 100
  const abs = Math.abs(offsetPct)
  const score = abs <= bandPct ? 100 : Math.max(0, Math.round(100 - PENALTY_PER_PCT * (abs - bandPct)))
  const tier = tierFor(score)
  const offsetMm = fractionToMm(offset)
  const mm = Math.round(Math.abs(offsetMm))
  const detail =
    tier === 'split'
      ? 'Dead centre of the G'
      : offset > 0
        ? `${mm} mm too low. Smaller sip next time.`
        : `${mm} mm too high. Go bigger.`
  return { score, offsetPct, offsetMm, tier, title: TIER_TITLE[tier], detail }
}
