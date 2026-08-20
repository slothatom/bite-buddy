import { useState } from 'react'
import { useLocation, NavLink, useNavigate } from 'react-router-dom'
import {
  CalendarDays, BookOpen, ShoppingBasket, Plus, MoreHorizontal,
  Carrot, CalendarClock, BarChart2, Settings as SettingsIcon, X, Dumbbell,
  Home as HomeIcon,
} from 'lucide-react'
import { useUiStore } from '../../store/useUiStore'

/**
 * The phone navigation: Home · Plan · + · Recipes · More.
 *
 * Only four destinations sit on the bar because the centre slot is the
 * creation action, the thing most often reached for one-handed. Grocery moved
 * behind More when Home arrived: it is a once-a-week screen you open at the
 * shop, where Recipes is browsed daily.
 */
const PRIMARY = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
]

const SECONDARY = [
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
]

const MORE = [
  { to: '/grocery', label: 'Grocery', icon: ShoppingBasket },
  { to: '/foods', label: 'Foods', icon: Carrot },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/movement', label: 'Movement', icon: Dumbbell },
  { to: '/analytics', label: 'Progress', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { requestQuickAdd } = useUiStore()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const moreActive = MORE.some((m) => isActive(m.to))

  function quickAdd() {
    requestQuickAdd()
    navigate('/plan')
  }

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur border-t border-border-200 flex md:hidden z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {PRIMARY.map(({ to, label, icon: Icon }) => (
          <Item key={to} to={to} label={label} Icon={Icon} active={isActive(to)} />
        ))}

        {/* The centre action sits proud of the bar so it reads as the primary
            thing to do, while staying inside thumb reach. */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={quickAdd}
            aria-label="Add a meal"
            className="relative -top-4 w-14 h-14 rounded-full bg-bite-500 text-white
                       grid place-items-center shadow-e2 border-4 border-cream-50
                       active:scale-95 transition-transform"
          >
            <Plus size={24} strokeWidth={2.6} />
          </button>
        </div>

        {SECONDARY.map(({ to, label, icon: Icon }) => (
          <Item key={to} to={to} label={label} Icon={Icon} active={isActive(to)} />
        ))}

        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-bold
            ${moreActive ? 'text-bite-600' : 'text-ink-500'}`}
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} isActive={isActive} />}
    </>
  )
}

function Item({
  to, label, Icon, active,
}: {
  to: string
  label: string
  Icon: typeof CalendarDays
  active: boolean
}) {
  return (
    <NavLink
      to={to}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-bold transition-colors
        ${active ? 'text-bite-600' : 'text-ink-500'}`}
    >
      <Icon size={20} strokeWidth={active ? 2.6 : 2} />
      {label}
    </NavLink>
  )
}

function MoreSheet({
  onClose, isActive,
}: {
  onClose: () => void
  isActive: (to: string) => boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink-900/40 backdrop-blur-xs md:hidden" onClick={onClose}>
      <div
        className="bg-paper w-full rounded-t-3xl p-5 shadow-e3"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="display text-lg text-ink-900">More</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {MORE.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 text-xs font-bold transition-colors
                ${isActive(to)
                  ? 'bg-bite-500 text-white border-bite-500'
                  : 'bg-cream-50 text-ink-700 border-transparent hover:border-bite-300'}`}
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
