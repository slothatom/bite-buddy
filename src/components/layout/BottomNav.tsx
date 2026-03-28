import { useLocation, NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ShoppingCart, Timer, BarChart2 } from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Plan',     icon: LayoutDashboard },
  { to: '/recipes',   label: 'Recipes',  icon: BookOpen },
  { to: '/grocery',   label: 'Grocery',  icon: ShoppingCart },
  { to: '/prep',      label: 'Prep',     icon: Timer },
  { to: '/analytics', label: 'Stats',    icon: BarChart2 },
]

export default function BottomNav() {
  const location = useLocation()
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex md:hidden z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors
              ${active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Icon size={19} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
