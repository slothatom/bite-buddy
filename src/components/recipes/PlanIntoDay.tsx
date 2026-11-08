import { useMemo, useState } from 'react'
import { useDialog } from '../../lib/useDialog'
import { readAmount, MOST } from '../../lib/amounts'
import { offerUndo } from '../../store/useUndo'
import { usePortionStore } from '../../store/usePortionStore'
import { surplusLine, surplusOf } from '../../lib/cookExtra'
import WhenPicker from '../planner/WhenPicker'
import { slotNow } from '../../lib/whenDates'
import { Check } from 'lucide-react'
import type { MealSlot, Recipe } from '../../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../../types'
import { today as todayDate } from '../../store/useMealPlanStore'
import { mealTimesOf } from '../../lib/dishCategories'
import { useMealPlanStore } from '../../store/useMealPlanStore'

/**
 * Putting a recipe into a day, from the recipe.
 *
 * The flow this replaces was: browse, decide, close the sheet, open the
 * planner, find the day, search for the same dish again. Five steps to act on
 * a decision you had already made.
 *
 * How much you cook and how much you eat are two different numbers.
 *
 * The sheet's scaler was handed straight to the planner, so scaling a recipe
 * to three and planning it booked three servings against that day: 790 kcal
 * for a lunch, flagged "slightly over", exactly three times the per-serving
 * figures. But the sheet says "the whole lot comes to 789 kcal, and a serving
 * is unchanged", which is the scaler describing a pot rather than a plate.
 * Both cannot be right, and the pot is the one that matches what people do:
 * you cook three portions on Sunday and eat one of them.
 *
 * So `cooking` is what the sheet was scaled to and only ever informs the copy,
 * and `eating` is what goes in the day, starting at one. Planning two portions
 * of something small is still a real thing to want, so it is a control rather
 * than a constant, but it starts where the honest default is.
 */
export function PlanIntoDay({
  recipe, cooking, onClose,
}: {
  recipe: Recipe
  /** What the sheet was scaled to: how many portions this makes. */
  cooking: number
  onClose: () => void
}) {
  const [eating, setEating] = useState(1)
  const { plan, addEntry, removeEntry } = useMealPlanStore()
  const { addPortion, removePortion } = usePortionStore()
  const panel = useDialog<HTMLDivElement>(onClose)
  const [date, setDate] = useState(todayDate)
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )

  /**
   * The recipe's own meal times, where it has them, and the clock otherwise.
   *
   * It used to fall back to 'dinner', which meant opening a dinner recipe from
   * the Dinner shelf in the evening and being offered Breakfast, because the
   * fallback ran before the recipe's own tags were consulted for a match.
   */
  const times = mealTimesOf(recipe).map(String)
  const [slot, setSlot] = useState<MealSlot>(
    () => MEAL_SLOTS.find((s) => times.includes(s)) ?? slotNow(),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        aria-modal="true"
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Put ${recipe.name.en} in a day`}
      >
        <h3 className="font-bold text-ink-900 mb-1">{recipe.emoji} {recipe.name.en}</h3>
        <p className="text-sm text-ink-700 mb-4">
          {/* Which portion, where there is more than one of this dish and you
              have flipped to one of them. Said plainly rather than in the
              heading, which is the line this dialog had to wrap over three
              of. */}
          {recipe.variant ? `${recipe.variant}. ` : ''}
          On a day of your choosing.
        </p>

        <WhenPicker date={date} onDate={setDate} slot={slot} onSlot={setSlot} busy={busy} />

        <div className="mt-5">
          <label className="label" htmlFor="eating">How much are you eating</label>
          <div className="flex items-center gap-2">
            <input
              id="eating"
              type="number"
              min={0.25}
              max={MOST.servings}
              step={0.25}
              className="input w-24"
              value={eating}
              onChange={(e) => setEating(readAmount(e.target.value, {
                min: 0.25, max: MOST.servings, places: 2,
              }))}
            />
            <span className="text-sm text-ink-700">
              {eating === 1 ? 'serving' : 'servings'}
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-1">
            {/* The other half of the answer, where the two numbers differ.
                This used to end "the cook schedule can hold them", which
                described a second screen you then had to go and use, and in
                the meantime the surplus went nowhere at all. */}
            {surplusLine(cooking, eating)
              ? `You scaled this to ${cooking}. What you eat goes in the day and `
                + `the rest goes in the fridge: ${surplusLine(cooking, eating)}.`
              : 'What goes in the day, not how much you cook.'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={() => {
              addEntry(date, slot, { kind: 'recipe', recipeId: recipe.id, servings: eating })

              /*
               * And the rest goes in the fridge, rather than being described
               * and then dropped. Dated to the day the meal is planned for,
               * because that is the day the pot gets made.
               */
              const spare = surplusOf({
                recipeId: recipe.id, cooking, eating, madeOn: date,
                id: `cook-${Date.now().toString(36)}`,
              })
              if (spare) addPortion(spare)

              /*
               * And say so. This closed with nothing to show for it, so the
               * only way to find out whether a meal had landed was to go to
               * the planner and look, on the one screen whose whole purpose
               * was saving you that trip. Removing a meal has said "Removed X,
               * Undo" for a fortnight; adding one said nothing at all.
               *
               * The index is read back rather than assumed: `addEntry` appends
               * to whatever is in the slot already, so the entry just added is
               * the last one, whether the slot was empty or held a breakfast.
               */
              const landed = useMealPlanStore.getState().plan
                .find((d) => d.date === date)?.meals.find((m) => m.slot === slot)
              const at = (landed?.entries.length ?? 1) - 1
              const when = new Date(date + 'T12:00:00')
                .toLocaleDateString('en-GB', { weekday: 'long' })
              // The offer takes back both halves. Putting the meal back and
              // leaving a tub in the fridge would be an undo that left the
              // kitchen believing in food nobody cooked.
              offerUndo(
                spare
                  ? `Added ${recipe.name.en}, ${surplusLine(cooking, eating)}`
                  : `Added ${recipe.name.en} to ${when} ${SLOT_LABELS[slot].toLowerCase()}`,
                () => {
                  removeEntry(date, slot, at)
                  if (spare) removePortion(spare.id)
                },
              )
              onClose()
            }}
          >
            <Check size={15} /> Put it in
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
