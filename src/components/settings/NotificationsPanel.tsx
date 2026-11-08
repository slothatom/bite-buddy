import { useEffect, useState } from 'react'
import { SectionHeading } from '../ui'
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

  return (
    <section>
      <SectionHeading>Notifications</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          Two things, and nothing else. Never more than one at a time for the same thing.
        </p>

        {state === null && (
          <p className="text-sm text-ink-500">Checking this device.</p>
        )}

        {state?.kind === 'unsupported' && (
          <p className="text-sm text-ink-500">This browser cannot show notifications.</p>
        )}

        {state?.kind === 'unconfigured' && (
          <p className="text-sm text-ink-500">
            No signing key has been set up for this household yet, so there is nothing to switch
            on. It is one line in the SQL editor, and the README has it.
          </p>
        )}

        {state?.kind === 'blocked' && (
          <p className="text-sm text-ink-500">
            This site is set to block notifications in your browser. The app cannot undo that, and
            asking again would do nothing: it has to be changed in the browser's own settings for
            this site.
          </p>
        )}

        {(state?.kind === 'off' || state?.kind === 'on') && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={state.kind === 'on' ? 'btn-secondary' : 'btn-primary'}
              onClick={state.kind === 'on' ? turnOff : turnOn}
              disabled={busy}
            >
              {state.kind === 'on' ? 'Turn off on this device' : 'Turn on for this device'}
            </button>
            <span className="text-sm text-ink-500">
              {state.kind === 'on' ? `On, for your ${deviceLabel()}.` : 'Off on this device.'}
            </span>
          </div>
        )}

        {/* Which of the two, once there is anything to receive them. Hidden
            while push is unsupported, unconfigured or blocked, where the
            switches would be two controls over something that cannot happen. */}
        {(state?.kind === 'off' || state?.kind === 'on') && (
          <div className="border-t border-border-100 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
              What to send
            </p>
            <Wanted
              label="Before a cooking session"
              note="A couple of hours before something you have scheduled to cook."
              on={wants.cook}
              onChange={(on) => void choose({ ...wants, cook: on })}
            />
            <Wanted
              label="When the other one of you changes the week"
              note="One line, after the change settles, rather than one per meal moved."
              on={wants.plan}
              onChange={(on) => void choose({ ...wants, plan: on })}
            />
            {!wants.cook && !wants.plan && state.kind === 'on' && (
              <p className="text-xs text-ink-700">
                Both off, so this device is subscribed and will never be sent anything. That is a
                fine way to leave it, and turning the switch above off is the tidier one.
              </p>
            )}
          </div>
        )}

        {message && <p className="text-sm text-coral-600">{message}</p>}

        <p className="text-xs text-ink-500">
          The switch above is per device, because a phone is what gets notified, and turning it on
          here does nothing to the other one. What to send is per person and follows you to any
          device you sign in on. On Android notifications are more reliable once the app has been
          added to the home screen.
        </p>
      </div>
    </section>
  )
}

/**
 * One kind of notification, on or off.
 *
 * A checkbox rather than a styled toggle: it is a real one under the label, so
 * it is reachable by keyboard, announced as a checkbox, and toggled by tapping
 * anywhere on the row rather than on a 20px switch.
 */
function Wanted({
  label, note, on, onChange,
}: {
  label: string
  note: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 w-5 h-5 shrink-0 accent-bite-500"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{note}</span>
      </span>
    </label>
  )
}
