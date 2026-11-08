import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useArchive } from '../../store/useArchive'
import { useHousehold, useMyRole } from '../../store/useHousehold'
import { useAuthStore } from '../../store/useAuth'
import { isConfigured } from '../../lib/supabase'
import type { ArchiveCounts } from '../../data/archiveFormat'

/**
 * Where the plan archive comes from, and the one way to replace it.
 *
 * The plans are private, so the app does not ship them: an admin uploads the
 * `archive.json` that `npm run data:build` writes, and everyone in the
 * household reads it from there. Everybody else sees where it stands. On a
 * copy with no database the file is kept on this device instead.
 */
export function ArchiveUploadPanel() {
  const status = useArchive((s) => s.status)
  const counts = useArchive((s) => s.counts)
  const updatedAt = useArchive((s) => s.updatedAt)
  const error = useArchive((s) => s.error)
  const householdId = useHousehold((s) => s.household?.id ?? null)
  const role = useMyRole()
  const signedIn = useAuthStore((s) => Boolean(s.session))
  const [busy, setBusy] = useState(false)
  const result = useArchive((s) => s.notice)
  const setResult = useArchive((s) => s.setNotice)

  const canUpload = !isConfigured || (signedIn && role === 'admin' && Boolean(householdId))

  async function onFile(file: File) {
    setBusy(true)
    setResult(null)
    try {
      const outcome = await useArchive.getState().upload(await file.text(), householdId)
      const now = useArchive.getState().counts
      setResult(outcome.ok
        ? { tone: 'ok', message: `${isConfigured ? 'Uploaded' : 'Loaded'}. ${describe(now)}.` }
        : { tone: 'bad', message: outcome.error ?? 'That did not work.' })
    } catch {
      setResult({ tone: 'bad', message: 'That file could not be read.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4 space-y-3" data-archive-panel>
      <div>
        <h2 className="font-semibold text-ink-900 text-sm">Plan archive</h2>
        <p className="text-sm text-ink-700 mt-0.5" data-archive-status={status}>
          {statusLine({ status, counts, updatedAt, error, signedIn })}
        </p>
      </div>

      {canUpload ? (
        <div className="space-y-2">
          <label className={`btn-secondary w-fit ${busy ? 'pointer-events-none' : 'cursor-pointer'}`} aria-disabled={busy}>
            <Upload size={15} /> {isConfigured ? 'Upload plan archive' : 'Load plan archive'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label={isConfigured ? 'Upload plan archive' : 'Load plan archive'}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onFile(file)
                e.target.value = ''
              }}
            />
          </label>
          <p className="text-xs text-ink-500">
            {isConfigured
              ? 'Choose the archive.json made by npm run data:build. It replaces the plans for everyone in the household.'
              : 'Choose the archive.json made by npm run data:build. It is kept on this device only.'}
          </p>
        </div>
      ) : signedIn ? (
        <p className="text-xs text-ink-500">Only an admin of the household can upload a new one.</p>
      ) : null}

      {busy && <p className="text-sm text-ink-700">Checking the file…</p>}
      {result && (
        <p role="status" className={`text-sm ${result.tone === 'ok' ? 'text-bite-700' : 'text-coral-700'}`}>
          {result.message}
        </p>
      )}
    </section>
  )
}

function describe(counts: ArchiveCounts | null): string {
  if (!counts) return 'No plans'
  return `${counts.plans} ${counts.plans === 1 ? 'plan' : 'plans'}, `
    + `${counts.days} ${counts.days === 1 ? 'day' : 'days'}, `
    + `${counts.recipes} ${counts.recipes === 1 ? 'recipe' : 'recipes'}`
}

function statusLine({ status, counts, updatedAt, error, signedIn }: {
  status: string
  counts: ArchiveCounts | null
  updatedAt: string | null
  error: string | null
  signedIn: boolean
}): string {
  if (isConfigured && !signedIn) return 'Sign in to see your household\'s plans.'
  switch (status) {
    case 'ready': {
      const when = updatedAt
        ? ` Updated ${new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
        : ' On this device only.'
      return `${describe(counts)}.${when}`
    }
    case 'loading':
      return 'Loading the plans…'
    case 'missing':
      return 'No plans uploaded for this household yet.'
    case 'error':
      return `The plans could not be loaded. ${error ?? ''}`.trim()
    default:
      return isConfigured ? 'Not loaded yet.' : 'No plans on this device yet.'
  }
}
