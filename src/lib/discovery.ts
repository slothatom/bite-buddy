import type { DayPlan, PantryItem, Recipe, Targets } from '../types'
import type { NutritionContext } from './nutrition'
import { recipePerServing, dayNutrients } from './nutrition'
import { availability } from './pantry'
import { flattenComponents } from './ingredients'

/**
 * The questions people actually ask a recipe list.
 *
 * Not "show me soups". Nobody stands in a kitchen at seven o'clock wondering
 * about categories; they wonder what is quick, what can be made from what is
 * in, what needs using, and what they have not had in a while. Each of those is
 * a different sort as much as a different filter, and each has a rule simple
 * enough to state on the screen, which is the test of whether it is honest.
 *
 * All of it is arithmetic over your own library and your own kitchen. Nothing
 * here needs a network, and nothing here can suggest a dish you do not have.
 */

export type Lens =
  | 'quick'      // under twenty minutes, start to plate
  | 'have'       // the cupboard covers all of it
  | 'use-first'  // uses something with a date on it
  | 'not-lately' // nothing like it in weeks
  | 'fits'       // lands inside what is left of today
  | 'batch'      // worth cooking once and eating three times

export interface LensDefinition {
  label: string
  emoji: string
  /** Said on screen, because a filter nobody can explain is one nobody trusts. */
  rule: string
}

export const LENSES: Record<Lens, LensDefinition> = {
  quick: {
    label: 'Quick tonight', emoji: '⚡',
    rule: 'Twenty minutes or less, start to plate, estimated for the imported meals. Quickest first.',
  },
  have: {
    label: 'From the cupboard', emoji: '🥫',
    rule: 'Everything it needs is something you have. Fewest ingredients first.',
  },
  'use-first': {
    label: 'Use it up', emoji: '⏳',
    rule: 'Uses something in the cupboard with a date on it. Soonest first.',
  },
  'not-lately': {
    label: 'Not lately', emoji: '🔁',
    rule: 'Nothing you have planned in the last month. Longest gap first.',
  },
  fits: {
    label: 'Fits today', emoji: '🎯',
    rule: 'Lands inside what is left of today against your target. Closest first.',
  },
  batch: {
    label: 'Worth a batch', emoji: '🍱',
    rule: 'Makes more than one meal, and the plans came back to it. Most used first.',
  },
}

export const LENS_ORDER: Lens[] = ['quick', 'have', 'use-first', 'fits', 'not-lately', 'batch']

export interface LensInput {
  recipes: Recipe[]
  ctx: NutritionContext
  today: string
  plan?: DayPlan[]
  pantry?: Map<string, PantryItem>
  targets?: Targets
  /** How far back "lately" reaches. A month, by default. */
  lookBackDays?: number
}

/**
 * The recipes a lens shows, in the order it shows them.
 *
 * Returns everything unchanged for a lens that cannot answer, rather than an
 * empty list: "Fits today" with no target set is a question the app has no way
 * to answer, and an empty screen would read as "you have no recipes".
 */
