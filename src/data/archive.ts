import type { Recipe, SourcePlan } from '../types'
import { DISHES } from './dishes'
import type { PlanArchive, RecipeClassification } from './archiveFormat'

/**
 * The plan archive the app is running with, as live bindings.
 *
 * Empty until the household's archive arrives (see store/useArchive.ts), and
 * emptied again on sign-out. Everything is `let` on purpose: an ES module
 * export is a live binding, so `import { ALL_RECIPES } from '../data'` reads
 * whatever was set last, and the many places that read these at call time
 * never need to know the data used to be a constant.
 *
 * What must not happen is a copy taken at load time and kept. The screens are
 * remounted when the archive changes (App.tsx keys them on its version), and
 * the hooks that memoise over these list `useArchiveVersion()` among their
 * dependencies.
 */

export let SOURCE_PLANS: SourcePlan[] = []
export let MEAL_RECIPES: Recipe[] = []
export let RECIPE_CLASSIFICATION: Record<string, RecipeClassification> = {}
export let RECIPE_ALIASES: Record<string, string> = {}
export let TIMES_PLANNED: Record<string, number> = {}

/**
 * The full recipe library: the hand-written dishes, then the plans' meals.
 *
 * Dishes come first because meal recipes reference them as components. With no
 * archive this is the dishes alone, which is a perfectly usable library.
 */
export let ALL_RECIPES: Recipe[] = compose()

let current: PlanArchive | null = null

function compose(): Recipe[] {
  return [...DISHES, ...MEAL_RECIPES].map((recipe) => ({
    ...recipe,
    // Category and quick filters are generated separately, see
    // scripts/classify-recipes.ts, so re-deriving them never touches the
    // recipes themselves.
    ...RECIPE_CLASSIFICATION[recipe.id],
    // How often the plans came back to it. Attached here rather than written
    // into the recipe because it is equally true of the hand-written dishes.
    ...(TIMES_PLANNED[recipe.id] ? { timesPlanned: TIMES_PLANNED[recipe.id] } : {}),
  }))
}

/** Puts an archive in place. It is assumed valid: see `parseArchive`. */
export function setArchive(archive: PlanArchive): void {
  current = archive
  SOURCE_PLANS = archive.sourcePlans
  MEAL_RECIPES = archive.mealRecipes
  RECIPE_CLASSIFICATION = archive.classification
  RECIPE_ALIASES = archive.recipeAliases
  TIMES_PLANNED = archive.timesPlanned
  ALL_RECIPES = compose()
}

/** Back to no archive at all: the dishes, and nothing of hers. */
export function clearArchive(): void {
  current = null
  SOURCE_PLANS = []
  MEAL_RECIPES = []
  RECIPE_CLASSIFICATION = {}
  RECIPE_ALIASES = {}
  TIMES_PLANNED = {}
  ALL_RECIPES = compose()
}

/** The archive in place, if there is one. */
export function currentArchive(): PlanArchive | null {
  return current
}
