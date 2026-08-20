import type { Recipe } from '../types'
import { recipePerServing, type NutritionContext } from './nutrition'
import type { RecipeVariants } from './recipeGroups'

/**
 * Merging a dish that got written down more than once.
 *
 * Grouping the repeats made the list readable, but they are still 275 separate
 * recipes underneath: the planner's picker offers all of them, and picking
 * "Green bean soup" means picking one of four identical things for no reason.
 * Merging collapses a group for real.
 *
 * Nothing is deleted. A merge records "this recipe is really that one", and
 * every lookup follows the note, which is what makes it safe to merge
 * something your plan already points at, or something one of the fourteen
 * archived weeks refers to. Those references live in code and cannot be
 * rewritten; they resolve through the note instead, and undoing the merge puts
 * everything back exactly as it was.
 */

/**
 * What a version amounts to, once cooked.
 *
 * Two versions with the same signature are the same food by every measure the
 * app has, merging them cannot lose anything. Rounded because a gram of
 * rounding drift between two ways of writing the same meal is not a difference
 * anybody eats.
 */
export function recipeSignature(recipe: Recipe, ctx: NutritionContext): string {
  const n = recipePerServing(recipe, ctx)
  return [n.calories, n.protein, n.carbs, n.fat].map((v) => Math.round(v)).join('/')
}

/**
 * The groups where merging needs no decision from you.
 *
 * A group whose versions differ, 259 kcal against 408, is a real choice about
 * which portion to keep, so it is left alone and offered one at a time instead.
 */
export function interchangeableGroups(
  groups: RecipeVariants[],
  ctx: NutritionContext,
): RecipeVariants[] {
  return groups.filter((g) => {
    if (g.variants.length < 2) return false
    const first = recipeSignature(g.variants[0], ctx)
    return g.variants.every((v) => recipeSignature(v, ctx) === first)
  })
}

/**
 * Follows the notes to whatever a recipe id really means now.
 *
 * Chains are possible, merge A into B, then B into C, so this walks until it
 * stops moving, with a bound in case a bad write ever makes a cycle. A cycle
 * would otherwise hang every screen that resolves a recipe.
 */
export function resolveMerged(merged: Record<string, string>, id: string): string {
  let current = id
  for (let steps = 0; steps < 16; steps++) {
    const next = merged[current]
    if (!next || next === current) return current
    current = next
  }
  return current
}

/**
 * The notes after merging `loserIds` into `winnerId`.
 *
 * Two cases have to be handled or the map goes wrong quietly:
 *
 *  - merging something that is itself already a winner, whose own losers must
 *    come along rather than be left pointing at a recipe that is now hidden;
 *  - a loser that is the winner, which would map a recipe to itself and make it
 *    disappear from the library with nothing to show in its place.
 */
export function planMerge(
  merged: Record<string, string>,
  winnerId: string,
  loserIds: string[],
): Record<string, string> {
  const winner = resolveMerged(merged, winnerId)
  const losers = new Set(loserIds.map((id) => resolveMerged(merged, id)))
  losers.delete(winner)

  const next: Record<string, string> = {}
  // Anything that already pointed at one of the losers now points at the winner.
  for (const [from, to] of Object.entries(merged)) {
    next[from] = losers.has(to) ? winner : to
  }
  for (const id of loserIds) {
    if (id !== winner) next[id] = winner
  }
  for (const id of losers) next[id] = winner

  return next
}

/** Everything merged into this recipe, what an "undo" would bring back. */
export function mergedIntoRecipe(merged: Record<string, string>, winnerId: string): string[] {
  return Object.keys(merged).filter((id) => resolveMerged(merged, id) === winnerId)
}

/** The notes with every merge into `winnerId` undone. */
export function planUnmerge(
  merged: Record<string, string>,
  winnerId: string,
): Record<string, string> {
  const undone = new Set(mergedIntoRecipe(merged, winnerId))
  return Object.fromEntries(Object.entries(merged).filter(([from]) => !undone.has(from)))
}
