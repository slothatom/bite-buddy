import type { Component, DayPlan, MealSlot, PlannedMeal } from '../../types'
import { MEAL_SLOTS } from '../../types'
import type { NutritionContext } from '../../lib/nutrition'
import { componentsNutrients, entryOutcome } from '../../lib/nutrition'
import { entryName } from '../../lib/entryLabel'

/**
 * One meal of today, as Today draws it: a row per slot.
 *
 * The planner keeps a slot as one or more meals of several lines each, and
 * every line carries its own tick. Today is read at a glance, so it folds a
 * slot back into one row, says whether it has happened, and keeps the
 * addresses of the lines so a tick here writes the same per-line answers the
 * planner does.
 */
export interface SlotRow {
  slot: MealSlot
  /** The lines that still count: anything not said to have been left. */
  kept: Component[]
  name: string
  kcal: number
  protein: number
  /** Eaten when every line that counts is ticked; part when some are. */
  state: 'eaten' | 'part' | 'planned'
  /** Lines with nothing said about them yet, for "Mark eaten". */
  undecided: { mealId: string; index: number }[]
  /** Lines ticked as eaten, for "Undo". */
  eaten: { mealId: string; index: number }[]
  /** Prep and cook time, when the slot is a single recipe that has one. */
  minutes?: number
}

/**
 * Today's slots in the order a day is eaten, snacks last because they fall
 * between the others and have no one place in it.
 */
export function slotRows(day: DayPlan | undefined, ctx: NutritionContext): SlotRow[] {
  if (!day) return []
  const rows: SlotRow[] = []

  for (const slot of MEAL_SLOTS) {
    const meals: PlannedMeal[] = day.meals.filter((m) => m.slot === slot)
    if (!meals.length) continue

    const kept: Component[] = []
    const undecided: SlotRow['undecided'] = []
    const eaten: SlotRow['eaten'] = []
    for (const meal of meals) {
      meal.entries.forEach((entry, index) => {
        const outcome = entryOutcome(entry, meal)
        if (outcome === 'skipped') return
        kept.push(entry)
        if (outcome === 'eaten') eaten.push({ mealId: meal.id, index })
        else undecided.push({ mealId: meal.id, index })
      })
    }
    // A slot whose every line was left has nothing to show for the day.
    if (!kept.length) continue

    const n = componentsNutrients(kept, ctx)
    const only = kept.length === 1 && kept[0].kind === 'recipe' ? ctx.recipes.get(kept[0].recipeId) : undefined
    const minutes = only ? (only.prepMinutes || 0) + (only.cookMinutes || 0) : 0

    rows.push({
      slot,
      kept,
      name: kept.map((e) => entryName(e, ctx)).join(', '),
      kcal: Math.round(n.calories),
      protein: Math.round(n.protein),
      state: !undecided.length ? 'eaten' : eaten.length ? 'part' : 'planned',
      undecided,
      eaten,
      minutes: minutes > 0 ? minutes : undefined,
    })
  }

  return rows
}

/** The first slot with anything still to say about it, or nothing. */
export function nextUp(rows: SlotRow[]): SlotRow | undefined {
  return rows.find((r) => r.state !== 'eaten')
}
