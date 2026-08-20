import type {
  Component, DayPlan, Food, Macros, MicroKey, Micros, Nutrients, PlannedMeal, Recipe,
} from '../types'
import { MICRO_KEYS } from '../types'

/**
 * The single place where nutrition numbers are produced.
 *
 * Nothing stores macros. A recipe stores its components; its macros are derived
 * here on demand. That means editing an ingredient can never leave a recipe
 * showing stale totals, which is the failure mode of the previous model where
 * `macrosPerServing` was typed in by hand alongside the ingredient list.
 */

export interface NutritionContext {
  foods: Map<string, Food>
  recipes: Map<string, Recipe>
}

/**
 * `aliases` maps an id that is no longer in the library to the one it was
 * merged into, for recipes and for foods alike. Those entries go into the same
 * maps, so every caller, planner totals, meal labels, the grocery list, the
 * fourteen archived weeks, resolves an old id without knowing merging exists.
 */
export function buildContext(
  foods: Food[],
  recipes: Recipe[],
  aliases: Record<string, string> = {},
  foodAliases: Record<string, string> = {},
): NutritionContext {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  for (const [from, to] of Object.entries(aliases)) {
    const target = byId.get(to)
    if (target && !byId.has(from)) byId.set(from, target)
  }

  const foodsById = new Map(foods.map((f) => [f.id, f]))
  for (const [from, to] of Object.entries(foodAliases)) {
    const target = foodsById.get(to)
    if (target && !foodsById.has(from)) foodsById.set(from, target)
  }

  return { foods: foodsById, recipes: byId }
}

const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const

export function emptyNutrients(): Nutrients {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

/**
 * Adds two sets of figures, keeping "unknown" out of the arithmetic.
 *
 * A micronutrient neither side knows stays unknown rather than becoming zero.
 * One that only one side knows is summed anyway, dropping it would be worse,
 * since "at least this much" is real information, but the total is then
 * incomplete, and `reportNutrients` is how a screen finds that out and says so.
 */
export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = {
    calories: a.calories + b.calories,
    protein:  a.protein  + b.protein,
    carbs:    a.carbs    + b.carbs,
    fat:      a.fat      + b.fat,
  }
  for (const k of MICRO_KEYS) {
    if (a[k] == null && b[k] == null) continue
    out[k] = (a[k] ?? 0) + (b[k] ?? 0)
  }
  return out
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {
    calories: n.calories * factor,
    protein:  n.protein  * factor,
    carbs:    n.carbs    * factor,
    fat:      n.fat      * factor,
  }
  for (const k of MICRO_KEYS) {
    if (n[k] != null) out[k] = (n[k] as number) * factor
  }
  return out
}

export function roundNutrients(n: Nutrients): Nutrients {
  const out: Nutrients = {
    calories: Math.round(n.calories),
    protein:  Math.round(n.protein  * 10) / 10,
    carbs:    Math.round(n.carbs    * 10) / 10,
    fat:       Math.round(n.fat     * 10) / 10,
  }
  for (const k of MICRO_KEYS) {
    if (n[k] != null) out[k] = Math.round((n[k] as number) * 10) / 10
  }
  return out
}

/**
 * Nutrients for one component.
 *
 * `visiting` carries the recipe ids currently being expanded so a recipe that
 * (incorrectly) nests itself yields zero rather than blowing the stack. The data
 * check script asserts the set is never hit.
 */
export function componentNutrients(
  component: Component,
  ctx: NutritionContext,
  visiting: Set<string> = new Set(),
): Nutrients {
  if (component.kind === 'food') {
    const food = ctx.foods.get(component.foodId)
    if (!food) return emptyNutrients()
    return scaleNutrients(food.per100g, component.grams / 100)
  }

  if (visiting.has(component.recipeId)) return emptyNutrients()
  const recipe = ctx.recipes.get(component.recipeId)
  if (!recipe) return emptyNutrients()

  const next = new Set(visiting)
  next.add(recipe.id)
  return scaleNutrients(recipePerServing(recipe, ctx, next), component.servings)
}

export function componentsNutrients(
  components: Component[],
  ctx: NutritionContext,
  visiting?: Set<string>,
): Nutrients {
  return components.reduce(
    (acc, c) => addNutrients(acc, componentNutrients(c, ctx, visiting)),
    emptyNutrients(),
  )
}

/** Total for the whole batch the recipe makes. */
export function recipeTotal(
  recipe: Recipe,
  ctx: NutritionContext,
  visiting?: Set<string>,
): Nutrients {
  return componentsNutrients(recipe.components, ctx, visiting)
}

export function recipePerServing(
  recipe: Recipe,
  ctx: NutritionContext,
  visiting?: Set<string>,
): Nutrients {
  const servings = recipe.servings > 0 ? recipe.servings : 1
  return scaleNutrients(recipeTotal(recipe, ctx, visiting), 1 / servings)
}

