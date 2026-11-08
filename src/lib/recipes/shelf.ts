import type { DishCategory, QuickFilter, Recipe } from '../../types'
import { groupsOf, type RecipeGroup } from '../recipeGroups'
import { DISH_CATEGORIES, hasQuickFilter } from '../dishCategories'
import { normaliseTerm } from '../units'

/**
 * The rules behind the recipe library's shelves, without the screen.
 *
 * Kept apart from the page so the parts that decide what you see, search,
 * filters, shelves and their order, can be tested on their own.
 */

/** "Yours" is a shelf too, but a different kind, it cuts across the meals. */
export type RecipeTab = RecipeGroup | 'mine'

export interface RecipeQuery {
  query: string
  category: DishCategory | null
  filters: QuickFilter[]
  favesOnly: boolean
  favouriteIds: string[]
}

/** Everything the search and chips allow, before the shelf is chosen. */
export function matchRecipes(recipes: Recipe[], q: RecipeQuery): Recipe[] {
  const n = normaliseTerm(q.query)
  return recipes.filter((r) => {
    if (q.favesOnly && !q.favouriteIds.includes(r.id)) return false
    if (q.category && r.category !== q.category) return false
    // Every ticked filter has to hold: they narrow together, they do not pile up.
    if (q.filters.some((f) => !hasQuickFilter(r, f))) return false

    if (!n) return true
    // The dietician's own line is searched too, so "telemea" finds the meals
    // that were written in Romanian.
    // The portion too, so "45 g rolled oats" still finds the version it
    // names now that the quantity has come out of the name.
    const haystack = normaliseTerm(
      [r.name.en, r.name.ro, r.name.hu, r.variant, r.sourceLine].filter(Boolean).join(' '))
    return haystack.includes(n)
  })
}

/** The recipes on one shelf: yours, or the ones tagged for that meal. */
export function onShelf(recipes: Recipe[], tab: RecipeTab, mine: Set<string>): Recipe[] {
  return tab === 'mine'
    ? recipes.filter((r) => mine.has(r.id))
    : recipes.filter((r) => groupsOf(r).includes(tab))
}

/**
 * Favourites first, then alphabetical: the handful you actually cook should
 * not be somewhere in the middle of seventy.
 */
export function favouritesFirst(recipes: Recipe[], favouriteIds: string[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const fav = Number(favouriteIds.includes(b.id)) - Number(favouriteIds.includes(a.id))
    return fav || a.name.en.localeCompare(b.name.en)
  })
}

/**
 * Only the categories that are actually on this shelf, with their counts, in
 * the library's own category order.
 */
export function categoriesOnShelf(recipes: Recipe[]): (readonly [DishCategory, number])[] {
  const counted = new Map<DishCategory, number>()
  for (const r of recipes) {
    if (r.category) counted.set(r.category, (counted.get(r.category) ?? 0) + 1)
  }
  return DISH_CATEGORIES.filter((c) => counted.has(c)).map((c) => [c, counted.get(c)!] as const)
}
