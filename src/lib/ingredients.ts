/**
 * Resolving a recipe down to the things you actually handle.
 *
 * A component can be a food or another recipe, so anything that needs a real
 * ingredient list — the grocery list, the weigh-out before cooking — has to
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
  { scale = 1, skip = [] as string[] } = {},
): Ingredient[] {
  const merged = new Map<string, Ingredient>()
  const skipped = new Set(skip)

  const walk = (list: Component[], factor: number, fromRecipeId: string | null, depth: number) => {
    // A recipe that contains itself would otherwise recurse forever. The data
    // check forbids it, but this runs against user-created recipes too.
    if (depth > MAX_DEPTH) return

    for (const c of list) {
      if (c.kind === 'food') {
        const food = ctx.foods.get(c.foodId)
        if (!food || skipped.has(food.id)) continue

        const existing = merged.get(c.foodId)
        if (existing) existing.grams += c.grams * factor
        else merged.set(c.foodId, { foodId: c.foodId, food, grams: c.grams * factor, fromRecipeId })
      } else {
        const recipe = ctx.recipes.get(c.recipeId)
        if (!recipe) continue
        const perServing = c.servings / Math.max(1, recipe.servings)
        walk(recipe.components, factor * perServing, fromRecipeId ?? recipe.id, depth + 1)
      }
    }
  }

  walk(components, scale, null, 0)
  return [...merged.values()].sort((a, b) => b.grams - a.grams)
}
