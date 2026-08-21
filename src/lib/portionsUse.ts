import type { Component, Portion, Recipe } from '../types'
import { ageInDays } from '../store/usePortionStore'

/**
 * Deciding what to offer from the fridge, and in what order.
 *
 * The point of cooking in advance is that the next meal is already decided, so
 * the app's job is to put what exists in front of you at the moment you are
 * choosing, and to sort it the way a person would: what needs eating first.
 *
 * Nothing here throws anything away or refuses anything. It suggests an order
 * and says how old something is, and you are the one who can see the tub.
 */

/**
 * Oldest first within the fridge, then the freezer.
 *
 * Fridge before freezer because a fridge portion has days and a frozen one has
 * months, so of the two, the fridge is the one asking. Within each, oldest
 * first, for the same reason.
 */
export function offerOrder(portions: Portion[], today = new Date()): Portion[] {
  return [...portions]
    .filter((p) => p.servings > 0)
    .sort((a, b) => {
      if (a.storage !== b.storage) return a.storage === 'fridge' ? -1 : 1
      return ageInDays(b, today) - ageInDays(a, today)
    })
}

/** How a portion should read in a list: its recipe's name, or what you called it. */
export function portionLabel(portion: Portion, recipes: Map<string, Recipe>): string {
  return recipes.get(portion.recipeId ?? '')?.name.en ?? portion.label ?? 'Something cooked'
}

/**
 * How long ago, in the way somebody would say it.
 *
 * Not a warning. "Cooked 6 days ago" is a fact you can act on; "expired" is a
 * judgement the app is not entitled to make about food it cannot see.
 */
export function madeWhen(portion: Portion, today = new Date()): string {
  const days = ageInDays(portion, today)
  if (days === 0) return 'cooked today'
  if (days === 1) return 'cooked yesterday'
  if (days < 7) return `cooked ${days} days ago`
  if (days < 14) return 'cooked last week'
  const weeks = Math.round(days / 7)
  if (days < 60) return `cooked ${weeks} weeks ago`
  return `cooked ${Math.round(days / 30)} months ago`
}

/**
 * The portions a plan is already counting on.
 *
 * Planning a meal from the fridge takes the servings out immediately, so what
 * is left is what is left. This exists for the other direction: removing that
 * meal, or clearing the day, has to put them back, and to do that it has to
 * know which entries were portions.
 */
export function portionEntries(entries: Component[]): { portionId: string; servings: number }[] {
  return entries.flatMap((e) =>
    (e.kind === 'portion' ? [{ portionId: e.portionId, servings: e.servings }] : []))
}

/**
 * What a cook session produced, as portions.
 *
 * A session names the dishes it covers and the app knows how many servings each
 * recipe makes, so the honest default is exactly that: cook the recipe, get its
 * servings. It is a starting number on a form, not a claim, because a batch is
 * whatever fitted in the pan.
 */
export function portionsFromSession(
  recipeIds: string[],
  recipes: Map<string, Recipe>,
  madeOn: string,
  sessionId: string,
  /**
   * Deliberately derived from the session and the recipe rather than random.
   *
   * Ticking a session off twice, or two phones ticking it off at once, then
   * describes the same tub rather than creating a second one, and the whole
   * thing stays something you can compute rather than something you have to
   * remember.
   */
  newId: (recipeId: string) => string = (recipeId) => `${sessionId}-${recipeId}`,
): Portion[] {
  return recipeIds.flatMap((recipeId) => {
    const recipe = recipes.get(recipeId)
    if (!recipe) return []
    return [{
      id: newId(recipeId),
      recipeId,
      servings: Math.max(1, recipe.servings),
      madeOn,
      storage: 'fridge' as const,
      source: 'batch' as const,
      sessionId,
    }]
  })
}
