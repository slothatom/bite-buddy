import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SectionTabs from '../layout/SectionTabs'
import { SECTION_TABS } from '../layout/nav'
import { useMealPlanStore } from '../../store/useMealPlanStore'

export interface WeekNav {
  label: string
  onPrev: () => void
  onNext: () => void
  /** What the arrows step by, for their names: "Previous week". */
  unit: string
}

/**
 * The top of every Plan screen: the title, the three tabs, and the week.
 *
 * The section title and its tabs live inside the screen rather than above it,
 * as the design draws them, so each Plan screen renders this instead of being
 * wrapped in the shared section layout. On a phone the week sits beside the
 * title and the tabs fill the row under it; from md up the title row carries
 * the screen's main actions and the week sits beside the tabs.
 *
 * The Grocery tab counts what is left to buy, which is the one number worth
 * seeing from the other two tabs.
 */
export function PlanHeader({ week, actions, children }: {
  week?: WeekNav
  /** The screen's main buttons, in the title row from md up. */
  actions?: ReactNode
  /** A row under the tabs on a phone, beside them from md up. */
  children?: ReactNode
}) {
  const left = useMealPlanStore((s) => s.groceryItems.filter((i) => !i.checked).length)
  const { label, tabs } = SECTION_TABS.plan

  return (
    <header className="px-4 pt-3.5 md:px-8 md:pt-0 flex flex-col gap-3 md:gap-0" data-print-hide>
      <div className="flex items-center gap-2 md:gap-3 md:min-h-[72px]">
        <h1 className="flex-1 min-w-0 text-[22px] leading-7 md:text-2xl md:leading-8 font-extrabold text-ink-900">
          Plan
        </h1>
        {week && <WeekStepper week={week} className="flex md:hidden" />}
        {actions && <div className="hidden md:flex items-center gap-3">{actions}</div>}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 md:pt-8">
        <SectionTabs label={label} tabs={tabs} counts={left ? { '/plan/grocery': left } : undefined} />
        {week && <WeekStepper week={week} className="hidden md:flex" />}
        {children && <div className="flex flex-wrap items-center gap-2 md:ml-auto">{children}</div>}
      </div>
    </header>
  )
}

function WeekStepper({ week, className }: { week: WeekNav; className: string }) {
  return (
    <div className={`items-center gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={week.onPrev}
        aria-label={`Previous ${week.unit}`}
        title={`Previous ${week.unit}`}
        className="w-11 h-11 md:w-10 md:h-10 rounded-[14px] md:rounded-xl inline-flex items-center justify-center text-ink-700 hover:bg-bite-50 hover:text-bite-700"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <span className="text-[15px] font-extrabold text-ink-900 text-center whitespace-nowrap md:min-w-[104px]">
        {week.label}
      </span>
      <button
        type="button"
        onClick={week.onNext}
        aria-label={`Next ${week.unit}`}
        title={`Next ${week.unit}`}
        className="w-11 h-11 md:w-10 md:h-10 rounded-[14px] md:rounded-xl inline-flex items-center justify-center text-ink-700 hover:bg-bite-50 hover:text-bite-700"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
