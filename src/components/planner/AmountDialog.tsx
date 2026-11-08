import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import type { DayPlan } from '../../types'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients } from '../../lib/nutrition'
import { formatAmount } from '../../lib/amounts'
import { useDialog } from '../../lib/useDialog'
import { round2 } from '../../lib/planner/format'

/**
 * How much of it there was.
 *
 * Grams for a food, servings for anything already made. The steps are the ones
 * people actually eat in, halves and quarters of a portion, rather than a free
 * number field that invites 0.37 of a stew.
 */
export function AmountDialog({
  day, mealId, index, onClose, onSet,
}: {
  day: DayPlan
  mealId: string
  index: number
  onClose: () => void
  onSet: (value: number) => void
}) {
  const ctx = useNutritionContext()
  const panel = useDialog<HTMLDivElement>(onClose)
  const entry = day.meals.find((m) => m.id === mealId)?.entries[index]

  const current = entry ? (entry.kind === 'food' ? entry.grams : entry.servings) : 0
  const [value, setValue] = useState(current)

  if (!entry) return null

  const isFood = entry.kind === 'food'
  const step = isFood ? 10 : 0.25
  const label = isFood
    ? ctx.foods.get(entry.foodId)?.names.en ?? 'This ingredient'
    : entry.kind === 'recipe'
      ? ctx.recipes.get(entry.recipeId)?.name.en ?? 'This dish'
      : 'This portion'

  /**
   * What the number is allowed to be.
   *
   * It ran from zero to nothing at all, so the stepper would happily write a
   * meal of 0 g, which is a meal that is not one, or 40 servings of stew, which
   * is a slip of a thumb on a button that repeats.
   *
   * The floor is one step, because taking a line down to nothing means
   * removing it and there is a bin for that. The ceiling is only a real
   * constraint in one of the three cases: a tub in the fridge holds what it
   * holds, and this entry has already taken some of it, so the most you can
   * have is what is left plus what you took. The other two are round numbers
   * chosen to stop a runaway, not to have an opinion about your dinner.
   */
  const inTheTub = entry.kind === 'portion'
    ? round2((ctx.portions?.get(entry.portionId)?.servings ?? 0) + entry.servings)
    : null
  const most = isFood ? 3000 : inTheTub ?? 20
  const capped = inTheTub !== null && value >= inTheTub

  const shown = isFood
    ? formatAmount(value, entry.kind === 'food' ? ctx.foods.get(entry.foodId) : undefined)
    : `${value === Math.round(value) ? value : value.toFixed(2).replace(/0+$/, '')} ${
      value === 1 ? 'serving' : 'servings'}`

  const kcal = componentsNutrients(
    [isFood ? { ...entry, grams: value } : { ...entry, servings: value }],
    ctx,
  ).calories

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        aria-modal="true"
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`How much ${label}`}
      >
        <h3 className="font-bold text-ink-900 mb-1">{label}</h3>
        <p className="text-sm text-ink-700 mb-4">
          {isFood ? 'How much of it, in grams.' : 'How much of it you are having.'}
        </p>

        <div className="flex items-center justify-center gap-4 mb-5">
          <button
            className="btn-secondary btn-icon"
            onClick={() => setValue((v) => Math.max(step, round2(v - step)))}
            disabled={value <= step}
            aria-label="Less"
          >
            <Minus size={18} />
          </button>
          <div className="text-center min-w-28">
            <div className="text-2xl font-bold text-ink-900 tabular-nums">{shown}</div>
            <div className="text-xs text-ink-500 font-mono">
              {kcal > 0 ? `${Math.round(kcal)} kcal` : ' '}
            </div>
          </div>
          <button
            className="btn-secondary btn-icon"
            onClick={() => setValue((v) => Math.min(most, round2(v + step)))}
            disabled={value >= most}
            aria-label="More"
          >
            <Plus size={18} />
          </button>
        </div>

        {capped && (
          <p className="text-xs text-ink-500 text-center mb-4 -mt-2">
            That is everything left in the tub.
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => onSet(value)}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
