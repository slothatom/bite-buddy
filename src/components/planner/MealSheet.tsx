import { X } from 'lucide-react'
import type { DayPlan, MealOutcome, MealSlot } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useDialog } from '../../lib/useDialog'
import { formatDate } from '../../lib/planner/format'
import { SlotRow } from './SlotRow'

/**
 * One meal, opened over the week rather than instead of it.
 *
 * Tapping a meal in the grid used to be the moment you lost your place: the
 * only editor was the day view, so seeing what Thursday's lunch was meant
 * leaving the week you were reading. This is the same `SlotRow` the day view
 * draws, in a panel, so there is one set of controls rather than two that
 * drift apart.
 */
export function MealSheet({
  date, slot, day, onClose, onAdd, onRemove, onMove, onOutcome, onEntryOutcome, onAmount,
  onRemoveEntry, onMoveEntry,
}: {
  date: string
  slot: MealSlot
  day: DayPlan
  onClose: () => void
  onAdd: () => void
  onRemove: (mealId: string) => void
  onMove: (mealId: string) => void
  onOutcome: (mealId: string, outcome: MealOutcome | undefined) => void
  onEntryOutcome: (mealId: string, index: number, outcome: MealOutcome | undefined) => void
  onAmount: (mealId: string, index: number) => void
  onRemoveEntry: (mealId: string, index: number) => void
  onMoveEntry: (mealId: string, index: number) => void
}) {
  const panel = useDialog<HTMLDivElement>(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${SLOT_LABELS[slot]} on ${formatDate(date)}`}
        className="bg-paper w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 shadow-xl
                   max-h-[85vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="font-bold text-ink-900">{formatDate(date)}</h3>
          <button className="btn-ghost btn-icon text-ink-500" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <SlotRow
          slot={slot}
          day={day}
          onAdd={onAdd}
          onRemove={onRemove}
          onMove={onMove}
          onOutcome={onOutcome}
          onEntryOutcome={onEntryOutcome}
          onAmount={onAmount}
          onRemoveEntry={onRemoveEntry}
          onMoveEntry={onMoveEntry}
        />
      </div>
    </div>
  )
}
