import { markSynced, unsyncedAttempts, upsertAttempts } from './local'
import { fetchMyAttempts, uploadAttempts } from './supabase'

/**
 * Push attempts recorded while signed out, then pull everything the user has
 * in the cloud (from any device) into the local store.
 */
export async function syncWithCloud(userId: string): Promise<void> {
  const pending = unsyncedAttempts()
  if (pending.length) {
    await uploadAttempts(userId, pending)
    markSynced(
      pending.map((a) => a.id),
      userId,
    )
  }
  const remote = await fetchMyAttempts(userId)
  upsertAttempts(remote)
}
