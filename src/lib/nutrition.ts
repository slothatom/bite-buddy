import type {
  Component, DayPlan, Food, Macros, MicroKey, Micros, Nutrients, PlannedMeal, Portion, Recipe,
} from '../types'
import { MICRO_KEYS } from '../types'
import { flattenWithLosses } from './ingredients'

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
  /**
   * What is in the fridge and the freezer, so a planned portion can be costed.
   *
   * Optional because most callers have no opinion about portions: the recipe
   * editor, the classifier and the import scripts all deal in ingredients, and
   * a tub of chilli is not one.
   */
  portions?: Map<string, Portion>
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
  portions: Portion[] = [],
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

  return { foods: foodsById, recipes: byId, portions: new Map(portions.map((p) => [p.id, p])) }
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

  // A portion is a recipe that has already been cooked, so it costs whatever
  // that recipe costs. One that is not a recipe, half a lasagne somebody made
  // up, has no numbers and is left as nothing rather than guessed at.
  if (component.kind === 'portion') {
    const portion = ctx.portions?.get(component.portionId)
    if (!portion?.recipeId) return emptyNutrients()
    return componentNutrients(
      { kind: 'recipe', recipeId: portion.recipeId, servings: component.servings },
      ctx,
      visiting,
    )
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

/**
 * What a day amounted to, and whether that is a plan or a record.
 *
 * Once anything on the day has been ticked, the totals are about what was
 * eaten; until then they are about what is intended. Both are useful and they
 * are not the same number, so the caller is told which it is holding rather
 * than left to guess. A skipped meal counts as neither: it is a fact that it
 * did not happen.
 *
 * The alternative, always totalling the plan, is what made the home screen's
 * ring quietly dishonest: it read like a tracker and was really a sum of
 * intentions.
 */
export function dayEaten(day: DayPlan, ctx: NutritionContext): {
  nutrients: Nutrients
  /** True once at least one meal has been marked one way or the other. */
  recorded: boolean
} {
  const { meals, recorded } = mealsThatCount(day)
  return {
    nutrients: meals.reduce((acc, m) => addNutrients(acc, mealNutrients(m, ctx)), emptyNutrients()),
    recorded,
  }
}

/**
 * The meals a day's figures should be built from, and which kind of day it is.
 *
 * Exported because the guide scoring needs the same rule and had its own: it
 * counted every planned meal, so a week where you skipped three dinners still
 * scored their vegetables. Two answers to "what did this day amount to" is one
 * too many.
 *
 * Three kinds of meal, and each one has an obvious answer once they are asked
 * about separately. Eaten counts, because it happened. Skipped does not,
 * because it did not. A meal nobody has said anything about counts as planned,
 * because that is what it is.
 *
 * The rule used to be coarser: the first tick anywhere on a day switched the
 * whole day to "eaten only". Tick Snack 1 at eleven and Lunch, still hours
 * away and untouched, silently left the total, so a day of 580 kcal reported
 * 294 and 1,106 remaining. Tick it skipped instead and the day read zero with
 * Lunch sitting there in front of you. The app was treating "not yet" as "no".
 */
export function mealsThatCount(day: DayPlan): { meals: PlannedMeal[]; recorded: boolean } {
  return {
    meals: day.meals.filter((m) => m.outcome !== 'skipped'),
    recorded: day.meals.some((m) => m.outcome),
  }
}

/**
 * How far through a day is, for the label that says what its number means.
 *
 * The badge read `recorded ? 'eaten' : 'planned'`, which got both ends wrong:
 * an empty day with nothing in it announced itself as PLANNED, and a day where
 * one meal of five had been skipped and nothing eaten announced itself EATEN.
 */
export interface DayProgress {
  total: number
  eaten: number
  skipped: number
  /** Nothing said about these yet. They still count towards the day. */
  undecided: number
  state: 'empty' | 'planned' | 'part' | 'done'
}

export function dayProgress(day: DayPlan | undefined): DayProgress {
  const meals = day?.meals ?? []
  const eaten = meals.filter((m) => m.outcome === 'eaten').length
  const skipped = meals.filter((m) => m.outcome === 'skipped').length
  const undecided = meals.length - eaten - skipped

  const state = !meals.length ? 'empty'
    : undecided === meals.length ? 'planned'
      : undecided === 0 ? 'done'
        : 'part'

  return { total: meals.length, eaten, skipped, undecided, state }
}

/**
 * What to call a day in two words.
 *
 * A count for the middle case rather than an adjective, because "part eaten"
 * invites the question this is meant to answer.
 */
export function dayLabel(p: DayProgress): string | null {
  if (p.state === 'empty') return null
  if (p.state === 'planned') return 'planned'
  if (p.state === 'part') return `${p.eaten} of ${p.total} eaten`
  return p.eaten ? 'eaten' : 'skipped'
}

export function weekNutrients(days: DayPlan[], ctx: NutritionContext): Nutrients {
  return days.reduce((acc, d) => addNutrients(acc, dayNutrients(d, ctx)), emptyNutrients())
}

export interface DayReading {
  date: string
  nutrients: Nutrients
  /** True once something on that day was ticked, so this is a record. */
  recorded: boolean
  /** False when the day holds nothing at all, planned or eaten. */
  any: boolean
}

/**
 * A stretch of days, each one saying whether it is a record or an intention.
 *
 * `dayEaten` answers this for one day and every screen that showed a week
 * ignored it: the planner ring and Home's Today tile reported what was eaten
 * while the week averages, the fortnight chart, Progress and the guide scoring
 * all quietly summed the plan. So the app recorded the truth on two screens and
 * reported the intention on the rest, without ever saying which was which.
 *
 * One function rather than a rule each screen reimplements, and the mix comes
 * back with the numbers so a screen can say "four of these seven are records"
 * instead of presenting a blend as though it were one thing.
 */
export function weekEaten(
  dates: string[], plan: DayPlan[], ctx: NutritionContext,
): { days: DayReading[]; recorded: number; planned: number } {
  const byDate = new Map(plan.map((d) => [d.date, d]))

  const days = dates.map((date): DayReading => {
    const day = byDate.get(date)
    if (!day || !day.meals.length) {
      return { date, nutrients: emptyNutrients(), recorded: false, any: false }
    }
    const { nutrients, recorded } = dayEaten(day, ctx)
    return { date, nutrients, recorded, any: true }
  })

  const withFood = days.filter((d) => d.any)
  return {
    days,
    recorded: withFood.filter((d) => d.recorded).length,
    planned: withFood.filter((d) => !d.recorded).length,
  }
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
  /**
   * Components the walk could not resolve to food at all.
   *
   * A deleted food or a portion whose recipe is gone contributes nothing and
   * used to do so in silence, so the day reported a smaller number with the
   * same confidence as a complete one. Non-zero means the total is short by an
   * unknown amount, which is a stronger claim than `partial` and is marked the
   * same way.
   */
  unresolved: number
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
  const total = componentsNutrients(components, ctx, visiting)

  // Counted per ingredient, all the way down, rather than per top-level
  // component. A recipe entry was one source, and its own ingredients had
  // already been summed by the time this saw them, so a five-ingredient dish
  // where two said nothing about fibre reported a complete fibre figure. Since
  // most planner entries are recipes, that suppressed nearly every partial
  // total in the app: the marking existed and almost never appeared.
  const { ingredients, lost } = flattenWithLosses(components, ctx)
  for (const ingredient of ingredients) {
    sources++
    for (const k of MICRO_KEYS) {
      if (ingredient.food.per100g[k] != null) known.set(k, (known.get(k) ?? 0) + 1)
    }
  }

  // A nutrient nobody mentioned is absent from the total already; one that only
  // some mentioned is there but incomplete.
  const partial = MICRO_KEYS.filter((k) => {
    const count = known.get(k) ?? 0
    return count > 0 && count < sources
  })

  return { total, partial, sources, unresolved: lost.length }
}

/**
 * The same, for a day.
 *
 * A day is meals of entries, not a flat list of components, and there was no
 * way to ask this question of one. So the planner totalled with `dayNutrients`,
 * which throws away every trace of what was known, and showed "Fibre 23 / 25 g"
 * as though it were a figure. With 109 of the 115 foods in use carrying no
 * sodium at all, most of what that screen states is a floor.
 */
export function reportDay(day: DayPlan, ctx: NutritionContext): NutrientReport {
  return reportNutrients(day.meals.flatMap((m) => m.entries), ctx)
}

/** The same, for a whole recipe, per serving. */
export function reportPerServing(recipe: Recipe, ctx: NutritionContext): NutrientReport {
  const report = reportNutrients(recipe.components, ctx)
  const servings = recipe.servings > 0 ? recipe.servings : 1
  return { ...report, total: scaleNutrients(report.total, 1 / servings) }
}
