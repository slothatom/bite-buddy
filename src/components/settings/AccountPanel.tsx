import { useState } from 'react'
import { Check, LogOut } from 'lucide-react'
import { SectionHeading } from '../ui'
import { useAuthStore } from '../../store/useAuth'

/**
 * The signed-in account.
 *
 * Only rendered on the deployed app; a local clone has no accounts at all.
 * The display name is what the other person sees on the welcome screen, so it
 * is worth being able to set it to something friendlier than an email address.
 */
export function AccountPanel() {
  const { user, members, setDisplayName, signOut } = useAuthStore()
  const mine = members.find((m) => m.id === user?.id)

  // The saved name arrives a moment after the page does, the session is read
  // from storage but the household list is a request. Holding the field in
  // state alone meant it initialised empty and stayed empty, so the name
  // looked lost after every refresh. Null means "not typed in yet", and until
  // then the field shows whatever the household knows.
  const [typed, setTyped] = useState<string | null>(null)
  const name = typed ?? mine?.display_name ?? ''
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <section>
      <SectionHeading>Account</SectionHeading>
      <div className="card p-4 space-y-4">
        <p className="text-sm text-ink-700">
          Signed in as <strong className="break-all">{user?.email}</strong>. Your plans, recipes and
          shopping list are shared with everyone else in the household.
        </p>

        <div>
          <label className="label">What the others should call you</label>
          <div className="flex gap-2">
            <input
              className="input" placeholder="e.g. Ana" value={name}
              onChange={(e) => { setTyped(e.target.value); setSaved(false); setFailed(false) }}
            />
            <button
              className="btn-secondary shrink-0"
              disabled={!name.trim() || name.trim() === mine?.display_name}
              onClick={async () => {
                const ok = await setDisplayName(name.trim())
                setSaved(ok)
                setFailed(!ok)
                if (ok) setTyped(null)
              }}
            >
              {saved ? <><Check size={15} /> Saved</> : 'Save'}
            </button>
          </div>
          {failed && (
            <p className="text-xs text-coral-600 mt-1">
              That did not save. Check you are still signed in and try again.
            </p>
          )}
        </div>

        <button className="btn-ghost text-ink-500 hover:text-coral-600 w-fit" onClick={() => void signOut()}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </section>
  )
}
