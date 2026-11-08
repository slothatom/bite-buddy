import { useState } from 'react'
import { Archive, Upload } from 'lucide-react'
import { IconTile } from './SettingsList'
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

  const action = isConfigured ? 'Upload plan archive' : 'Load plan archive'

  // A tinted panel on a phone, where it heads the screen; a plain card with
  // the button beside the words on a wide screen, where it shares the pane.
  return (
    <section
      aria-labelledby="archive-heading"
      className="rounded-card p-4 flex flex-col gap-2.5 bg-bite-100
                 md:bg-paper md:border md:border-border-200 md:px-4.5 md:flex-row md:items-center md:gap-4"
      data-archive-panel
    >
      <span className="hidden md:flex">
        <IconTile icon={Archive} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h2 id="archive-heading" className="text-xs font-extrabold uppercase tracking-[0.06em] text-bite-700 md:normal-case md:tracking-normal md:text-[15px] md:text-ink-900">
          Plan archive
        </h2>
        <p className="text-base leading-[22px] font-extrabold text-ink-900 md:text-sm md:font-semibold md:text-ink-700" data-archive-status={status}>
          {statusLine({ status, counts, updatedAt, error, signedIn })}
        </p>
        {canUpload ? (
          <p className="hidden md:block text-xs text-ink-700">{uploadNote}</p>
        ) : signedIn ? (
          <p className="text-xs text-ink-700">Only an admin of the household can upload a new one.</p>
        ) : null}
        {busy && <p className="text-sm text-ink-700">Checking the file…</p>}
        {result && (
          <p role="status" className={`text-sm font-bold ${result.tone === 'ok' ? 'text-bite-700' : 'text-coral-700'}`}>
            {result.message}
          </p>
        )}
      </div>

      {canUpload && (
        <>
          <label
            className={`btn min-h-11 rounded-lg border border-bite-700 bg-paper text-bite-700 font-extrabold
                        text-[15px] hover:bg-bite-50 shrink-0 ${busy ? 'pointer-events-none opacity-45' : 'cursor-pointer'}`}
            aria-disabled={busy}
          >
            <Upload size={18} aria-hidden="true" /> {action}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label={action}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onFile(file)
                e.target.value = ''
              }}
            />
          </label>
          <p className="md:hidden text-xs text-ink-700">{uploadNote}</p>
        </>
      )}
    </section>
  )
}

const uploadNote = isConfigured
  ? 'Admins only. Choose the archive.json made by npm run data:build. It replaces the plans for everyone in the household.'
  : 'Choose the archive.json made by npm run data:build. It is kept on this device only.'


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