export function mealNutrients(meal: PlannedMeal, ctx: NutritionContext): Nutrients {
  return componentsNutrients(meal.entries, ctx)
}

export function dayNutrients(day: DayPlan, ctx: NutritionContext): Nutrients {
  return day.meals.reduce((acc, m) => addNutrients(acc, mealNutrients(m, ctx)), emptyNutrients())
}

export function weekNutrients(days: DayPlan[], ctx: NutritionContext): Nutrients {
  return days.reduce((acc, d) => addNutrients(acc, dayNutrients(d, ctx)), emptyNutrients())
}

// ─── Consistency ──────────────────────────────────────────────────────────────

/**
 * Calories implied by the macros.
 *
 * Plain 4/4/9 Atwater over-counts fibrous foods, because fibre sits inside the
 * carbohydrate figure but yields far less energy, spinach comes out 30%
 * high, which would make every vegetable look mis-keyed. Fibre is therefore
 * counted at 2 kcal/g and removed from the carbohydrate total, which is the
 * convention EU labelling uses.
 */
export function atwaterCalories(n: Nutrients): number {
  const fiber = Math.min(n.fiber ?? 0, n.carbs)
  return n.protein * 4 + (n.carbs - fiber) * 4 + fiber * 2 + n.fat * 9
}

/** Relative disagreement between stated and implied calories, 0–1. */
export function calorieDrift(n: Nutrients): number {
  const implied = atwaterCalories(n)
  if (n.calories <= 0 && implied <= 0) return 0
  const base = Math.max(n.calories, implied, 1)
  return Math.abs(n.calories - implied) / base
}

/** Absolute disagreement, in kcal. Small on low-calorie foods even when the ratio is large. */
export function calorieGap(n: Nutrients): number {
  return Math.abs(n.calories - atwaterCalories(n))
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function macroSplit(m: Macros): { protein: number; carbs: number; fat: number } {
  const total = atwaterCalories(m)
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: (m.protein * 4) / total,
    carbs:   (m.carbs   * 4) / total,
    fat:     (m.fat     * 9) / total,
  }
}

export function pickMacros(n: Nutrients): Macros {
  return { calories: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat }
}

export function pickMicros(n: Nutrients): Micros {
  const out: Micros = {}
  for (const k of MICRO_KEYS) if (n[k] != null) out[k] = n[k]
  return out
}

export { MACRO_KEYS, MICRO_KEYS }

// ─── Unknown is not zero ──────────────────────────────────────────────────────

/**
 * Salt from sodium, in grams.
 *
 * Labels in Europe state salt; USDA states sodium. Showing both as if they were
 * different things to keep an eye on is how you end up watching one number
 * twice, so sodium in milligrams is what the app stores and this is the one
 * conversion between them.
 */
export const SALT_PER_SODIUM = 2.5

export function saltFromSodium(sodiumMg: number | undefined): number | undefined {
  return sodiumMg == null ? undefined : (sodiumMg / 1000) * SALT_PER_SODIUM
}

export function sodiumFromSalt(saltGrams: number): number {
  return (saltGrams / SALT_PER_SODIUM) * 1000
}

export interface NutrientReport {
  total: Nutrients
  /**
   * Micronutrients at least one ingredient said nothing about. The total for
   * these is a floor, not a figure, the screen shows them as "12 g +".
   */
  partial: MicroKey[]
  /** How many ingredients went into this, for explaining a partial total. */
  sources: number
}

/**
 * A total, plus an honest account of how much of it is actually known.
 *
 * Missing nutrient data means unknown, not zero, so a recipe of five
 * ingredients where two never mention fibre cannot claim a fibre figure as if
 * it were complete. It still shows the figure, because "at least this much" is
 * worth knowing, but it is marked.
 */
export function reportNutrients(
  components: Component[],
  ctx: NutritionContext,
  visiting?: Set<string>,
): NutrientReport {
  const known = new Map<MicroKey, number>()
  let sources = 0
  let total = emptyNutrients()

  for (const c of components) {
    const n = componentNutrients(c, ctx, visiting)
    total = addNutrients(total, n)
    sources++
    for (const k of MICRO_KEYS) {
      if (n[k] != null) known.set(k, (known.get(k) ?? 0) + 1)
    }
  }

  // A nutrient nobody mentioned is absent from the total already; one that only
  // some mentioned is there but incomplete.
  const partial = MICRO_KEYS.filter((k) => {
    const count = known.get(k) ?? 0
    return count > 0 && count < sources
  })

  return { total, partial, sources }
}

/** The same, for a whole recipe, per serving. */
export function reportPerServing(recipe: Recipe, ctx: NutritionContext): NutrientReport {
  const report = reportNutrients(recipe.components, ctx)
  const servings = recipe.servings > 0 ? recipe.servings : 1
  return { ...report, total: scaleNutrients(report.total, 1 / servings) }
}
