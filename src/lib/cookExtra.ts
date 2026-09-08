import type { Portion } from '../types'

/**
 * Cooking more than you are about to eat.
 *
 * The commonest thing that happens in this kitchen, and until now the app
 * only half knew about it. The recipe sheet asked how many you were cooking
 * and how many you were eating, put the eaten servings in the day, and then
 * said the rest "are leftovers, and the cook schedule can hold them", which
 * is a sentence describing a second screen you then had to go and use. The
 * planner did not ask at all: a recipe went into a day at one serving and
 * that was the end of it.
 *
 * So the surplus went nowhere. You cooked three, the app recorded one, and
 * the other two existed only in your fridge and your memory, which is exactly
 * the pair of places this app exists to stop being the only record.
 */

/**
 * What is left over, or nothing where nothing is.
 *
 * `madeOn` is the day the meal is planned for rather than today, because that
 * is the day the pot gets made. Cooking on Sunday for a Wednesday dinner and
 * dating the tub today would have the fridge saying it was three days older
 * than it is, and the kitchen nudges read that date.
 *
 * `source` is `batch` rather than `leftover`: a leftover is what survives a
 * meal you meant to finish, and this is a pot somebody deliberately made too
 * much of. The two look the same in the fridge and mean different things
 * about the cook.
 */
export function surplusOf({
  recipeId, cooking, eating, madeOn, id,
}: {
  recipeId: string
  cooking: number
  eating: number
  madeOn: string
  id: string
}): Portion | null {
  const spare = Math.round((cooking - eating) * 100) / 100
  if (spare <= 0) return null

  return {
    id,
    recipeId,
    servings: spare,
    madeOn,
    storage: 'fridge',
    source: 'batch',
  }
}

/** How the surplus is described, where there is any. */
export function surplusLine(cooking: number, eating: number): string | null {
  const spare = Math.round((cooking - eating) * 100) / 100
  if (spare <= 0) return null
  return `${spare} ${spare === 1 ? 'serving' : 'servings'} into the fridge`
}
