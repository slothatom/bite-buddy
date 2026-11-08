import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { IconTile, SettingsGroup, Switch } from './SettingsList'
import {
  currentState, deviceLabel, disable, enable, readWants, writeWants, WANTS_ALL,
  type PushState, type Wants,
} from '../../lib/push'

/**
 * Whether the shared copy is actually receiving anything.
 *
 * Saving is two separate things: writing to this device, which the banner at
 * the top reports when it fails, and reaching the copy the other person reads.
 * The second one can be refused indefinitely by a database policy while the app
 * carries on looking perfectly healthy, and the only honest way to tell is to
 * put the state and the server's own words on a screen you can go and look at.
 */
/**
 * Being told something while the app is closed.
 *
 * Per device, deliberately, and the screen says so. Notifications are the one
 * setting in this app that is not shared: the profile syncs, so putting this
 * there would mean switching them off on your phone switched them off on
 * theirs. Two people, two phones, two answers.
 *
 * Four ways this is unavailable and each says which, because "notifications
 * are unavailable" sends people to the wrong place. A browser that cannot do
 * it at all, a household with no key set up, a permission already refused, and
 * simply not on yet are four different problems with four different fixes, and
 * only one of them is the person's to solve.
 */
export function NotificationsPanel() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Which of the two you want. Read once the panel knows there is anything to
  // want: asking the database before that would be a query on every visit to
  // Settings for a household that has never set a signing key up.
  const [wants, setWants] = useState<Wants>(WANTS_ALL)

  // A rejection here used to leave the panel invisible for ever, because the
  // section rendered nothing until this resolved. A screen that says nothing
  // is indistinguishable from a feature that was never deployed, which is
  // exactly the wrong thing for a panel whose job is explaining why something
  // is not working.
  useEffect(() => {
    currentState()
      .then(setState)
      .catch((e: Error) => {
        setState({ kind: 'off' })
        setMessage(`Could not work out where this device stands: ${e.message}`)
      })
    // Failing to read them is not worth a message: both on is what the sender
    // does with a member who has no row, so the panel showing both on is the
    // truth either way.
    readWants().then(setWants).catch(() => {})
  }, [])

  async function choose(next: Wants) {
    const before = wants
    // Moved first so the switch answers the thumb. Put back if the write is
    // refused, which is the only way a switch can lie about what it set.
    setWants(next)
    const result = await writeWants(next)
    if (!result.ok) {
      setWants(before)
      setMessage(`Could not save that: ${result.reason}`)
    } else {
      setMessage(null)
    }
  }

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    const result = await enable()
    setMessage(result.ok ? null : result.reason)
    setState(await currentState())
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    setMessage(null)
    await disable()
    setState(await currentState())
    setBusy(false)
  }

  const live = state?.kind === 'off' || state?.kind === 'on'

  return (
    <div className="flex flex-col gap-3.5">
      <section
        aria-label="This phone"
        className="bg-paper border border-border-200 rounded-card p-3.5 flex flex-col gap-2"
      >
        <div className="flex items-center gap-3">
          <IconTile icon={Bell} />
          <span id="reminders-device" className="flex-1 text-[15px] leading-5 font-extrabold text-ink-900">
            Reminders on this phone
          </span>
          {live && (
            <Switch
              checked={state.kind === 'on'}
              labelledBy="reminders-device"
              disabled={busy}
              onChange={(on) => void (on ? turnOn() : turnOff())}
            />
          )}
        </div>

        {state === null && (
          <p className="text-sm text-ink-700">Checking this phone.</p>
        )}

        {state?.kind === 'unsupported' && (
          <p className="text-sm text-ink-700">This browser cannot show notifications.</p>
        )}

        {state?.kind === 'unconfigured' && (
          <p className="text-sm text-ink-700">
            No signing key has been set up for this household yet, so there is nothing to switch
            on. It is one line in the SQL editor, and the README has it.
          </p>
        )}

        {state?.kind === 'blocked' && (
          <p className="text-sm text-ink-700">
            This site is set to block notifications in your browser. The app cannot undo that, and
            asking again would do nothing: it has to be changed in the browser's own settings for
            this site.
          </p>
        )}

        {live && (
          <div className="flex items-center gap-2 flex-wrap">
            {state.kind === 'on' ? (
              <span className="badge bg-leaf-50 text-leaf-700">
                <Check size={14} aria-hidden="true" /> On, for your {deviceLabel()}
              </span>
            ) : (
              <span className="badge bg-border-100 text-ink-700">Off on this phone</span>
            )}
            <span className="text-xs text-ink-700">Every phone has its own switch.</span>
          </div>
        )}
      </section>

      {/* Which of the two, once there is anything to receive them. Hidden
          while push is unsupported, unconfigured or blocked, where the
          switches would be two controls over something that cannot happen. */}
      {live && (
        <SettingsGroup id="reminders-what" title="What to send" aside="Follows you to any phone">
          <ul
            aria-labelledby="reminders-what"
            className="bg-paper border border-border-200 rounded-card overflow-hidden divide-y divide-border-100"
          >
            <Wanted
              id="reminders-cook"
              label="Before a cooking session"
              note="A couple of hours before something you planned to cook."
              on={wants.cook}
              onChange={(on) => void choose({ ...wants, cook: on })}
            />
            <Wanted
              id="reminders-plan"
              label="When the other one of you changes the week"
              note="One line once the change settles, not one per meal."
              on={wants.plan}
              onChange={(on) => void choose({ ...wants, plan: on })}
            />
          </ul>
          {!wants.cook && !wants.plan && state.kind === 'on' && (
            <p className="mx-1 text-xs text-ink-700">
              Both off, so this phone is subscribed and will never be sent anything. That is a
              fine way to leave it, and turning the switch above off is the tidier one.
            </p>
          )}
        </SettingsGroup>
      )}

      {message && <p role="status" className="mx-1 text-sm text-coral-600">{message}</p>}

      <p className="mx-1 text-center text-xs text-ink-500">
        Two kinds of reminder and nothing else, never more than one at a time for the same thing.
        On Android they are more reliable once the app is on your home screen.
      </p>
    </div>
  )
}

/** One kind of reminder, on or off, named by its label. */
function Wanted({
  id, label, note, on, onChange,
}: {
  id: string
  label: string
  note: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 pl-3.5 pr-2.5">
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span id={id} className="text-[15px] leading-5 font-bold text-ink-900">{label}</span>
        <span className="text-xs text-ink-700">{note}</span>
      </span>
      <Switch checked={on} onChange={onChange} labelledBy={id} />
    </li>
  )
}
