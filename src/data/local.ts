import { useSyncExternalStore } from 'react'
import type { Attempt } from './types'

const KEY = 'stg.attempts.v1'

let cache: Attempt[] | null = null
const listeners = new Set<() => void>()

function read(): Attempt[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Attempt[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: Attempt[]) {
  cache = next.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // storage full or unavailable; keep in memory
  }
  listeners.forEach((l) => l())
}

export function loadAttempts(): Attempt[] {
  return read()
}

/** Insert or replace by id. */
export function upsertAttempts(items: Attempt[]) {
  const byId = new Map(read().map((a) => [a.id, a]))
  for (const a of items) byId.set(a.id, { ...byId.get(a.id), ...a })
  write(Array.from(byId.values()))
}

export function saveAttempt(a: Attempt) {
  upsertAttempts([a])
}

export function markSynced(ids: string[], userId: string) {
  const set = new Set(ids)
  write(read().map((a) => (set.has(a.id) ? { ...a, synced: true, userId } : a)))
}

export function unsyncedAttempts(): Attempt[] {
  return read().filter((a) => !a.synced)
}

export function clearLocal() {
  write([])
}

export function useAttempts(): Attempt[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    read,
  )
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Local calendar day key, e.g. 2026-10-29. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export interface Stats {
  count: number
  best: number
  average: number
  splits: number
  streakDays: number
}

export function computeStats(attempts: Attempt[], now = new Date()): Stats {
  if (attempts.length === 0) return { count: 0, best: 0, average: 0, splits: 0, streakDays: 0 }
  const best = Math.max(...attempts.map((a) => a.score))
  const recent = attempts.slice(0, 10)
  const average = Math.round(recent.reduce((s, a) => s + a.score, 0) / recent.length)
  const splits = attempts.filter((a) => a.score >= 100).length
  const days = new Set(attempts.map((a) => dayKey(a.createdAt)))
  let streakDays = 0
  const cursor = new Date(now)
  // A streak may start yesterday if nothing has been logged yet today.
  if (!days.has(dayKey(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor.toISOString()))) {
    streakDays++
    cursor.setDate(cursor.getDate() - 1)
  }
  return { count: attempts.length, best, average, splits, streakDays }
}
