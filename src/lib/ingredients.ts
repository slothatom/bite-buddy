/**
 * Resolving a recipe down to the things you actually handle.
 *
 * A component can be a food or another recipe, so anything that needs a real
 * ingredient list, the grocery list, the weigh-out before cooking, has to
 * walk the tree, scale by servings, and merge duplicates. That walk used to
 * live inside the grocery list and nowhere else, which is why Prep had nothing
 * to show.
 */
import type { Component, Food } from '../types'
import type { NutritionContext } from './nutrition'

export interface Ingredient {
  foodId: string
  food: Food
  grams: number
  /** The nested recipe this came from, if it wasn't a direct ingredient. */
  fromRecipeId: string | null
}

/**
 * Something named by a plan that this walk could not resolve to food.
 *
 * A deleted food, a portion whose recipe is gone, a recipe id from a backup
 * written by a newer build. The walk has always dropped these silently, which
 * is how a day naming a food nobody has any more quietly reported a smaller
 * total than the food on the plate. Counting them is what lets a screen say
 * the figure is short rather than presenting it as the whole.
 */
export interface LostComponent {
  kind: 'food' | 'portion' | 'recipe'
  id: string
}

const MAX_DEPTH = 6

/**
 * Flattens components to foods, merged by food and scaled.
 *
 * `skip` exists because the two callers disagree about water: it belongs in a
 * weigh-out and not on a shopping list.
 */
export function flattenComponents(
  components: Component[],
  ctx: NutritionContext,
  options: { scale?: number; skip?: string[] } = {},
): Ingredient[] {
  return flattenWithLosses(components, ctx, options).ingredients
}

/**
 * The same walk, and what it had to give up on.
 *
 * Separate entry point rather than a changed return type: a dozen callers want
 * the ingredients and nothing else, and only the ones reporting a total to a
 * person need to know the list is incomplete.
 */
export function flattenWithLosses(
  components: Component[],
  ctx: NutritionContext,
  { scale = 1, skip = [] as string[] } = {},
): { ingredients: Ingredient[]; lost: LostComponent[] } {
  const merged = new Map<string, Ingredient>()
  const lost: LostComponent[] = []
  const skipped = new Set(skip)

  const walk = (list: Component[], factor: number, fromRecipeId: string | null, depth: number) => {
    // A recipe that contains itself would otherwise recurse forever. The data
    // check forbids it, but this runs against user-created recipes too.
    if (depth > MAX_DEPTH) return

    for (const c of list) {
      if (c.kind === 'food') {
        const food = ctx.foods.get(c.foodId)
        if (!food) { lost.push({ kind: 'food', id: c.foodId }); continue }
        if (skipped.has(food.id)) continue

        const existing = merged.get(c.foodId)
        if (existing) existing.grams += c.grams * factor
        else merged.set(c.foodId, { foodId: c.foodId, food, grams: c.grams * factor, fromRecipeId })
      } else if (c.kind === 'portion') {
        // A portion is made of whatever it was cooked from, so for anything
        // asking what you actually ate, the Mediterranean goals, a weigh-out,
        // it counts exactly as the recipe does. Whether it should be *bought*
        // is a different question, answered where the shopping list is built.
        const portion = ctx.portions?.get(c.portionId)
        const recipe = portion?.recipeId ? ctx.recipes.get(portion.recipeId) : undefined
        if (!recipe) { lost.push({ kind: 'portion', id: c.portionId }); continue }
        const perServing = c.servings / Math.max(1, recipe.servings)
        walk(recipe.components, factor * perServing, fromRecipeId ?? recipe.id, depth + 1)
      } else {
        const recipe = ctx.recipes.get(c.recipeId)
        if (!recipe) { lost.push({ kind: 'recipe', id: c.recipeId }); continue }
        const perServing = c.servings / Math.max(1, recipe.servings)
        walk(recipe.components, factor * perServing, fromRecipeId ?? recipe.id, depth + 1)
      }
    }
  }

  walk(components, scale, null, 0)
  return {
    ingredients: [...merged.values()].sort((a, b) => b.grams - a.grams),
    lost,
  }
}
