import { useMemo } from 'react'
import { buildContext, type NutritionContext } from '../lib/nutrition'
import { buildFoodIndex, type FoodIndex } from '../lib/foodSearch'
import { useFoods, useFoodStore, useResolvableFoods } from './useFoodStore'
import { useResolvableRecipes, useRecipeStore } from './useRecipeStore'
import { useAllPortions } from './usePortionStore'

/**
 * The lookup tables every nutrition calculation needs.
 *
 * Rebuilt only when the food or recipe lists actually change, the library is
 * ~120 foods and ~275 recipes, so rebuilding on every render would be wasteful
 * on the weekly planner where totals are computed for 35 meal slots at once.
 */
export function useNutritionContext(): NutritionContext {
  // Deleted foods included: a snack line names a food by id, and losing the
  // food would blank the day the same way losing a recipe did.
  const foods = useResolvableFoods()
  // Everything a saved plan might name, including recipes you have deleted: a
  // day planned in March stores an id, and losing the recipe must not blank it.
  const recipes = useResolvableRecipes()
  // Merged-away recipes are not in the library any more, but days you already
  // planned still name them. The aliases keep those days resolving.
  const mergedInto = useRecipeStore((s) => s.mergedInto)
  // Same for foods: a duplicate you folded away is still named by every recipe
  // and every snack line written before you merged it.
  const foodsMergedInto = useFoodStore((s) => s.mergedInto)
  // Every portion, including the empty ones: a day you planned from the fridge
  // names a portion by id, and an eaten tub must still say what that meal was.
  const portions = useAllPortions()

  return useMemo(
    () => buildContext(foods, recipes, mergedInto, foodsMergedInto, portions),
    [foods, recipes, mergedInto, foodsMergedInto, portions],
  )
}

export function useFoodIndex(): FoodIndex {
  const foods = useFoods()
  return useMemo(() => buildFoodIndex(foods), [foods])
}
