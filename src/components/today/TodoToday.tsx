import { Link } from 'react-router-dom'
import { ChevronRight, Clock, CookingPot, Scale, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TodoItem {
  id: string
  icon: 'cook' | 'grocery' | 'fridge' | 'weight'
  eyebrow: string
  title: string
  /** A second line, shown where there is room for it. */
  detail?: string
  to: string
}

const ICONS: Record<TodoItem['icon'], { icon: LucideIcon; tone: string }> = {
  cook: { icon: Clock, tone: 'text-mustard-700' },
  grocery: { icon: ShoppingCart, tone: 'text-bite-700' },
  fridge: { icon: CookingPot, tone: 'text-leaf-700' },
  weight: { icon: Scale, tone: 'text-ink-700' },
}

/**
 * The things the rest of the app has waiting for you today, each a way
 * through to the screen that does it. Two to a row on the phone, a list with
 * room for a second line on a wide screen.
 */
export default function TodoToday({ items }: { items: TodoItem[] }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="todo-h" className="flex flex-col gap-1.5 xl:gap-2">
      <h2 id="todo-h" className="text-base leading-6 font-extrabold text-ink-900">To do today</h2>
      <ul className="grid grid-cols-2 gap-2 xl:block xl:bg-paper xl:border xl:border-border-200 xl:rounded-card xl:overflow-hidden">
        {items.map((item) => {
          const { icon: Icon, tone } = ICONS[item.icon]
          return (
            <li key={item.id} className="min-w-0 xl:border-t xl:border-border-100 xl:first:border-t-0">
              <Link
                to={item.to}
                className="h-full min-h-11 flex flex-col xl:flex-row xl:items-center gap-1 xl:gap-3 p-3 xl:px-4
                           bg-paper border border-border-200 rounded-lg xl:border-0 xl:rounded-none
                           hover:border-bite-300 xl:hover:bg-bite-50 transition-colors"
              >
                <span aria-hidden="true" className={`hidden xl:flex w-9 h-9 rounded-md bg-cream-50 items-center justify-center shrink-0 ${tone}`}>
                  <Icon size={18} />
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1 xl:gap-0">
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${tone}`}>
                    <Icon size={14} aria-hidden="true" className="xl:hidden shrink-0" />
                    <span className="truncate">{item.eyebrow}</span>
                  </span>
                  <span className="text-sm font-bold text-ink-900 truncate">{item.title}</span>
                  {item.detail && <span className="hidden xl:block text-xs text-ink-700 truncate">{item.detail}</span>}
                </span>
                <ChevronRight size={18} aria-hidden="true" className="hidden xl:block text-ink-300 shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
