import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { onStorageFailure, storageFailure } from '../../store/persist'
import { useSyncStatus } from '../../store/useSync'
import { useAuthStore } from '../../store/useAuth'

/**
 * Tells the user when their changes are not being saved.
 *
 * Two different failures, one message, because from where you are standing
 * they are the same problem:
 *
 *  - **Browser storage refused the write.** Everything here lives in
 *    localStorage, so the app keeps working, the numbers look right, and
 *    nothing survives a refresh.
 *  - **The server refused the write.** The device keeps the change and retries,
 *    which is fine for a tunnel and not fine for a permission that will refuse
 *    every write until somebody fixes it. That one is silent forever otherwise,
 *    and it is what made a refresh look like it emptied the app.
 *  - **This account never joined the household.** Membership is what every
 *    database policy checks, so an account without it is signed in and allowed
 *    to read and write nothing.
 *
 * The server's own words are included when there are any. "new row violates
 * row-level security policy" is not friendly, but it is the difference between
 * guessing and knowing, and it is the thing worth reading out to whoever can
 * fix it.
 */
export default function StorageBanner() {
  const [reason, setReason] = useState<string | null>(storageFailure())
  const [dismissed, setDismissed] = useState(false)
  const { state, unsaved, lastError } = useSyncStatus()
  const authError = useAuthStore((s) => s.error)

  useEffect(() => onStorageFailure(setReason), [])

  // A pending change on its own is ordinary: the queue is about to send it.
  // Pending *and* erroring means the server is turning it down.
  const rejected = state === 'error' && unsaved > 0
  const message = reason
    ?? authError
    ?? (rejected
      ? `${unsaved} ${unsaved === 1 ? 'change is' : 'changes are'} not reaching the shared copy. `
        + `They are safe on this device and will keep retrying.`
      : null)

  if (!message || dismissed) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-coral-600 text-white px-4 py-2.5 flex items-start gap-2.5 text-sm shadow-lg"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <p className="flex-1 min-w-0">
        {message}
        {!reason && !authError && lastError ? (
          <span className="block text-white/80 text-xs mt-0.5 break-words">{lastError}</span>
        ) : null}
      </p>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="shrink-0 p-1 -m-1">
        <X size={16} />
      </button>
    </div>
  )
}
