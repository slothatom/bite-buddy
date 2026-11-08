import { useState } from 'react'
import { Check, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/useAuth'
import { useOwnPersonKey, usePeople } from '../../store/useHousehold'
import { PersonAvatar } from '../ui/PersonAvatar'
import { SettingsGroup } from './SettingsList'

/**
 * Who is signed in here, and the way out: an avatar, the address, and a
 * Sign out button. Shared by the Settings list on a phone and the Account page.
 */
export function SignedInRow() {
  const { user, signOut } = useAuthStore()
  const people = usePeople()
  const own = useOwnPersonKey()
  const at = people.findIndex((p) => p.id === own)

  return (
    <div className="flex items-center gap-3">
      {at >= 0 && <PersonAvatar person={people[at]} index={at} size="lg" />}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-xs text-ink-700">Signed in as</span>
        <span className="text-[15px] leading-5 font-bold text-ink-900 truncate">{user?.email}</span>
      </span>
      <button
        type="button"
        className="btn min-h-11 px-3.5 rounded-lg border border-border-200 text-ink-900 hover:bg-coral-50 hover:text-coral-700 shrink-0"
        onClick={() => void signOut()}
      >
        <LogOut size={16} aria-hidden="true" /> Sign out
      </button>
    </div>
  )
}

/**
 * The signed-in account.
 *
 * Only rendered on the deployed app; a local clone has no accounts at all.
 * The display name is what the other person sees on the welcome screen, so it
 * is worth being able to set it to something friendlier than an email address.
 */
export function AccountPanel() {
  const { user, members, setDisplayName } = useAuthStore()
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
    <SettingsGroup id="account-heading" title="Account">
      <div className="bg-paper border border-border-200 rounded-card p-3.5 flex flex-col gap-3.5">
        <SignedInRow />

        <div className="border-t border-border-100 pt-3">
          <label className="label" htmlFor="display-name">What the others should call you</label>
          <div className="flex gap-2">
            <input
              id="display-name"
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
      </div>
      <p className="mx-1 text-xs text-ink-500">
        Your plans, recipes and shopping list are shared with everyone else in the household.
      </p>
    </SettingsGroup>
  )
}
