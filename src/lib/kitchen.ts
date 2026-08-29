import type { CookSession, DayPlan, GroceryItem, PantryItem, Portion } from '../types'
import type { NutritionContext } from './nutrition'
import { flattenComponents } from './ingredients'
import { stillNeeded } from './pantry'
import { ageInDays } from '../store/usePortionStore'
import { portionLabel } from './portionsUse'

/**
 * What the kitchen has to say, from the state of the kitchen.
 *
 * Every one of these is a fact and a consequence: there are two portions of
 * something in the fridge and nothing planned to eat them; the shopping list
 * predates three of the meals now on the plan; a cook session is tomorrow and
 * two of its ingredients are not in the house.
 *
 * Two rules run through all of it. Nothing here scolds: a week where you order
 * pizza twice is a normal week, and an app that reacts to it by complaining has
 * made itself an unpleasant presence in your kitchen. And nothing here is
 * urgent unless it is actually urgent, because a screen that cries wolf about
 * five things is a screen people learn to scroll past.
 */

export type NudgeKind =
  | 'leftovers'      // cooked, waiting, and nothing planned to eat it
  | 'sitting'        // in the fridge a while
  | 'cooking'        // a session soon, and what it needs
  | 'shopping'       // the list no longer matches the plan
  | 'shared'         // several meals want the same thing

export interface Nudge {
  id: string
  kind: NudgeKind
  title: string
  detail: string
  to: string
  /** Lower sorts first. Set by urgency, not by how clever the nudge is. */
  rank: number
}

export interface KitchenInput {
  /** The days on screen. */
  days: DayPlan[]
  ctx: NutritionContext
  today: string
  portions?: Portion[]
  sessions?: CookSession[]
  groceryItems?: GroceryItem[]
  pantry?: Map<string, PantryItem>
}

/** How long a fridge portion sits before it is worth mentioning. */
const SITTING_DAYS = 4

