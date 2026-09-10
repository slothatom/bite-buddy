import { useEffect, useRef, type ReactNode } from 'react'
import { Sidebar } from 'bite-buddy'

/**
 * Puts the router on a screen by pressing the link for it.
 *
 * The preview shell mounts one MemoryRouter at "/" and a second router cannot
 * be nested inside it, so the only honest way to show another screen selected
 * is to follow the sidebar's own link.
 */
function On({ path, children }: { path: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)?.click()
  }, [path])
  return <div ref={ref} style={{ display: 'flex', height: 520, overflow: 'hidden' }}>{children}</div>
}

/** The resting state: nine screens, Home current. */
export function AtHome() {
  return (
    <div style={{ display: 'flex', height: 520, overflow: 'hidden' }}>
      <Sidebar />
    </div>
  )
}

/** On the planner, which is where the app is open most of the time. */
export function OnThePlanner() {
  return (
    <On path="/plan">
      <Sidebar />
    </On>
  )
}

/**
 * Progress selected, where the label and the route disagree.
 *
 * The screen is /analytics and the word in the list is "Progress", so the
 * highlight is the only thing tying the two together.
 */
export function OnProgress() {
  return (
    <On path="/analytics">
      <Sidebar />
    </On>
  )
}

/**
 * Beside the screen it borders.
 *
 * The column is 14rem of cream with one hairline down its right edge, and how
 * quiet that division is only reads with a page next to it.
 */
export function BesideTheScreen() {
  return (
    <On path="/grocery">
      <Sidebar />
      <main className="flex-1 bg-paper px-6 py-5">
        <h1 className="display text-xl text-ink-900">Grocery</h1>
        <p className="text-sm text-ink-700 mt-1">
          Everything this week needs that the cupboard does not already cover.
        </p>
        <div className="card p-4 mt-4">
          <p className="text-sm text-ink-900">Telemea, 400 g</p>
          <p className="text-xs text-ink-500 mt-0.5">Thursday dinner, Saturday breakfast</p>
        </div>
      </main>
    </On>
  )
}
