import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Plus, X } from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import { useUiStore } from '../../store/useUiStore'
import { today } from '../../store/useMealPlanStore'
import { Wordmark } from '../brand/Mascot'
import { NAV, isCurrent } from './nav'

/**
 * The phone's navigation: a bar at the top with a menu behind it.
 *
 * What this replaces was five slots along the bottom, four of them
 * destinations and the fifth a "More" button opening a grid of six icons. Nine
 * screens split across two places by nothing more principled than how many fit
 * on a bar, so Grocery was two taps and three levels deep while Recipes was
 * one, and the split had already drifted from the sidebar's own list.
 *
 * One menu, every screen in it, in the order the sidebar uses. Nothing is
 * hidden behind a second tier and nothing rearranges itself as you use it: a
 * menu whose items move is a menu you have to read every time.
 *
 * Adding a meal stays on the bar. It is the thing this app is most often
 * opened to do and it is an action rather than a destination, so it has no
 * business inside a list of screens.
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

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-2 h-14
                   bg-paper/95 backdrop-blur border-b border-border-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* A navigation landmark, even though it is one button: on a phone
            this bar is the whole of the app's navigation, and a screen reader
            listing landmarks should find it where it finds the sidebar on a
            laptop. Without it a phone had no nav landmark at all until the
            drawer was already open. */}
        <nav aria-label="Main" className="shrink-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Menu"
            aria-expanded={open}
            className="btn-ghost btn-icon text-ink-700"
          >
            <Menu size={22} />
          </button>
        </nav>

        <div className="flex-1 min-w-0">
          <Wordmark />
        </div>

        <button
          onClick={quickAdd}
          aria-label="Add a meal"
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-bite-500 text-white
                     font-bold text-sm px-3.5 h-10 active:scale-95 transition-transform"
        >
          <Plus size={18} strokeWidth={2.6} /> Meal
        </button>
      </header>

      {open && <Drawer onClose={() => setOpen(false)} pathname={pathname} />}
    </>
  )
}

/**
 * The menu itself, over the screen from the left.
 *
 * From the left because the button that opens it is there, and a panel that
 * arrives from the opposite side of the thumb that summoned it reads as a
 * different thing happening.
 */
function Drawer({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  // Escape closes it, Tab stays inside it, focus goes back to the button that
  // opened it, and the page behind holds still. The same four manners every
  // other dialog in the app has.
  const panel = useDialog<HTMLDivElement>(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex bg-ink-900/40 backdrop-blur-xs md:hidden"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="bg-paper w-72 max-w-[85vw] h-full flex flex-col shadow-e3"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-border-200">
          <Wordmark />
          <button className="btn-ghost btn-icon text-ink-500" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
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
