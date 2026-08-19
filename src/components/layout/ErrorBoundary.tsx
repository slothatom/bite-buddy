import { Component, type ErrorInfo, type ReactNode } from 'react'
import Zig from '../brand/Mascot'

/**
 * Stops one broken screen from taking down the whole app.
 *
 * Without this, a render error unmounts the tree and leaves a blank white page
 * with no way back — on a phone, with no console open, that is indistinguishable
 * from the app being gone. The recovery offered here is deliberately staged:
 * try the screen again first, and only offer to clear stored data as a last
 * resort, since that discards the user's plans.
 */
interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry to send this to — the app has no backend — so the console
    // is the only place a developer can retrieve it from.
    console.error('Bite Buddy crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen grid place-items-center bg-cream-50 px-6 py-10">
        <div className="card p-6 max-w-md w-full text-center">
          <Zig size={80} mood="oops" className="mx-auto mb-3" />
          <h1 className="display text-lg text-ink-900">Oops — something spilled</h1>
          <p className="text-sm text-ink-700 mt-1">
            This screen tripped over itself. Your recipes and plans are safe.
          </p>

          <pre className="mt-4 text-left text-[11px] font-mono text-ink-700 bg-cream-50 rounded-xl p-3 overflow-x-auto max-h-32">
            {error.message}
          </pre>

          <div className="flex flex-col gap-2 mt-5">
            <button className="btn-primary w-full" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button className="btn-secondary w-full" onClick={() => { window.location.hash = '#/'; this.setState({ error: null }) }}>
              Back to the planner
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
        </div>
      </div>
    )
  }
}
