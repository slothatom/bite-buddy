import type { Component, DayPlan, MealSlot, Portion, PantryItem, Recipe, Targets } from '../types'
import type { NutritionContext } from './nutrition'
import { componentsNutrients, recipePerServing } from './nutrition'
import { mealTimesOf } from './dishCategories'
import { availability } from './pantry'
import { offerOrder } from './portionsUse'

/**
 * Filling the empty slots, from your own library.
 *
 * Deliberately not a model. Every choice here is arithmetic over things you
 * already own: your recipes, your cupboard, your fridge, your targets, and what
 * you ate last week. That constraint is what makes the result trustworthy. A
 * suggestion that invents a dish is one you cannot cook, and a suggestion that
 * invents a number is worse than useless on a screen about what to eat.
 *
 * It is also what makes it work on a train with no signal, which the rest of
 * this app manages and an assistant that phones a server would not.
 *
 * Nothing here writes anything. It returns proposals with a reason attached,
 * and the screen offers them one at a time. You decide what enters the plan,
 * which is the difference between a tool and an app that rearranges your week
 * while you are not looking.
 */

/** Only the three real meals. Snacks in these plans are food lines, not dishes. */
export const FILLABLE_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']

export interface Proposal {
  date: string
  slot: MealSlot
  entry: Component
  /** Why this one, in terms you can check against the plan in front of you. */
  why: string
  /** What it adds to the day, so a screen can show the arithmetic. */
  calories: number
}

export interface AutoPlanInput {
  /** The days to fill, in order. Days already full are left alone. */
  dates: string[]
  plan: DayPlan[]
  recipes: Recipe[]
  ctx: NutritionContext
  targets: Targets
  favouriteIds?: string[]
  pantry?: Map<string, PantryItem>
  portions?: Portion[]
  /** How far back to look for repeats. A fortnight, by default. */
  lookBackDays?: number
}

interface Candidate {
  entry: Component
  why: string
  calories: number
  score: number
  /** Stable tie-break, so the same week always proposes the same thing. */
  id: string
}

/**
 * What to put in each empty slot.
 *
 * Days are filled in order and each proposal counts towards the day it lands
 * on, so the second meal of a day knows what the first one cost. Without that
 * the arithmetic is per-slot and a day of three large dinners looks fine three
 * times over.
 */
export function proposePlan(input: AutoPlanInput): Proposal[] {
  const {
    dates, plan, recipes, ctx, targets,
    favouriteIds = [], pantry = new Map(), portions = [], lookBackDays = 14,
  } = input

  const byDate = new Map(plan.map((d) => [d.date, d]))
  const proposals: Proposal[] = []

  // What has been eaten lately, so the same stew is not offered on Monday,
  // Wednesday and Friday. Counted rather than merely flagged: twice recently is
  // worse than once.
  const recent = recentlyUsed(plan, dates[0], lookBackDays)

  // Portions are consumed as they are proposed, so a fridge with two portions
  // in it fills two slots and not five.
  const left = new Map(portions.map((p) => [p.id, p.servings]))

  for (const date of dates) {
    const day = byDate.get(date)
    const already = new Set((day?.meals ?? []).map((m) => m.slot))
    let spent = day ? dayCalories(day, ctx) : 0

    for (const slot of FILLABLE_SLOTS) {
      if (already.has(slot)) continue

      const remaining = Math.max(0, targets.calories - spent)
      const wanted = shareOfDay(slot) * targets.calories
      const budget = Math.min(wanted, remaining || wanted)

      const candidate = bestFor({
        slot, ctx, recipes, favouriteIds, pantry, portions, left, recent, budget,
      })
      if (!candidate) continue

      proposals.push({
        date, slot, entry: candidate.entry, why: candidate.why, calories: candidate.calories,
      })

      spent += candidate.calories
      recent.set(candidate.id, (recent.get(candidate.id) ?? 0) + 1)
      if (candidate.entry.kind === 'portion') {
        left.set(candidate.entry.portionId, (left.get(candidate.entry.portionId) ?? 0) - 1)
      }
    }
  }

  return proposals
}

