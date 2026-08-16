import { useLocation, NavLink } from 'react-router-dom'
import { CalendarDays, BookOpen, Carrot, ShoppingBasket, BarChart2 } from 'lucide-react'

/** The five screens worth a thumb on a phone; the rest live in the sidebar. */
const NAV = [
  { to: '/',          label: 'Plan',    icon: CalendarDays },
  { to: '/recipes',   label: 'Recipes', icon: BookOpen },
  { to: '/foods',     label: 'Foods',   icon: Carrot },
  { to: '/grocery',   label: 'Grocery', icon: ShoppingBasket },
  { to: '/analytics', label: 'Stats',   icon: BarChart2 },
]

export default function BottomNav() {
  const location = useLocation()
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-sand-200 flex md:hidden z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors
              ${active ? 'text-brand-700' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <Icon size={19} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
