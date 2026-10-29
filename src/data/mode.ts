import { useSyncExternalStore } from 'react'

/**
 * Two editions of the same game. "pub" is the beer original. "sparkling" is
 * the alcohol-free version: same G, same scoring, sparkling water in the
 * glass, blue instead of gold. Anyone who answers No to the age question is
 * offered the sparkling edition instead of a closed door.
 */
export type Mode = 'pub' | 'sparkling'

const KEY = 'stg.mode'
const listeners = new Set<() => void>()
let current: Mode = read()

function read(): Mode {
  try {
    return localStorage.getItem(KEY) === 'sparkling' ? 'sparkling' : 'pub'
  } catch {
    return 'pub'
  }
}

export function getMode(): Mode {
  return current
}

export function setMode(mode: Mode) {
  current = mode
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getMode,
    getMode,
  )
}

export const MODE_COPY = {
  pub: {
    edition: 'Pub edition',
    drink: 'pint',
    scoreButton: 'Score a pint',
    tagline: 'Point at your glass. One sip. Land the line on the G.',
    emoji: '🍺',
    themeColor: '#0d0906',
  },
  sparkling: {
    edition: 'Sparkling edition',
    drink: 'glass',
    scoreButton: 'Score a glass',
    tagline: 'Sparkling water, same G. One sip. Land the line.',
    emoji: '💧',
    themeColor: '#06101c',
  },
} as const
