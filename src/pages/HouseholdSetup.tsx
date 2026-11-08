import { useState } from 'react'
import { AlertTriangle, Home, LogOut, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/useAuth'
import { useHousehold } from '../store/useHousehold'
import Logo from '../components/brand/Logo'

/**
 * First run for an account that belongs to no household.
 *
 * Shown only once the database has said so: nobody has invited this address,
 * and it is not on the old guest list. Two ways forward, and the screen offers
 * both: start a household of your own (you become its admin), or ask someone
 * to invite this email and check again.
 */
export default function HouseholdSetup() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { status, error, create, load } = useHousehold()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setFailed(null)
    const result = await create(name)
    setBusy(false)
    if (!result.ok) setFailed(result.error ?? 'That did not work.')
  }

  async function checkAgain() {
    if (!user || busy) return
    setBusy(true)
    await load(user.id)
    setBusy(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-7">
          <Logo variant="mark" size={56} />
          <h1 className="display text-2xl text-ink-900 mt-3">Start a household</h1>
          <p className="text-sm text-ink-700 mt-1">
            Signed in as <strong className="break-all">{user?.email}</strong>.
          </p>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="label" htmlFor="household-name">What should it be called?</label>
            <input
              id="household-name"
              className="input"
              placeholder="e.g. The flat"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full justify-center" disabled={busy || !name.trim()}>
            <Home size={16} /> {busy ? 'Starting…' : 'Create household'}
          </button>

          {(failed || (status === 'error' && error)) && (
            <p className="flex items-start gap-2 text-sm text-coral-600">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {failed ?? error}
            </p>
          )}

          <p className="text-xs text-ink-500">
            You will be its admin, and can invite people from Settings. Joining someone
            else's instead? Ask them to invite this email, then check again.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void checkAgain()} disabled={busy}>
              <RefreshCw size={15} /> Check for an invite
            </button>
            <button type="button" className="btn-ghost text-ink-500" onClick={() => void signOut()}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
