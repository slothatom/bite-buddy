import type { DishCategory, Food, QuickFilter, RecipeComponent } from '../types'
import { DISH_CATEGORIES, QUICK_FILTERS } from './dishCategories'
import { searchFoods, type FoodIndex } from './foodSearch'

/**
 * Reading what the assistant sent back, sceptically.
 *
 * Everything here treats the reply as data from a stranger, because that is
 * what it is: a model's output is not a promise, and the only defence that
 * works is checking rather than hoping. Anything malformed is dropped, anything
 * unrecognised is dropped, and what survives is a draft a person then edits.
 *
 * The rule that does not bend: no nutrition comes from here. Ingredients are
 * matched to foods in your own database and every calorie is computed from
 * those, so a model that hallucinates cannot put a number on a screen about
 * what you eat.
 */

export interface DraftIngredient {
  /** The food it was matched to, if it was matched to one. */
  foodId?: string
  /** What the paste called it, kept whether or not it matched. */
  name: string
  grams: number
}

export interface RecipeDraft {
  name: string
  emoji: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  category?: DishCategory
  mealTypes: ('breakfast' | 'lunch' | 'dinner' | 'snack')[]
  quickFilters: QuickFilter[]
  ingredients: DraftIngredient[]
  steps: string[]
  note?: string
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

/**
 * The reply, if it is one.
 *
 * Returns undefined rather than throwing, and drops individual fields rather
 * than the whole draft: a recipe that arrives with one nonsense ingredient is
 * still worth showing you with the rest filled in.
 */
export function readDraft(value: unknown): RecipeDraft | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const name = text(raw.name)
  if (!name) return undefined

  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.flatMap(readIngredient)
    : []

  return {
    name,
    emoji: text(raw.emoji)?.slice(0, 4) ?? '🍽️',
    servings: count(raw.servings, 1),
    prepMinutes: count(raw.prepMinutes, 0),
    cookMinutes: count(raw.cookMinutes, 0),
    category: DISH_CATEGORIES.includes(raw.category as DishCategory)
      ? raw.category as DishCategory
      : undefined,
    mealTypes: list(raw.mealTypes).filter(
      (m): m is typeof MEAL_TYPES[number] => (MEAL_TYPES as readonly string[]).includes(m)),
    quickFilters: list(raw.quickFilters).filter(
      (f): f is QuickFilter => QUICK_FILTERS.includes(f as QuickFilter)),
    ingredients,
    steps: list(raw.steps).map((s) => s.trim()).filter(Boolean),
    note: text(raw.note),
  }
}

function readIngredient(value: unknown): DraftIngredient[] {
  if (typeof value !== 'object' || value === null) return []
  const raw = value as Record<string, unknown>
  const name = text(raw.name)
  const grams = count(raw.grams, 0)
  // An ingredient with no name or no weight is not an ingredient, it is noise,
  // and showing it would mean asking somebody to delete it.
  if (!name || grams <= 0) return []
  return [{ name, grams, foodId: text(raw.foodId) }]
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function count(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * 10) / 10
    : fallback
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export interface ResolvedIngredient extends DraftIngredient {
  /** The food this became, when one was found. */
  food?: Food
  /** How it was found, so the screen can say which ones need a person. */
  matched: 'given' | 'searched' | 'none'
}

/**
 * Turning names into foods you actually have.
 *
 * The assistant is asked to name ids from your database and usually manages it.
 * When it does not, this searches by name, which is the same search the recipe
 * editor uses, so a miss here means a miss there too and the answer is to add
 * the food rather than to guess.
 *
 * A match is never invented. An unresolved ingredient stays in the draft with
 * its name and weight, marked, because the person reading it knows what a
 * "handful of coriander" is and the app does not.
 */
export function resolveIngredients(
  draft: RecipeDraft,
  foods: Food[],
  index: FoodIndex,
): ResolvedIngredient[] {
  const byId = new Map(foods.map((f) => [f.id, f]))

  return draft.ingredients.map((ingredient) => {
    const given = ingredient.foodId ? byId.get(ingredient.foodId) : undefined
    if (given) return { ...ingredient, food: given, matched: 'given' as const }

    const [found] = searchFoods(ingredient.name, index, 1)
    if (found) return { ...ingredient, food: found, foodId: found.id, matched: 'searched' as const }

    return { ...ingredient, matched: 'none' as const }
  })
}

/** The components a recipe can be built from: the ones that found a food. */
export function componentsFrom(resolved: ResolvedIngredient[]): RecipeComponent[] {
  return resolved
    .filter((i) => i.foodId)
    .map((i) => ({ kind: 'food' as const, foodId: i.foodId!, grams: i.grams }))
}
