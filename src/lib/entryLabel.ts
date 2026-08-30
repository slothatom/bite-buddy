import type { Component } from '../types'
import type { NutritionContext } from './nutrition'

/**
 * What to call one line of a meal.
 *
 * Three screens wanted this and three screens had their own version, which
 * diverged in the way copies do: Home's could not name a portion at all and
 * called Sunday's stew "Unknown", and the undo messages needed a fourth copy
 * to say what had just been removed.
 *
 * A portion says where it came from rather than what it is made of. Reading a
 * plan, the useful fact is that this one is already cooked and waiting, not
 * that it is a lentil stew.
 */
export function entryName(entry: Component, ctx: NutritionContext): string {
  if (entry.kind === 'recipe') {
    return ctx.recipes.get(entry.recipeId)?.name.en ?? 'Unknown recipe'
  }
  if (entry.kind === 'food') {
    return ctx.foods.get(entry.foodId)?.names.en ?? 'Unknown food'
  }
  const portion = ctx.portions?.get(entry.portionId)
  const recipe = portion?.recipeId ? ctx.recipes.get(portion.recipeId) : undefined
  return recipe?.name.en ?? portion?.label ?? 'From the fridge'
}

/**
 * A meal in a few words, for a sentence about it.
 *
 * "Removed Cabbage soup" is checkable against what you meant to do in a way
 * that "Meal removed" is not, and that is the whole point of the message. Past
 * two names it stops listing and counts, because an undo bar has one line and
 * a snack can be six foods.
 */
export function entriesName(entries: Component[], ctx: NutritionContext): string {
  const names = entries.map((e) => entryName(e, ctx))
  if (!names.length) return 'an empty meal'
  if (names.length <= 2) return names.join(' and ')
  return `${names[0]} and ${names.length - 1} other things`
}
