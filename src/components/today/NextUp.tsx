import { Link } from 'react-router-dom'
import { Check, Repeat } from 'lucide-react'
import { SLOT_LABELS } from '../../types'
import type { SlotRow } from './todayModel'

/**
 * The one meal still to say something about, with the one thing you most
 * often want to say about it.
 *
 * "Change" opens the planner on today, which is where a meal is swapped or
 * moved: Today has no picker of its own, and a second one here would be a
 * second set of rules about the fridge to keep in step.
 */
export default function NextUp({ row, onEaten }: { row: SlotRow; onEaten: () => void }) {
  const facts = [
    `${row.kcal.toLocaleString('en-GB')} kcal`,
    row.protein > 0 ? `${row.protein} g protein` : '',
    row.minutes ? `${row.minutes} min` : '',
  ].filter(Boolean).join(' · ')

  return (
    <section
      aria-label="Next up"
      className="bg-bite-100 rounded-card p-4 xl:px-6 xl:py-5 flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-6"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2 xl:gap-1.5">
        <p className="text-xs leading-4 font-extrabold tracking-[0.06em] uppercase text-bite-700">
          Next up · {SLOT_LABELS[row.slot]}
          {row.state === 'part' && ' · partly eaten'}
        </p>
        <p className="text-lg leading-6 xl:text-2xl xl:leading-[30px] font-extrabold text-ink-900">{row.name}</p>
        <p className="text-sm text-ink-700">{facts}</p>
      </div>
      <div className="flex gap-2 mt-1 xl:mt-0 shrink-0">
        <button
          type="button"
          onClick={onEaten}
          className="btn-primary flex-1 xl:flex-none min-h-11 rounded-lg text-[15px] font-extrabold"
        >
          <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Mark eaten
        </button>
        <Link
          to="/plan/week"
          className="btn min-h-11 rounded-lg text-[15px] border border-bite-700 text-bite-700 hover:bg-bite-50"
        >
          <Repeat size={16} aria-hidden="true" className="hidden xl:block" /> Change
        </Link>
      </div>
    </section>
  )
}
