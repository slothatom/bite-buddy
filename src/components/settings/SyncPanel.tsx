import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { SectionHeading } from '../ui'
import { useSyncStatus } from '../../store/useSync'
import { probeSaving, type ProbeStep } from '../../lib/rows/probe'

export function SyncPanel() {
  const { state, at, unsaved, lastError } = useSyncStatus()

  const summary =
    state === 'live' && !unsaved ? 'Everything on this device has reached the shared copy.'
    : state === 'connecting' ? 'Connecting.'
    // Rows, not stores: `owedRows` counts the individual changes, and calling
    // twenty-one emptied shopping list lines "21 stores" was nonsense.
    : unsaved ? `${unsaved} ${unsaved === 1 ? 'change is' : 'changes are'} waiting to go up.`
    : state === 'error' ? 'The last attempt was turned down.'
    : 'Not syncing. This device is working on its own.'

  return (
    <section>
      <SectionHeading>Sharing</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">{summary}</p>

        <dl className="text-xs space-y-1.5">
          <Row label="State" value={state} />
          <Row label="Last agreed" value={at ? at.toLocaleTimeString('en-GB') : 'not yet'} />
          <Row label="Waiting" value={String(unsaved)} />
          {lastError && <Row label="Server said" value={lastError} />}
        </dl>

        <SavingCheck />

        {lastError ? (
          <p className="text-xs text-ink-500">
            Whatever this says is the reason, and it is worth reading out to whoever can change it.
            A message about a policy or a permission means the database is refusing this account
            rather than anything being wrong with what you typed. Nothing has been lost: it is all
            still on this device, and it keeps trying.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Writes a row, reads it back, deletes it, and says which of those worked.
 *
 * Every version of this failure has looked identical from the outside: the
 * things you typed are not there. Underneath they were four separate problems,
 * and telling them apart meant somebody with a database and a lot of guessing.
 * A person who can press a button and read four lines does not need either.
 */
function SavingCheck() {
  const [steps, setSteps] = useState<ProbeStep[] | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setSteps(null)
    try {
      setSteps(await probeSaving())
    } catch (e) {
      setSteps([{ what: 'The check itself failed', ok: false, detail: (e as Error).message }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="pt-1 space-y-2">
      <button className="btn-secondary" onClick={() => void run()} disabled={running}>
        {running ? 'Checking…' : 'Check saving'}
      </button>

      {steps && (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.what} className="flex items-start gap-2 text-xs">
              {step.ok
                ? <Check size={13} className="shrink-0 mt-0.5 text-leaf-600" />
                : <X size={13} className="shrink-0 mt-0.5 text-coral-600" />}
              <span className="flex-1 min-w-0">
                <span className={step.ok ? 'text-ink-700' : 'text-coral-700 font-semibold'}>{step.what}</span>
                {step.detail ? (
                  <span className="block text-ink-500 font-mono break-words">{step.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {steps?.every((s) => s.ok) && (
        <p className="text-xs text-leaf-700">
          Saving works. What you enter here reaches the other phone.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="flex-1 min-w-0 font-mono text-ink-900 break-words">{value}</dd>
    </div>
  )
}
