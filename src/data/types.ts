export type GlassType = 'plain' | 'official'

export interface Attempt {
  /** UUID generated on the device; the same id is used in the cloud. */
  id: string
  score: number
  /** Signed percent of glass height; positive = too low. */
  offsetPct: number
  glassType: GlassType
  /** ISO timestamp */
  createdAt: string
  /** Set once uploaded to Supabase. */
  synced?: boolean
  /** Owner when loaded from the cloud; undefined for local-only rows. */
  userId?: string
}

export interface Profile {
  id: string
  username: string | null
  createdAt: string
}

export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted'
  createdAt: string
  /** The other person's profile, filled in by the query helpers. */
  other?: Profile
}

export interface LeaderboardRow {
  userId: string
  username: string
  best: number
  attempts: number
  isMe: boolean
}
