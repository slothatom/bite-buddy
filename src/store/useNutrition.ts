import { useMemo } from 'react'
import { buildContext, type NutritionContext } from '../lib/nutrition'
import { buildFoodIndex, type FoodIndex } from '../lib/foodSearch'
import { useFoods } from './useFoodStore'
import { useResolvableRecipes, useRecipeStore } from './useRecipeStore'

/**
 * The lookup tables every nutrition calculation needs.
 *
 * Rebuilt only when the food or recipe lists actually change — the library is
 * ~120 foods and ~275 recipes, so rebuilding on every render would be wasteful
 * on the weekly planner where totals are computed for 35 meal slots at once.
 */
export function useNutritionContext(): NutritionContext {
  const foods = useFoods()
  // Everything a saved plan might name, including recipes you have deleted: a
  // day planned in March stores an id, and losing the recipe must not blank it.
  const recipes = useResolvableRecipes()
  // Merged-away recipes are not in the library any more, but days you already
  // planned still name them. The aliases keep those days resolving.
  const mergedInto = useRecipeStore((s) => s.mergedInto)

  return useMemo(
    () => buildContext(foods, recipes, mergedInto),
    [foods, recipes, mergedInto],
  )
}

export function useFoodIndex(): FoodIndex {
  const foods = useFoods()
  return useMemo(() => buildFoodIndex(foods), [foods])
}
