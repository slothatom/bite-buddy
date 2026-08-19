/**
 * Wiring the sync layer to the session, and reporting what it is doing.
 *
 * Sync starts when someone signs in and stops when they sign out, so a signed
 * -out browser holds no subscription and pushes nothing.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { onSyncChange, startSync, syncSnapshot, type SyncSnapshot } from '../lib/sync'
import { useAuthStore } from './useAuth'

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(onSyncChange, syncSnapshot, syncSnapshot)
}

/** Mounted once, at the app root. */
export function useSyncSession() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  useEffect(() => {
    if (!userId) return
    return startSync(userId)
  }, [userId])
}
