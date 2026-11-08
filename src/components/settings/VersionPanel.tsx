import { useState } from 'react'
import { SectionHeading } from '../ui'

/**
 * Which build this is.
 *
 * The app is served from the device by a service worker, so a deploy and the
 * thing on your screen are two different questions. This answers the second
 * one: if the commit here matches the one that was deployed, you are looking at
 * the new version. If it does not, "Check now" fetches the worker again, and
 * if there is a newer one, the page reloads itself onto it.
 */
export function VersionPanel() {
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)

  async function check() {
    setChecking(true)
    setChecked(false)
    try {
      const registration = await navigator.serviceWorker?.ready
      await registration?.update()
    } catch {
      // No worker here, nothing to check, and nothing that can be stale.
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }

  return (
    <section>
      <SectionHeading>This version</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          Build <strong className="font-mono text-ink-900">{__BUILD_SHA__}</strong>, made{' '}
          {new Date(__BUILD_TIME__).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}.
        </p>
        <p className="text-xs text-ink-500">
          The app is kept on your device so it works without a signal, which means a new version
          arrives quietly in the background. It swaps itself in the next time you open it.
        </p>
        <button className="btn-secondary w-fit" onClick={() => void check()} disabled={checking}>
          {checking ? 'Checking…' : checked ? 'Up to date' : 'Check now'}
        </button>
      </div>
    </section>
  )
}
