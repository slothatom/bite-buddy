import { Component, type ErrorInfo, type ReactNode } from 'react'
import Zig from '../brand/Mascot'
import { backupFilename, createBackup } from '../../lib/backup'
import { saveTextFile } from '../../lib/download'

/**
 * Stops one broken screen from taking down the whole app.
 *
 * Without this, a render error unmounts the tree and leaves a blank white page
 * with no way back, on a phone, with no console open, which is
 * indistinguishable from the app being gone.
 *
 * What is offered here matters more than it looks, because of what the
 * commonest crash actually is. It is not a bug in a screen: it is a chunk that
 * no longer exists on the server, because a deploy landed under an open page.
 * "Try again" re-rendered the same lazy screen, which re-requested the same
 * missing module, which the browser had already recorded as failed, so it
 * failed instantly and identically every time. From the outside the button did
 * nothing, and the only thing on the screen that visibly *did* something was
 * "Reset all saved data", in red, directly underneath: an offer to delete
 * every plan and recipe in answer to a routine error.
 *
 * So the order is inverted. Reloading is first, because it is the fix for the
 * common case and harmless in every other. Throwing your data away is last,
 * behind a disclosure, behind a backup, and behind a confirmation that says
 * what goes.
 */
interface Props { children: ReactNode }
interface State { error: Error | null; showing: 'nothing' | 'details' | 'last-resort' }

/**
 * A reload that cannot be served the same stale page again.
 *
 * Dropping the caches first is what separates this from the browser's own
 * refresh button: the worker would otherwise hand back the very document whose
 * chunks have gone missing.
 */
async function reloadClean(): Promise<void> {
  try {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
  } catch {
    // A browser that will not let us clear caches still gets a reload, which
    // is what the user asked for by pressing the button.
  }
  window.location.reload()
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, showing: 'nothing' }

  static getDerivedStateFromError(error: Error): State {
    return { error, showing: 'nothing' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry to send this to, the app has no backend, so the console
    // is the only place a developer can retrieve it from.
    console.error('Bite Buddy crashed:', error, info.componentStack)
  }

  render() {
    const { error, showing } = this.state
    if (!error) return this.props.children

    // Said plainly and without the exception text, which names a file nobody
    // reading this screen has ever heard of and reads like something is
    // seriously wrong when usually nothing is.
    const stale = /dynamically imported module|Importing a module script failed|Failed to fetch/i
      .test(error.message)

    return (
      <div className="min-h-screen grid place-items-center bg-cream-50 px-6 py-10">
        <div className="card p-6 max-w-md w-full text-center">
          <Zig size={80} mood="oops" className="mx-auto mb-3" />
          <h1 className="display text-lg text-ink-900">
            {stale ? 'There is a newer version' : 'Oops, something spilled'}
          </h1>
          <p className="text-sm text-ink-700 mt-1">
            {stale
              ? 'This page is running an older copy of the app and could not load that screen. Reloading picks up the new one. Nothing you have entered is affected.'
              : 'This screen tripped over itself. Your recipes and plans are safe.'}
          </p>

          <div className="flex flex-col gap-2 mt-5">
            <button className="btn-primary w-full" onClick={() => void reloadClean()}>
              Reload the app
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => { window.location.hash = '#/'; this.setState({ error: null }) }}
            >
              Back to the planner
            </button>
          </div>

          <button
            className="btn-ghost text-xs text-ink-500 mt-3"
            onClick={() => this.setState({
              showing: showing === 'nothing' ? 'details' : 'nothing',
            })}
          >
            {showing === 'nothing' ? 'Still broken?' : 'Never mind'}
          </button>

          {showing !== 'nothing' && (
            <div className="mt-3 space-y-3 text-left">
              <pre className="text-[11px] font-mono text-ink-700 bg-cream-50 rounded-xl p-3 overflow-x-auto max-h-32">
                {error.message}
              </pre>

              {/* A copy of everything, before offering to delete everything.
                  The order is the whole point of this section. */}
              <button
                className="btn-secondary w-full"
                onClick={() => void saveTextFile(backupFilename(), JSON.stringify(createBackup(), null, 2))}
              >
                Download a backup first
              </button>

              <button
                className="btn-ghost w-full text-coral-600 text-xs"
                onClick={() => {
                  if (!confirm('Delete all locally stored plans, recipes and settings? This cannot be undone.')) return
                  for (const key of Object.keys(localStorage)) {
                    if (key.startsWith('bite-buddy-')) localStorage.removeItem(key)
                  }
                  window.location.reload()
                }}
              >
                Reset all saved data
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
