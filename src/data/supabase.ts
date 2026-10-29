import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Attempt, Friendship, LeaderboardRow, Profile } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when the app was built with Supabase keys. Without them it runs local-only. */
export const cloudEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, anonKey!) : null

function db(): SupabaseClient {
  if (!supabase) throw new Error('Cloud features are not configured')
  return supabase
}

// ---------- auth ----------

export async function signInWithEmail(email: string) {
  const redirect = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
  if (error) throw error
}

export async function signOut() {
  await db().auth.signOut()
}

// ---------- profiles ----------

interface ProfileRow {
  id: string
  username: string | null
  created_at: string
}

function toProfile(r: ProfileRow): Profile {
  return { id: r.id, username: r.username, createdAt: r.created_at }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? toProfile(data as ProfileRow) : null
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export async function setUsername(userId: string, username: string): Promise<Profile> {
  const clean = username.trim().toLowerCase()
  if (!USERNAME_RE.test(clean)) throw new Error('Usernames are 3-20 letters, numbers or underscores')
  const { data, error } = await db().from('profiles').upsert({ id: userId, username: clean }).select().single()
  if (error) {
    if (error.code === '23505') throw new Error('That username is taken')
    throw error
  }
  return toProfile(data as ProfileRow)
}

export async function findProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('username', username.trim().toLowerCase()).maybeSingle()
  if (error) throw error
  return data ? toProfile(data as ProfileRow) : null
}

// ---------- friendships ----------

interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
  requester?: ProfileRow
  addressee?: ProfileRow
}

export async function listFriendships(myId: string): Promise<Friendship[]> {
  const { data, error } = await db()
    .from('friendships')
    .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as FriendshipRow[]).map((r) => {
    const otherRow = r.requester_id === myId ? r.addressee : r.requester
    return {
      id: r.id,
      requesterId: r.requester_id,
      addresseeId: r.addressee_id,
      status: r.status,
      createdAt: r.created_at,
      other: otherRow ? toProfile(otherRow) : undefined,
    }
  })
}

export async function sendFriendRequest(myId: string, username: string): Promise<void> {
  const other = await findProfileByUsername(username)
  if (!other) throw new Error('No one has that username')
  if (other.id === myId) throw new Error("That's you")
  const { error } = await db().from('friendships').insert({ requester_id: myId, addressee_id: other.id })
  if (error) {
    if (error.code === '23505') throw new Error('Request already sent or you are already friends')
    throw error
  }
}

export async function acceptFriendRequest(id: string): Promise<void> {
  const { error } = await db().from('friendships').update({ status: 'accepted' }).eq('id', id)
  if (error) throw error
}

export async function removeFriendship(id: string): Promise<void> {
  const { error } = await db().from('friendships').delete().eq('id', id)
  if (error) throw error
}

// ---------- attempts ----------

interface AttemptRow {
  id: string
  user_id: string
  score: number
  offset_pct: number
  glass_type: 'plain' | 'official'
  created_at: string
}

function toAttempt(r: AttemptRow): Attempt {
  return {
    id: r.id,
    score: r.score,
    offsetPct: Number(r.offset_pct),
    glassType: r.glass_type,
    createdAt: r.created_at,
    userId: r.user_id,
    synced: true,
  }
}

export async function uploadAttempts(userId: string, attempts: Attempt[]): Promise<void> {
  if (attempts.length === 0) return
  const rows = attempts.map((a) => ({
    id: a.id,
    user_id: userId,
    score: a.score,
    offset_pct: a.offsetPct,
    glass_type: a.glassType,
    created_at: a.createdAt,
  }))
  const { error } = await db().from('attempts').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function fetchMyAttempts(userId: string): Promise<Attempt[]> {
  const { data, error } = await db().from('attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data as AttemptRow[]).map(toAttempt)
}

/** Best score per person among `userIds` for attempts created in [start, end). */
export async function fetchLeaderboard(myId: string, userIds: string[], start: Date, end: Date): Promise<LeaderboardRow[]> {
  const ids = Array.from(new Set([myId, ...userIds]))
  const client = db()
  const [attemptsRes, profilesRes] = await Promise.all([
    client.from('attempts').select('user_id, score').in('user_id', ids).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
    client.from('profiles').select('*').in('id', ids),
  ])
  if (attemptsRes.error) throw attemptsRes.error
  if (profilesRes.error) throw profilesRes.error
  const names = new Map((profilesRes.data as ProfileRow[]).map((p) => [p.id, p.username ?? 'anon']))
  const byUser = new Map<string, LeaderboardRow>()
  for (const r of attemptsRes.data as { user_id: string; score: number }[]) {
    const row = byUser.get(r.user_id) ?? {
      userId: r.user_id,
      username: names.get(r.user_id) ?? 'anon',
      best: 0,
      attempts: 0,
      isMe: r.user_id === myId,
    }
    row.best = Math.max(row.best, r.score)
    row.attempts++
    byUser.set(r.user_id, row)
  }
  return Array.from(byUser.values()).sort((a, b) => b.best - a.best || a.attempts - b.attempts)
}
