import { NavLink, useLocation } from 'react-router-dom'
import {
  CalendarDays, BookOpen, Carrot, ShoppingBasket, Timer,
  CalendarClock, BarChart2, History, Settings as SettingsIcon, Flame,
} from 'lucide-react'
import { useUserStore } from '../../store/useUserStore'

const NAV = [
  { to: '/',           label: 'Planner',   icon: CalendarDays },
  { to: '/recipes',    label: 'Recipes',   icon: BookOpen },
  { to: '/foods',      label: 'Foods',     icon: Carrot },
  { to: '/grocery',    label: 'Grocery',   icon: ShoppingBasket },
  { to: '/history',    label: 'History',   icon: History },
  { to: '/prep',       label: 'Prep',      icon: Timer },
  { to: '/schedule',   label: 'Schedule',  icon: CalendarClock },
  { to: '/analytics',  label: 'Progress',  icon: BarChart2 },
  { to: '/settings',   label: 'Settings',  icon: SettingsIcon },
]

export default function Sidebar() {
  const location = useLocation()
  const { profile, xpProgress } = useUserStore()
  const progress = xpProgress()

  return (
    <aside className="hidden md:flex w-56 min-h-screen bg-white border-r border-sand-200 flex-col shrink-0">
      <div className="px-4 py-4 border-b border-sand-200">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🫒</span>
          <div>
            <p className="font-extrabold text-stone-800 text-base leading-none">Bite Buddy</p>
            <p className="text-[11px] text-stone-400 font-medium">Mediterranean kitchen</p>
          </div>
        </div>
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

      {profile.showGamification && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-sand-100 border border-sand-200">
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
                Level {profile.level}
              </p>
              <p className="font-bold text-stone-800 text-sm truncate">{profile.name}</p>
            </div>
            {profile.streak > 0 && (
              <span className="badge bg-clay-100 text-clay-700 shrink-0">
                <Flame size={11} /> {profile.streak}
              </span>
            )}
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${progress.progress * 100}%` }} />
          </div>
        </div>
      )}
    </aside>
  )
}
