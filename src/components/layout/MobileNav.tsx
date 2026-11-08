import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Plus, X } from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import { useUiStore } from '../../store/useUiStore'
import { today } from '../../store/useMealPlanStore'
import { Wordmark } from '../brand/Mascot'
import { MORE, TABS, isCurrent } from './nav'

/**
 * The phone's navigation: a tab bar along the bottom, in reach of the thumb.
 *
 * Home, Plan and Recipes are where most visits go, so they sit on the bar.
 * Adding a meal is in the centre, because it is the thing this app is most
 * often opened to do and it is an action rather than a destination. Everything
 * else lives behind More, in the order the sidebar uses.
 *
 * The top bar keeps only the wordmark. The menu button that used to live there
 * was the far corner of the screen from a thumb holding the phone.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const requestQuickAdd = useUiStore((s) => s.requestQuickAdd)

  function quickAdd() {
    // Today, always. The button should not depend on where another screen was
    // left, and the planner's window follows the day rather than the reverse.
    requestQuickAdd(today())
    navigate('/plan')
  }

  // More reads as current while you are on one of the screens it holds, so the
  // bar always says where you are.
  const inMore = MORE.some(({ to }) => isCurrent(to, pathname))

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 flex items-center px-4 h-14
                   bg-paper/95 backdrop-blur border-b border-border-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Wordmark />
      </header>

      <nav
        aria-label="Main"
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-paper border-t border-border-200 shadow-e2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5 items-stretch h-16">
          {TABS.slice(0, 2).map((tab) => (
            <li key={tab.to}><Tab {...tab} current={isCurrent(tab.to, pathname)} /></li>
          ))}
          <li className="flex items-center justify-center">
            <button
              onClick={quickAdd}
              aria-label="Add a meal"
              className="flex items-center justify-center w-14 h-14 -mt-3 rounded-full
                         bg-bite-500 text-on-brand shadow-e2 active:scale-95 transition-transform"
            >
              <Plus size={26} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </li>
          {TABS.slice(2).map((tab) => (
            <li key={tab.to}><Tab {...tab} current={isCurrent(tab.to, pathname)} /></li>
          ))}
          <li>
            <button
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className={tabClass(inMore)}
            >
              <MoreHorizontal size={22} aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {open && <MoreSheet onClose={() => setOpen(false)} pathname={pathname} />}
    </>
  )
}

/** One slot on the bar: icon over a word, the full slot tappable. */
function tabClass(current: boolean): string {
  return `flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-11
          text-xs font-bold transition-colors duration-150
          ${current ? 'text-bite-700' : 'text-ink-700'}`
}

function Tab({ to, label, icon: Icon, current }: {
  to: string
  label: string
  icon: (typeof TABS)[number]['icon']
  current: boolean
}) {
  return (
    <NavLink to={to} className={tabClass(current)} aria-current={current ? 'page' : undefined}>
      {/* The current tab is told by a filled pill behind the icon as well as
          by colour, so it does not depend on hue alone. */}
      <span className={`flex items-center justify-center h-7 w-12 rounded-full ${current ? 'bg-bite-100' : ''}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      {label}
    </NavLink>
  )
}

/**
 * The rest of the screens, as a sheet from the bottom.
 *
 * From the bottom because the button that opens it is there. Escape closes it,
 * Tab stays inside it, and focus goes back to More, the same manners every
 * other dialog in the app has.
 */
function MoreSheet({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  const panel = useDialog<HTMLDivElement>(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-ink-900/40 backdrop-blur-xs md:hidden"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="bg-paper w-full rounded-t-card flex flex-col shadow-e3 max-h-[85vh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-border-200">
          <h2 className="text-lg font-extrabold">More</h2>
          <button className="btn-ghost btn-icon text-ink-700" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="More screens" className="overflow-y-auto px-3 py-3 space-y-0.5">
          {MORE.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={isCurrent(to, pathname) ? 'nav-item-active' : 'nav-item'}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
