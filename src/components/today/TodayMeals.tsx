import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { SLOT_LABELS } from '../../types'
import type { SlotRow } from './todayModel'

/**
 * Today's meals, a row a slot, each one tickable where it stands.
 *
 * On the phone the box at the start of the row is the control. From lg there
 * is room for a table with protein and an action column, and the box becomes
 * the status it shows, so there is one control per row either way.
 */
export default function TodayMeals({
  rows, next, onEaten, onUndo, footer,
}: {
  rows: SlotRow[]
  next?: SlotRow
  onEaten: (row: SlotRow) => void
  onUndo: (row: SlotRow) => void
  /** Ways in that belong under the list: the planner, and "I ate something else". */
  footer: ReactNode
}) {
  const planned = rows.reduce((n, r) => n + r.kcal, 0)

  return (
    <section aria-labelledby="today-meals-h" className="flex flex-col gap-1.5 xl:gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="today-meals-h" className="text-base leading-6 font-extrabold text-ink-900">Today's meals</h2>
        <span className="hidden sm:inline text-[13px] text-ink-700">
          {rows.length} {rows.length === 1 ? 'meal' : 'meals'} · {planned.toLocaleString('en-GB')} kcal planned
        </span>
      </div>
      <div className="bg-paper border border-border-200 rounded-card overflow-hidden">
        <div
          aria-hidden="true"
          className="hidden xl:grid grid-cols-[22px_minmax(0,1fr)_72px_56px_120px] gap-3.5 px-4 py-2
                     bg-cream-50 border-b border-border-100 text-xs font-bold text-ink-700"
        >
          <span /><span>Meal</span><span className="text-right">Protein</span><span className="text-right">kcal</span><span />
        </div>
        <ul>
          {rows.map((row) => {
            const isNext = row === next
            const done = row.state === 'eaten'
            const label = SLOT_LABELS[row.slot]
            const said = done ? 'eaten' : row.state === 'part' ? 'partly eaten' : isNext ? 'next' : 'planned'
            return (
              <li
                key={row.slot}
                className={`flex xl:grid xl:grid-cols-[22px_minmax(0,1fr)_72px_56px_120px] items-center
                            gap-3 xl:gap-3.5 pl-1.5 pr-3.5 xl:px-4 py-1 xl:py-2.5 border-t border-border-100 first:border-t-0
                            ${isNext ? 'bg-bite-50' : ''}`}
              >
                {/* The phone's control: the whole 44px square answers a tap. */}
                <button
                  type="button"
                  onClick={() => (done ? onUndo(row) : onEaten(row))}
                  aria-label={done ? `Undo ${label} eaten` : `Mark ${label} eaten`}
                  className="xl:hidden w-11 h-11 shrink-0 flex items-center justify-center rounded-lg"
                >
                  <Box done={done} next={isNext} />
                </button>
                <span className="hidden xl:flex"><Box done={done} next={isNext} /></span>

                <div className="flex-1 min-w-0 flex flex-col py-1.5 xl:py-0">
                  <span className={`text-xs leading-4 ${isNext && !done ? 'text-bite-700 font-bold' : 'text-ink-700'}`}>
                    {label} ·{' '}
                    <span className={done ? 'text-leaf-700 font-bold' : ''}>{said}</span>
                  </span>
                  <span className="text-[15px] leading-5 font-bold text-ink-900 xl:truncate">{row.name}</span>
                </div>
                <span className="hidden xl:block text-[13px] text-ink-700 text-right tabular-nums">{row.protein} g</span>
                <span className="text-sm font-bold xl:font-extrabold text-ink-700 xl:text-ink-900 text-right tabular-nums shrink-0">
                  {row.kcal.toLocaleString('en-GB')}
                </span>
                <div className="hidden xl:flex justify-end">
                  {done ? (
                    <button type="button" onClick={() => onUndo(row)} className="btn-ghost min-h-9 px-2.5 text-sm text-bite-700">
                      Undo<span className="sr-only"> {label}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEaten(row)}
                      className={`btn min-h-9 px-3 text-sm rounded-lg border ${isNext
                        ? 'border-bite-700 text-bite-700 hover:bg-bite-100'
                        : 'border-border-200 bg-paper text-ink-900 hover:border-bite-300'}`}
                    >
                      Mark eaten<span className="sr-only"> {label}</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      {footer}
    </section>
  )
}

/** The tick box: filled when eaten, ringed in the brand when next. */
function Box({ done, next }: { done: boolean; next: boolean }) {
  return done ? (
    <span className="w-[22px] h-[22px] rounded-[7px] bg-leaf-500 flex items-center justify-center" aria-hidden="true">
      <Check size={14} strokeWidth={3} className="text-paper" />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className={`w-[22px] h-[22px] rounded-[7px] border-2 ${next ? 'border-bite-700' : 'border-ink-300'}`}
    />
  )
}