export function throughLens(lens: Lens, input: LensInput): Recipe[] {
  const { recipes, ctx, today, plan = [], pantry = new Map(), targets, lookBackDays = 30 } = input

  switch (lens) {
    case 'quick': {
      const minutes = (r: Recipe) => r.prepMinutes + r.cookMinutes
      return recipes.filter((r) => minutes(r) > 0 && minutes(r) <= 20)
        .sort((a, b) => minutes(a) - minutes(b) || a.id.localeCompare(b.id))
    }

    case 'have': {
      if (!pantry.size) return []
      return recipes
        .filter((r) => r.components.length > 0)
        .map((r) => ({ r, state: availability(r, ctx, pantry) }))
        .filter(({ state }) => state.missing.length === 0 && state.have.length > 0)
        .sort((a, b) => a.state.have.length - b.state.have.length || a.r.id.localeCompare(b.r.id))
        .map(({ r }) => r)
    }

    case 'use-first': {
      const dated = [...pantry.values()]
        .filter((i) => i.useBy)
        .sort((a, b) => (a.useBy ?? '').localeCompare(b.useBy ?? ''))
      if (!dated.length) return []

      const soonest = new Map(dated.map((i) => [i.foodId, i.useBy as string]))
      return recipes
        .map((r) => ({ r, by: earliestDate(r, ctx, soonest) }))
        .filter(({ by }) => by !== undefined)
        .sort((a, b) => (a.by as string).localeCompare(b.by as string) || a.r.id.localeCompare(b.r.id))
        .map(({ r }) => r)
    }

    case 'not-lately': {
      const since = shiftDays(today, -lookBackDays)
      const lastSeen = new Map<string, string>()
      for (const day of plan) {
        if (day.date > today) continue
        for (const meal of day.meals) {
          for (const entry of meal.entries) {
            if (entry.kind !== 'recipe') continue
            const seen = lastSeen.get(entry.recipeId)
            if (!seen || day.date > seen) lastSeen.set(entry.recipeId, day.date)
          }
        }
      }

      return recipes
        .filter((r) => (lastSeen.get(r.id) ?? '') < since)
        // Never planned sorts first: the longest gap of all is all of them.
        .sort((a, b) =>
          (lastSeen.get(a.id) ?? '').localeCompare(lastSeen.get(b.id) ?? '')
          || a.id.localeCompare(b.id))
    }

    case 'fits': {
      if (!targets?.calories) return []
      const day = plan.find((d) => d.date === today)
      const spent = day ? dayNutrients(day, ctx).calories : 0
      const left = targets.calories - spent
      if (left <= 0) return []

      return recipes
        .map((r) => ({ r, kcal: recipePerServing(r, ctx).calories }))
        .filter(({ kcal }) => kcal > 0 && kcal <= left)
        .sort((a, b) => (left - a.kcal) - (left - b.kcal) || a.r.id.localeCompare(b.r.id))
        .map(({ r }) => r)
    }

    case 'batch': {
      // "Four servings or more" matched nothing at all here. The dietician
      // cooks for two, so a batch in this library is a pot of soup that does
      // two dinners, and the evidence that it is worth making is that she
      // cooked it again: the tray of roasted vegetables feeds seven of the 481
      // meals. A recipe of your own carries no such record, so the old rule
      // stays alongside it for anything that plainly makes a crowd.
      const worth = (r: Recipe) =>
        r.servings >= 4 || (r.servings >= 2 && (r.timesPlanned ?? 0) >= 2)

      return recipes
        .filter((r) => r.components.length > 0 && worth(r))
        .sort((a, b) =>
          (b.timesPlanned ?? 0) - (a.timesPlanned ?? 0)
          || b.servings - a.servings
          || a.id.localeCompare(b.id))
    }
  }
}

/** The nearest date on anything this recipe uses, if it uses anything dated. */
function earliestDate(
  recipe: Recipe,
  ctx: NutritionContext,
  dated: Map<string, string>,
): string | undefined {
  let soonest: string | undefined
  for (const ingredient of flattenComponents(recipe.components, ctx, { skip: ['water'] })) {
    const by = dated.get(ingredient.foodId)
    if (by && (!soonest || by < soonest)) soonest = by
  }
  return soonest
}

function shiftDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Whether a lens has anything to work with.
 *
 * Offered rather than hidden when it does not: a chip that vanishes depending
 * on the state of your cupboard is a chip you cannot learn. Shown disabled,
 * with the reason, is the honest version.
 */
export function lensReady(lens: Lens, input: LensInput): boolean {
  if (lens === 'have') return input.pantry ? input.pantry.size > 0 : false
  if (lens === 'use-first') return [...(input.pantry?.values() ?? [])].some((i) => i.useBy)
  if (lens === 'fits') return Boolean(input.targets?.calories)
  return true
}

/** Why a lens cannot answer, in a sentence that says what to do about it. */
export function lensBlocker(lens: Lens): string {
  if (lens === 'have') return 'Add a few things to the cupboard first, on the shopping list screen.'
  if (lens === 'use-first') return 'Put a use-by date on something in the cupboard first.'
  if (lens === 'fits') return 'Set a daily calorie target first, in Settings.'
  return ''
}
