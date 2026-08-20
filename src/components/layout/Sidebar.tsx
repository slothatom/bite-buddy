import { NavLink, useLocation } from 'react-router-dom'
import {
  CalendarDays, BookOpen, Carrot, ShoppingBasket,
  CalendarClock, BarChart2, Settings as SettingsIcon, Home, Dumbbell,
} from 'lucide-react'
import { Wordmark } from '../brand/Mascot'

const NAV = [
  { to: '/',           label: 'Home',      icon: Home },
  { to: '/plan',       label: 'Planner',   icon: CalendarDays },
  { to: '/recipes',    label: 'Recipes',   icon: BookOpen },
  { to: '/foods',      label: 'Foods',     icon: Carrot },
  { to: '/grocery',    label: 'Grocery',   icon: ShoppingBasket },
  { to: '/schedule',   label: 'Schedule',  icon: CalendarClock },
  { to: '/movement',   label: 'Movement',  icon: Dumbbell },
  { to: '/analytics',  label: 'Progress',  icon: BarChart2 },
  { to: '/settings',   label: 'Settings',  icon: SettingsIcon },
]

export default function Sidebar() {
  const location = useLocation()


  return (
    <aside className="hidden md:flex w-56 min-h-screen bg-cream-50 border-r border-border-200 flex-col shrink-0">
      <div className="px-4 py-4 border-b border-border-200">
        <Wordmark />
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} className={active ? 'nav-item-active' : 'nav-item'}>
              <Icon size={17} />
              {label}
            </NavLink>
          )
        })}
      </nav>

    </aside>
  )
}
