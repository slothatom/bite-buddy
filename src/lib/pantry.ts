import type { Food, PantryItem, Recipe } from '../types'
import type { NutritionContext } from './nutrition'
import { flattenComponents } from './ingredients'

/**
 * What the cupboard changes about a shopping list and a recipe.
 *
 * Two questions, both answered here so neither screen invents its own rule:
 * how much of something you still need to buy, and how much of a recipe you
 * could make right now.
 *
 * The bias throughout is towards asking rather than assuming. A pantry entry
 * with no quantity means "enough", because that is what somebody means when
 * they say they have olive oil; but a quantity, once given, is believed and
 * subtracted, because "200 g of the 500 g you need" is a real answer and
 * rounding it away to "have some" would send you home without lentils.
 */

/**
 * How much of `grams` still needs buying, given what is in the cupboard.
 *
 * Returns zero when there is enough, and the shortfall when there is not.
 * A staple is always enough: that is what marking it as one says.
 */
export function stillNeeded(grams: number, item: PantryItem | undefined): number {
  if (!item) return grams
  if (item.staple) return 0
  if (item.grams === undefined) return 0
  return Math.max(0, grams - item.grams)
}

export interface Availability {
  /** Ingredients the cupboard covers completely. */
  have: string[]
  /** Ingredients it does not, or not enough of. */
  missing: string[]
  /** Between 0 and 1, by count of ingredients rather than by weight. */
  ratio: number
}

/**
 * How much of a recipe you could make from what you have.
 *
 * Counted by ingredient rather than by weight, because that is how the question
 * is asked: "what am I missing" has an answer you can read, where "you have 82%
 * by mass" has none. Water is ignored for the same reason it is left off a
 * shopping list.
 */
export function availability(
  recipe: Recipe,
  ctx: NutritionContext,
  pantry: Map<string, PantryItem>,
): Availability {
  const ingredients = flattenComponents(recipe.components, ctx, { skip: ['water'] })
  const have: string[] = []
  const missing: string[] = []

  for (const ingredient of ingredients) {
    const short = stillNeeded(ingredient.grams, pantry.get(ingredient.foodId))
    if (short === 0) have.push(ingredient.foodId)
    else missing.push(ingredient.foodId)
  }

  const total = have.length + missing.length
  return { have, missing, ratio: total === 0 ? 0 : have.length / total }
}

/**
 * How to describe that, in a phrase somebody would say.
 *
 * Nothing here is a verdict on whether you should cook it. "Missing two things"
 * is what you want to know at the moment you are choosing; whether two is a lot
 * depends on which two, and you can see the list.
 */
export function availabilityLabel(a: Availability): string {
  if (a.have.length + a.missing.length === 0) return ''
  if (!a.missing.length) return 'You have everything'
  if (a.missing.length === 1) return 'Missing one thing'
  if (a.ratio >= 0.5) return `Missing ${a.missing.length} things`
  return `Missing most of it`
}

/** The foods a recipe needs that the cupboard does not cover, named. */
export function missingFoods(a: Availability, foods: Map<string, Food>): string[] {
  return a.missing.map((id) => foods.get(id)?.names.en ?? id)
}
