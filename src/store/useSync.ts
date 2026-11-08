/**
 * Wiring the sync layer to the session, and reporting what it is doing.
 *
 * Sync starts when someone signs in and stops when they sign out, so a signed
 * -out browser holds no subscription and pushes nothing.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { onSyncChange, startSync, syncSnapshot, type SyncSnapshot } from '../lib/sync'
import { useAuthStore } from './useAuth'
import { useHousehold } from './useHousehold'

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(onSyncChange, syncSnapshot, syncSnapshot)
}

/** Mounted once, at the app root. */
export function useSyncSession() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  // Waits for the household: every row is written to one, and an account in
  // none has nowhere to write. The cached answer counts, so a phone opened
  // offline starts at once.
  const householdId = useHousehold((s) => (s.userId === userId ? s.household?.id ?? null : null))
  useEffect(() => {
    if (!userId || !householdId) return
    return startSync(userId, householdId)
  }, [userId, householdId])
}