export function kitchenNudges(input: KitchenInput): Nudge[] {
  const { days, ctx, today, portions = [], sessions = [], groceryItems = [], pantry = new Map() } = input
  const out: Nudge[] = []

  const upcoming = days.filter((d) => d.date >= today)
  const entries = upcoming.flatMap((d) => d.meals.flatMap((m) => m.entries))
  const plannedPortions = new Set(
    entries.flatMap((e) => (e.kind === 'portion' ? [e.portionId] : [])),
  )

  // ─── Cooked, and nobody has said they will eat it ───────────────────────────
  const waiting = portions.filter((p) => p.servings > 0 && !plannedPortions.has(p.id))
  if (waiting.length) {
    const servings = waiting.reduce((n, p) => n + p.servings, 0)
    const emptySlots = upcoming.reduce((n, d) => n + Math.max(0, 3 - d.meals.length), 0)

    if (emptySlots > 0) {
      out.push({
        id: 'leftovers-waiting',
        kind: 'leftovers',
        title: servings === 1
          ? `One portion of ${portionLabel(waiting[0], ctx.recipes)} is waiting`
          : `${round(servings)} portions are cooked and waiting`,
        detail: waiting.length === 1
          ? `${portionLabel(waiting[0], ctx.recipes)}, and nothing planned to eat it.`
          : `${waiting.map((p) => portionLabel(p, ctx.recipes)).slice(0, 3).join(', ')}. Nothing planned to eat them yet.`,
        to: '/plan',
        rank: 20,
      })
    }
  }

  // ─── Something that has been in there a while ───────────────────────────────
  const oldest = portions
    .filter((p) => p.servings > 0 && p.storage === 'fridge')
    .map((p) => ({ portion: p, days: ageInDays(p, new Date(today + 'T12:00:00')) }))
    .filter((p) => p.days >= SITTING_DAYS)
    .sort((a, b) => b.days - a.days)[0]

  if (oldest) {
    out.push({
      id: `sitting-${oldest.portion.id}`,
      kind: 'sitting',
      title: `${portionLabel(oldest.portion, ctx.recipes)} has been in the fridge ${oldest.days} days`,
      // Said plainly, with no verdict attached. The app has not seen the tub,
      // and "worth a look" is the most it is entitled to. The clause that used
      // to follow, "worth eating first if it is still good", handed back the
      // judgement the sentence before it had just refused to make.
      detail: 'Worth a look, and the oldest thing in there.',
      to: '/schedule',
      rank: 30,
    })
  }

  // ─── A cook session soon, and what it wants ────────────────────────────────
  const next = sessions
    .filter((s) => !s.completed && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (next) {
    const daysAway = dayGap(today, next.date)
    if (daysAway <= 2) {
      const needed = sessionShortfall(next, ctx, pantry, groceryItems)
      out.push({
        id: `cooking-${next.id}`,
        kind: 'cooking',
        title: daysAway === 0
          ? `Cooking today at ${next.time}`
          : daysAway === 1 ? `Cooking tomorrow at ${next.time}` : `Cooking on ${weekday(next.date)}`,
        detail: needed.length
          ? `${next.recipeIds.length} ${next.recipeIds.length === 1 ? 'dish' : 'dishes'}, and ${needed.length === 1 ? 'one thing is' : `${needed.length} things are`} not in the house: ${needed.slice(0, 3).join(', ')}.`
          : `${next.recipeIds.length} ${next.recipeIds.length === 1 ? 'dish' : 'dishes'}, and everything for ${next.recipeIds.length === 1 ? 'it' : 'them'} is in.`,
        to: '/schedule',
        rank: needed.length ? 10 : 40,
      })
    }
  }

  // ─── The list and the plan have drifted apart ──────────────────────────────
  if (groceryItems.length) {
    const missing = notOnTheList(upcoming, ctx, groceryItems, pantry)
    if (missing.length >= 2) {
      out.push({
        id: 'shopping-stale',
        kind: 'shopping',
        title: `The list is missing ${missing.length} ${missing.length === 1 ? 'thing' : 'things'}`,
        detail: `The plan has changed since it was built: ${missing.slice(0, 3).join(', ')}. Rebuilding keeps your ticks and anything you added.`,
        to: '/grocery',
        rank: 25,
      })
    }
  }

  // ─── Several meals wanting the same thing ──────────────────────────────────
  const shared = mostShared(upcoming, ctx)
  if (shared) {
    out.push({
      id: `shared-${shared.foodId}`,
      kind: 'shared',
      title: `${shared.meals} meals this week use ${shared.name.toLowerCase()}`,
      detail: 'Worth buying once and using across them, or cooking in one batch.',
      to: '/grocery',
      rank: 50,
    })
  }

  return out.sort((a, b) => a.rank - b.rank)
}

/** What a session needs that is neither in the cupboard nor on the list. */
function sessionShortfall(
  session: CookSession,
  ctx: NutritionContext,
  pantry: Map<string, PantryItem>,
  items: GroceryItem[],
): string[] {
  const onList = new Set(items.map((i) => i.foodId).filter(Boolean))
  const needed: string[] = []

  for (const recipeId of session.recipeIds) {
    const recipe = ctx.recipes.get(recipeId)
    if (!recipe) continue
    for (const ingredient of flattenComponents(recipe.components, ctx, { skip: ['water'] })) {
      if (onList.has(ingredient.foodId)) continue
      if (stillNeeded(ingredient.grams, pantry.get(ingredient.foodId)) === 0) continue
      const name = ingredient.food.names.en
      if (!needed.includes(name)) needed.push(name)
    }
  }
  return needed
}

/** What the plan needs that the list does not have and the cupboard does not cover. */
function notOnTheList(
  days: DayPlan[],
  ctx: NutritionContext,
  items: GroceryItem[],
  pantry: Map<string, PantryItem>,
): string[] {
  const onList = new Set(items.map((i) => i.foodId).filter(Boolean))
  const entries = days.flatMap((d) => d.meals.flatMap((m) => m.entries))
  const missing: string[] = []

  for (const ingredient of flattenComponents(entries, ctx, { skip: ['water'] })) {
    if (onList.has(ingredient.foodId)) continue
    if (stillNeeded(ingredient.grams, pantry.get(ingredient.foodId)) === 0) continue
    const name = ingredient.food.names.en
    if (!missing.includes(name)) missing.push(name)
  }
  return missing
}

/**
 * The food the most separate meals want.
 *
 * Counted by meal rather than by weight, because the useful version of this is
 * "these three dinners all want spinach, buy it once", not "spinach is 4% of
 * the week by mass".
 */
function mostShared(
  days: DayPlan[],
  ctx: NutritionContext,
): { foodId: string; name: string; meals: number } | undefined {
  const counts = new Map<string, { name: string; meals: number }>()

  for (const day of days) {
    for (const meal of day.meals) {
      const seen = new Set<string>()
      for (const ingredient of flattenComponents(meal.entries, ctx, { skip: ['water'] })) {
        if (seen.has(ingredient.foodId)) continue
        seen.add(ingredient.foodId)
        const existing = counts.get(ingredient.foodId)
        counts.set(ingredient.foodId, {
          name: ingredient.food.names.en,
          meals: (existing?.meals ?? 0) + 1,
        })
      }
    }
  }

  const best = [...counts.entries()]
    .map(([foodId, v]) => ({ foodId, ...v }))
    .sort((a, b) => b.meals - a.meals || a.foodId.localeCompare(b.foodId))[0]

  return best && best.meals >= 3 ? best : undefined
}

function dayGap(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00').getTime()
  const b = new Date(to + 'T12:00:00').getTime()
  return Math.round((b - a) / 86_400_000)
}

function weekday(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