/**
 * Roughly how a day divides.
 *
 * From the dietician's own plans rather than invented: breakfast and dinner
 * come in a little under lunch, and the snacks make up the rest, which this
 * does not fill.
 */
function shareOfDay(slot: MealSlot): number {
  return slot === 'lunch' ? 0.35 : 0.28
}

function dayCalories(day: DayPlan, ctx: NutritionContext): number {
  return componentsNutrients(day.meals.flatMap((m) => m.entries), ctx).calories
}

/** How many times each recipe or portion appears in the recent past. */
function recentlyUsed(plan: DayPlan[], from: string, days: number): Map<string, number> {
  const start = new Date(from + 'T12:00:00')
  start.setDate(start.getDate() - days)
  const since = start.toISOString().slice(0, 10)

  const counts = new Map<string, number>()
  for (const day of plan) {
    if (day.date < since || day.date > from) continue
    for (const meal of day.meals) {
      for (const entry of meal.entries) {
        const id = entry.kind === 'recipe' ? entry.recipeId
          : entry.kind === 'portion' ? entry.portionId : null
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
  }
  return counts
}

function bestFor({
  slot, ctx, recipes, favouriteIds, pantry, portions, left, recent, budget,
}: {
  slot: MealSlot
  ctx: NutritionContext
  recipes: Recipe[]
  favouriteIds: string[]
  pantry: Map<string, PantryItem>
  portions: Portion[]
  left: Map<string, number>
  recent: Map<string, number>
  budget: number
}): Candidate | undefined {
  const candidates: Candidate[] = []

  // Anything already cooked comes first and by a wide margin. It needs no
  // shopping, no cooking and no decision, and if it is not eaten it is thrown
  // away, which is the one outcome worth actively avoiding.
  for (const portion of offerOrder(portions)) {
    if ((left.get(portion.id) ?? 0) < 1) continue
    const entry: Component = { kind: 'portion', portionId: portion.id, servings: 1 }
    const calories = componentsNutrients([entry], ctx).calories
    candidates.push({
      entry,
      why: 'Already in the fridge',
      calories,
      score: 100 - (recent.get(portion.id) ?? 0) * 20,
      id: portion.id,
    })
  }

  for (const recipe of recipes) {
    if (!mealTimesOf(recipe).includes(slot === 'breakfast' ? 'breakfast' : slot === 'lunch' ? 'lunch' : 'dinner')) {
      continue
    }
    if (!recipe.components.length) continue

    const calories = recipePerServing(recipe, ctx).calories
    if (calories <= 0) continue

    const seen = recent.get(recipe.id) ?? 0
    const state = pantry.size ? availability(recipe, ctx, pantry) : null
    const reasons: string[] = []

    let score = 50

    // Eaten lately is the strongest thing pushing a dish down. Variety is most
    // of what people mean when they say a plan is any good.
    score -= seen * 25

    // How near it lands to what is left of the day.
    const fit = 1 - Math.min(1, Math.abs(calories - budget) / Math.max(budget, 1))
    score += fit * 25
    if (fit > 0.8) reasons.push('fits the day')

    if (favouriteIds.includes(recipe.id)) {
      score += 12
      reasons.push('one of your favourites')
    }

    if (state) {
      score += state.ratio * 20
      if (!state.missing.length) reasons.push('you have everything for it')
      else if (state.ratio >= 0.7) reasons.push('you have most of it')
    }

    candidates.push({
      entry: { kind: 'recipe', recipeId: recipe.id, servings: 1 },
      why: reasons.length ? capitalise(reasons.join(', ')) : 'Something different',
      calories,
      score,
      id: recipe.id,
    })
  }

  if (!candidates.length) return undefined

  // Sorted by score, then by id, so the same week proposes the same plan every
  // time. A suggestion that changes each time you look at it is one you cannot
  // discuss with the other person.
  candidates.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id))
  return candidates[0]
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
