import type { DayPlan, MedCategory, Recipe } from '../types'
import type { NutritionContext } from './nutrition'
import { flattenComponents } from './ingredients'
import { scoreWeek, type GoalProgress } from './mediterranean'

/**
 * Ideas for the week, from your own library.
 *
 * Not a recommender and not a model: every suggestion here is something the
 * guide already says and something you already own the recipe for. "Three
 * portions of legumes a week" is the dietician's rule, "you have planned none"
 * is arithmetic, and the dish offered is one of yours that is mostly legumes.
 *
 * That constraint is deliberate. A suggestion that invents a dish is a
 * suggestion you cannot cook, and one that invents a nutrition fact is worse
 * than useless on a screen about what to eat. Everything below can be checked
 * against the plan in front of you.
 */

export type SuggestionKind =
  | 'gap'        // the guide asks for more of something than the week holds
  | 'limit'      // more of something than the guide allows
  | 'unplanned'  // a day with nothing in it
  | 'forgotten'  // a dish you have not had for a while

export interface Suggestion {
  id: string
  kind: SuggestionKind
  title: string
  /** Why this is being suggested, in terms of the plan and the guide. */
  reason: string
  recipeId?: string
  /** Where tapping it should go. */
  to: string
}

/** The category a dish is mostly made of, by weight. */
export function dominantCategory(
  recipe: Recipe, ctx: NutritionContext,
): MedCategory | undefined {
  const byCategory = new Map<MedCategory, number>()
  for (const ingredient of flattenComponents(recipe.components, ctx, { skip: ['water'] })) {
    const c = ingredient.food.category
    byCategory.set(c, (byCategory.get(c) ?? 0) + ingredient.grams)
  }
  let best: MedCategory | undefined
  let most = 0
  for (const [category, grams] of byCategory) {
    if (grams > most) { most = grams; best = category }
  }
  return best
}

/**
 * A stable choice from a list, so the same day offers the same idea.
 *
 * Shuffling on every render would make the dashboard restless, and a
 * suggestion that has moved by the time you reach for it is a suggestion you
 * cannot act on. The seed is the date, so it changes once a day.
 */
export function pick<T>(items: T[], seed: string): T | undefined {
  if (!items.length) return undefined
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return items[Math.abs(hash) % items.length]
}

export interface SuggestionInput {
  /** The days on screen, whatever range is being looked at. */
  days: DayPlan[]
  recipes: Recipe[]
  ctx: NutritionContext
  /** Today, as an ISO date. Passed in so a run is reproducible. */
  today: string
}

function shortfalls(scored: GoalProgress[]): GoalProgress[] {
  return scored
    .filter((g) => !g.isLimit && g.ratio < 0.7)
    .sort((a, b) => a.ratio - b.ratio)
}

/** A serving count in the words a person uses: "0", "1", "1.5". */
function servingCount(n: number): string {
  const rounded = Math.round(n * 2) / 2
  return rounded === Math.round(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1)
}

export function suggest({ days, recipes, ctx, today }: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = []
  const planned = new Set(
    days.flatMap((d) => d.meals.flatMap((m) => m.entries))
      .flatMap((e) => (e.kind === 'recipe' ? [e.recipeId] : [])),
  )

  const scored = scoreWeek(days, ctx)

  // ─── What the week is short of ─────────────────────────────────────────────
  for (const goal of shortfalls(scored).slice(0, 2)) {
    const candidates = recipes.filter(
      (r) => !planned.has(r.id) && dominantCategory(r, ctx) === goal.category)
    const dish = pick(candidates, `${today}-${goal.category}`)

    out.push({
      id: `gap-${goal.category}`,
      kind: 'gap',
      title: dish ? dish.name.en : `More ${goal.label.toLowerCase()}`,
      // "0.0 of 3" is a decimal place that says nothing: none is none, and a
      // tenth of a serving of vegetables is not a quantity anybody counts in.
      reason: dish
        ? `${goal.label} are at ${servingCount(goal.servings)} of ${goal.expected.toFixed(0)} servings this week, and this one is mostly ${goal.label.toLowerCase()}.`
        : `${goal.label} are at ${servingCount(goal.servings)} of ${goal.expected.toFixed(0)} servings this week.`,
      recipeId: dish?.id,
      to: '/recipes',
    })
  }

  // ─── What there is too much of ─────────────────────────────────────────────
  for (const goal of scored.filter((g) => g.isLimit && g.ratio > 1.2)) {
    out.push({
      id: `limit-${goal.category}`,
      kind: 'limit',
      title: `${goal.label} twice over`,
      reason: `${servingCount(goal.servings)} servings against the ${goal.target} a week the guide suggests.`,
      to: '/plan',
    })
  }

  // ─── An empty day soon ─────────────────────────────────────────────────────
  const emptySoon = days
    .filter((d) => d.date >= today && d.meals.length === 0)
    .slice(0, 1)
  for (const day of emptySoon) {
    const when = day.date === today ? 'Today' : new Date(day.date + 'T12:00:00')
      .toLocaleDateString('en-GB', { weekday: 'long' })
    out.push({
      id: `empty-${day.date}`,
      kind: 'unplanned',
      title: `${when} has nothing in it`,
      reason: 'A day with no plan is the one you end up buying lunch for.',
      to: '/plan',
    })
  }

  // ─── Something you have not cooked in a while ──────────────────────────────
  const unplanned = recipes.filter((r) => !planned.has(r.id) && r.sourceLine)
  const forgotten = pick(unplanned, `${today}-forgotten`)
  if (forgotten) {
    out.push({
      id: `forgotten-${forgotten.id}`,
      kind: 'forgotten',
      title: forgotten.name.en,
      reason: 'From your plans, and not in this week. Worth another turn.',
      recipeId: forgotten.id,
      to: '/recipes',
    })
  }

  return out
}
