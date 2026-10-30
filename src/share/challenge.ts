import type { ScoreResult } from '../engine/score'
import { MODE_COPY, getMode } from '../data/mode'
import { APP_URL } from './shareCard'

const KEY = 'stg.challenge'

export interface Challenge {
  /** Score to beat */
  score: number
  /** Who set it, if they had a username */
  from?: string
}

/**
 * Link a friend opens to take the challenge. /c/<score> is a static page with
 * a link preview made for that score (site/plugin.ts); it forwards to
 * #/challenge with the same query.
 */
export function challengeUrl(score: number, from?: string): string {
  const p = new URLSearchParams()
  if (from) p.set('f', from)
  if (getMode() === 'sparkling') p.set('m', 's')
  const q = p.toString()
  return `${APP_URL}c/${Math.round(score)}${q ? `?${q}` : ''}`
}

/** Text-message body: the result plus a link for the friend to try. */
export function challengeText(result: Pick<ScoreResult, 'score' | 'tier' | 'title'>, from?: string, lead?: string): string {
  const who = from ? `@${from}` : 'I'
  const verb = from ? 'scored' : 'just scored'
  const brag = result.tier === 'split' ? 'Split the G. Dead centre.' : result.title + '.'
  const emoji = MODE_COPY[getMode()].emoji
  const opening = lead ?? `${who} ${verb} ${result.score}/100 on Split The G ${emoji} ${brag}`
  return `${opening} Think you can beat it? Your turn: ${challengeUrl(result.score, from)}`
}

/** WhatsApp's own share link: opens the app with the message filled in and a chat picker. */
export function whatsappHref(body: string): string {
  return `https://wa.me/?text=${encodeURIComponent(body)}`
}

/**
 * sms: link that opens the phone's Messages app with the text filled in and
 * no recipient. iOS wants "sms:&body=", Android "sms:?body=".
 */
export function smsHref(body: string): string {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  return `${ios ? 'sms:&' : 'sms:?'}body=${encodeURIComponent(body)}`
}

export function saveChallenge(c: Challenge) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

export function loadChallenge(): Challenge | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Challenge) : null
  } catch {
    return null
  }
}

export function clearChallenge() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
