import { Link, useLocation } from 'react-router-dom'
import type { SectionTab } from './nav'

/**
 * The segmented control at the top of Plan, Recipes and Progress.
 *
 * Links rather than ARIA tabs: each tab is its own address, so a deep link, a
 * notification and the back gesture all land on the right one, and the
 * current one says so with `aria-current="page"`. Full width on a phone, where
 * the segments share the screen; as wide as its words from md up.
 *
 * `counts` puts a number after a label ("Grocery · 6"), keyed by the tab's
 * path, for the screens that know one.
 */
export default function SectionTabs({ label, tabs, counts }: {
  label: string
  tabs: readonly SectionTab[]
  counts?: Partial<Record<string, number>>
}) {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label={label}
      data-print-hide
      className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-border-100 rounded-lg md:inline-grid md:auto-cols-auto"
    >
      {tabs.map(({ to, label: name }) => {
        const on = pathname === to
        const count = counts?.[to]
        return (
          <Link
            key={to}
            to={to}
            aria-current={on ? 'page' : undefined}
            className={on ? 'segment-on' : 'segment-off'}
          >
            {name}
            {count ? <span>{` · ${count}`}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
