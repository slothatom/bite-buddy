import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SECTIONS, isCurrent, isSettings, type NavSection } from './nav'
import { useQuickAdd } from './useQuickAdd'

/**
 * The phone's navigation: a bar along the bottom, in reach of the thumb.
 *
 * Today · Plan · + · Recipes · Progress. Every screen in the app is one tap
 * from here or a tab inside one of these, so there is no More sheet. Adding
 * food sits in the centre because it is the thing this app is most often
 * opened to do, and it is an action rather than a place.
 *
 * Settings screens have no bar: they are a detour with a back arrow, and the
 * bar would suggest you had gone somewhere new.
 */
export default function BottomNav() {
  const { pathname } = useLocation()
  const quickAdd = useQuickAdd()

  if (isSettings(pathname)) return null

  return (
    <nav
      aria-label="Main"
      data-print-hide
      className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-paper border-t border-border-200 shadow-e2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 items-center h-18">
        {SECTIONS.slice(0, 2).map((s) => (
          <li key={s.to}><Tab section={s} current={isCurrent(s.base, pathname)} /></li>
        ))}
        <li className="flex items-center justify-center">
          <button
            type="button"
            onClick={quickAdd}
            aria-label="Add to today"
            className="flex items-center justify-center w-14 h-14 rounded-full
                       bg-bite-500 text-on-brand shadow-e2 active:scale-95 transition-transform"
          >
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </li>
        {SECTIONS.slice(2).map((s) => (
          <li key={s.to}><Tab section={s} current={isCurrent(s.base, pathname)} /></li>
        ))}
      </ul>
    </nav>
  )
}

/** One place on the bar: icon over a word, the whole cell tappable. */
function Tab({ section: { to, label, icon: Icon }, current }: { section: NavSection; current: boolean }) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 w-full min-h-14 text-xs
                  transition-colors duration-150
                  ${current ? 'text-bite-700 font-extrabold' : 'text-ink-700 font-bold'}`}
    >
      {/* The current place is told by a filled pill behind the icon as well
          as by colour and weight, so it does not depend on hue alone. */}
      <span className={`flex items-center justify-center px-3.5 py-[3px] rounded-full ${current ? 'bg-bite-100' : ''}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      {label}
    </Link>
  )
}
