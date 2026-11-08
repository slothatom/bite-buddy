import { useMemo } from 'react'
import type { Component, MealSlot } from '../../types'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { usePortionStore } from '../../store/usePortionStore'
import { useNutritionContext } from '../../store/useNutrition'
import { portionEntries } from '../../lib/portionsUse'
import { entriesName } from '../../lib/entryLabel'
import { formatDate } from '../../lib/planner/format'
import { offerUndo } from '../../store/useUndo'

/**
 * The planner's edits that keep the fridge honest.
 *
 * Every way of adding, removing, moving or resizing a line goes through here,
 * so the portion counts and the undo offers stay in one place rather than
 * being re-learned by each screen that edits a day.
 */
export function usePlanActions() {
  const {
    plan, addEntry, removeMeal, clearDay, updateEntry, restoreMeals,
    removeEntryFromMeal, restoreEntryAt,
  } = useMealPlanStore()
  const ctx = useNutritionContext()
  const { takeFrom, returnTo } = usePortionStore()

  const byDate = useMemo(() => new Map(plan.map((d) => [d.date, d])), [plan])

  /**
   * Planning from the fridge takes the portion, and unplanning puts it back.
   *
   * Done here rather than inside the store because it crosses two of them, and
   * because "what is left" is only ever an estimate: the count comes down when
   * you say you will eat something and goes back up when you change your mind,
   * which is as close to the truth as an app that cannot see the tub can get.
   */
  const addEntryTakingPortions = (date: string, slot: MealSlot, entry: Component) => {
    if (entry.kind === 'portion') takeFrom(entry.portionId, entry.servings)
    addEntry(date, slot, entry)
  }

  const removeMealReturningPortions = (date: string, mealId: string) => {
    const meal = byDate.get(date)?.meals.find((m) => m.id === mealId)
    for (const p of portionEntries(meal?.entries ?? [])) returnTo(p.portionId, p.servings)
    removeMeal(date, mealId)

    // Removing a meal had neither a confirmation nor a way back, and it is a
    // single tap next to the tick that says you ate it.
    if (meal) {
      offerUndo(`Removed ${entriesName(meal.entries, ctx)}`, () => {
        for (const p of portionEntries(meal.entries)) takeFrom(p.portionId, p.servings)
        restoreMeals(date, [meal])
      })
    }
  }

  /**
   * The same bookkeeping as removing a meal, for one line of it.
   *
   * Undo has two shapes here and both are needed. Take a line out of a meal
   * that has others and the meal survives, so putting it back means putting it
   * back at its index, which is what `restoreEntryAt` is for. Take out the
   * last line and the meal itself stops existing, and only `restoreMeals` can
   * bring that back with its id and its ticks intact. Offering the wrong one
   * silently does nothing, which is the worst way for an undo to fail.
   */
  const removeEntryReturningPortions = (date: string, mealId: string, index: number) => {
    const meal = byDate.get(date)?.meals.find((m) => m.id === mealId)
    const entry = meal?.entries[index]
    if (!meal || !entry) return
    const wasLast = meal.entries.length === 1

    for (const p of portionEntries([entry])) returnTo(p.portionId, p.servings)
    removeEntryFromMeal(date, mealId, index)

    offerUndo(`Removed ${entriesName([entry], ctx)}`, () => {
      for (const p of portionEntries([entry])) takeFrom(p.portionId, p.servings)
      if (wasLast) restoreMeals(date, [meal])
      else restoreEntryAt(date, mealId, index, entry)
    })
  }

  /**
   * One line, to another day or another slot.
   *
   * Taking it out and putting it back in is the whole operation: the entry is
   * the same object either side, so a portion's bookkeeping nets to zero and
   * neither `takeFrom` nor `returnTo` belongs here. `addEntry` appends to
   * whatever meal already holds the destination slot and makes one when there
   * is none, which is exactly what a line arriving somewhere should do.
   *
   * No undo, because moving a whole meal has none either and the move is
   * visible where it landed. Removing is the destructive one, and that offers
   * it.
   */
  const moveEntryToSlot = (
    date: string, mealId: string, index: number, toDate: string, toSlot: MealSlot,
  ) => {
    const entry = byDate.get(date)?.meals.find((m) => m.id === mealId)?.entries[index]
    if (!entry) return
    removeEntryFromMeal(date, mealId, index)
    addEntry(toDate, toSlot, entry)
  }

  /**
   * Changing how much of a portion you are having gives the rest back.
   *
   * The same bookkeeping as adding and removing: the tub knows how many
   * servings are left, and saying "actually I only had half" has to put the
   * other half back or the fridge slowly forgets food it still has.
   */
  const changeAmountKeepingPortions = (
    date: string, mealId: string, index: number, value: number,
  ) => {
    const entry = byDate.get(date)?.meals.find((m) => m.id === mealId)?.entries[index]
    if (entry?.kind === 'portion') {
      const difference = value - entry.servings
      if (difference > 0) takeFrom(entry.portionId, difference)
      else if (difference < 0) returnTo(entry.portionId, -difference)
    }
    updateEntry(date, mealId, index, value)
  }

  const clearDayReturningPortions = (date: string) => {
    const day = byDate.get(date)
    const meals = day?.meals ?? []
    for (const meal of meals) {
      for (const p of portionEntries(meal.entries)) returnTo(p.portionId, p.servings)
    }
    clearDay(date)

    if (meals.length) {
      offerUndo(`Cleared ${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} off ${formatDate(date)}`, () => {
        for (const meal of meals) {
          for (const p of portionEntries(meal.entries)) takeFrom(p.portionId, p.servings)
        }
        restoreMeals(date, meals)
      })
    }
  }

  return {
    addEntryTakingPortions,
    removeMealReturningPortions,
    removeEntryReturningPortions,
    moveEntryToSlot,
    changeAmountKeepingPortions,
    clearDayReturningPortions,
  }
}
