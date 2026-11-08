import { useMemo, useState } from 'react'
import type { MealSlot } from '../../types'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { entryName } from '../../lib/entryLabel'
import { useDialog } from '../../lib/useDialog'
import WhenPicker from './WhenPicker'

/**
 * Moving or copying one meal.
 *
 * Both live in one dialog because the choice you are making is the same, which
 * day and which slot, and only the last tap differs. Two separate flows would
 * mean picking a destination twice to find out you wanted the other one.
 */
export function MoveMealDialog({
  from, onClose, onMove, onCopy,
}: {
  from: { date: string; mealId: string; index?: number }
  onClose: () => void
  onMove: (date: string, slot: MealSlot) => void
  /* Absent for a single line. Copying one is a coherent thing to want and a
     separate decision; a button that silently did something else would not be.
     A whole meal still copies. */
  onCopy?: (date: string, slot: MealSlot) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const panel = useDialog<HTMLDivElement>(onClose)
  const ctx = useNutritionContext()
  const meal = plan.find((d) => d.date === from.date)?.meals.find((m) => m.id === from.mealId)
  const one = from.index === undefined ? undefined : meal?.entries[from.index]
  const [date, setDate] = useState(from.date)
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? 'lunch')
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )

  if (!meal) return null
  const unchanged = date === from.date && slot === meal.slot

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={one ? 'Move this item' : 'Move or copy this meal'}
        className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">
          {one ? `Move ${entryName(one, ctx)}` : 'Move or copy this meal'}
        </h3>
        <p className="text-sm text-ink-700 mb-4">
          {one
            ? 'It leaves this meal and joins whatever is there.'
            : 'Pick where it should go.'}
        </p>

        <div className="mb-5">
          <WhenPicker date={date} onDate={setDate} slot={slot} onSlot={setSlot} busy={busy} />
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={unchanged} onClick={() => onMove(date, slot)}>
            Move it
          </button>
          {/* Disabled for the source slot too. It used to stay enabled there,
              and tapping it appended a second identical copy to the same slot
              with nothing said: Snack 1 went from 294 to 588 kcal. */}
          {onCopy && (
            <button className="btn-secondary flex-1" disabled={unchanged} onClick={() => onCopy(date, slot)}>
              Copy it
            </button>
          )}
        </div>
        <button className="btn-ghost w-full mt-2" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
