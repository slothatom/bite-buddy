import {
  CalendarDays, BookOpen, Carrot, ShoppingBasket,
  CalendarClock, BarChart2, Settings as SettingsIcon, Home, Dumbbell,
} from 'lucide-react'

/**
 * Every screen, in one list.
 *
 * The sidebar and the phone's menu are the same nine destinations in two
 * shapes, and they used to be two separate arrays that had already drifted:
 * the sidebar called the planner "Planner" and the phone called it "Plan",
 * and Grocery sat behind a "More" button on one and not the other.
 */
export const NAV = [
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

/** Whether a path is the screen you are on. Home matches only itself. */
export function isCurrent(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}
