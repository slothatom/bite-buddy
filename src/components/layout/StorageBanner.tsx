import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { onStorageFailure, storageFailure } from '../../store/persist'

/**
 * Tells the user when their changes are not being saved.
 *
 * Everything here lives in browser storage, so a failed write means silent data
 * loss — the app keeps working, the numbers look right, and nothing survives a
 * refresh. That is the one failure that must not be quiet.
 */
export default function StorageBanner() {
  const [reason, setReason] = useState<string | null>(storageFailure())
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => onStorageFailure(setReason), [])

  if (!reason || dismissed) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-clay-600 text-white px-4 py-2.5 flex items-start gap-2.5 text-sm shadow-lg"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <p className="flex-1">{reason}</p>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="shrink-0 p-1 -m-1">
        <X size={16} />
      </button>
    </div>
  )
}
