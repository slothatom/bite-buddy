import type { Food, PortionUnit } from '../types'

/**
 * Entering an amount in whatever unit is to hand.
 *
 * Grams are the only thing stored, because they are the only thing that
 * survives contact with the rest of the app: the dietician weighed everything,
 * the grocery list adds weights together, and a recipe that mixed cups and
 * grams could not be scaled. So every unit here is a way of saying a number of
 * grams, and the conversion happens the moment you type it rather than being
 * carried around.
 *
 * Two of these are approximations, and it is worth being straight about which:
 *
 *  - **Millilitres are treated as grams.** True for water and stock, near
 *    enough for milk (1.03) and yogurt, and out by about 8% for oil. At the
 *    quantities a kitchen scale can read that is under a gram for a spoonful.
 *  - **Spoons and cups are volumes being used as weights.** A tablespoon of
 *    oil and a tablespoon of flour are not the same weight, and this table
 *    cannot know which you meant. The values below are for liquids, which is
 *    what spoons are usually used for here; anything dry is better weighed.
 *
 * A "piece" is the one unit that depends on the food, a piece of an egg is
 * 55 g and a piece of an apple is 150 g, so it is read off the food's own
 * named portions and offered only when the food has one.
 */

export const PORTION_UNITS: PortionUnit[] = ['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'cup']

export const UNIT_LABELS: Record<PortionUnit, string> = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l', piece: 'piece', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup',
}

/** Grams in one of each unit, where that does not depend on the food. */
const GRAMS_PER_UNIT: Record<Exclude<PortionUnit, 'piece'>, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
}

/** Which units are estimates rather than measurements, for saying so in the UI. */
export const APPROXIMATE_UNITS: PortionUnit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup', 'piece']

/**
 * What one piece of this food weighs, if it is the sort of food that has pieces.
 *
 * Taken from the food's own named portions, "1 medium apple", "o lingurita" -
 * preferring one that sounds like a single item over a spoon measure.
 */
export function gramsPerPiece(food: Pick<Food, 'units'>): number | undefined {
  if (!food.units.length) return undefined
  const named = food.units.find((u) => !/lingur|spoon|tsp|tbsp|cup|cana/i.test(u.label))
  return (named ?? food.units[0]).grams
}

/** Whether this unit can be offered for this food at all. */
export function unitAvailable(unit: PortionUnit, food: Pick<Food, 'units'>): boolean {
  return unit !== 'piece' || gramsPerPiece(food) !== undefined
}

export function unitsFor(food: Pick<Food, 'units'>): PortionUnit[] {
  return PORTION_UNITS.filter((u) => unitAvailable(u, food))
}

/**
 * An amount in some unit, as grams.
 *
 * Returns undefined rather than guessing when the unit cannot be resolved -
 * asking for a piece of olive oil, say. Silently falling back to grams there
 * would turn "1 piece" into 1 g and put a plausible wrong number in a recipe.
 */
export function toGrams(
  amount: number,
  unit: PortionUnit,
  food?: Pick<Food, 'units'>,
): number | undefined {
  if (!Number.isFinite(amount) || amount < 0) return undefined

  if (unit === 'piece') {
    const per = food && gramsPerPiece(food)
    return per == null ? undefined : amount * per
  }
  return amount * GRAMS_PER_UNIT[unit]
}

/**
 * Grams back into a unit, for showing a stored amount the way it was entered.
 *
 * Only used for display; the stored value stays in grams either way.
 */
export function fromGrams(
  grams: number,
  unit: PortionUnit,
  food?: Pick<Food, 'units'>,
): number | undefined {
  const one = toGrams(1, unit, food)
  return one ? grams / one : undefined
}

/**
 * The unit to open on for a food.
 *
 * Grams for anything you would weigh, millilitres for anything you would pour.
 * Getting this right saves a tap on every ingredient.
 */
export function defaultUnit(food: Pick<Food, 'category'>): PortionUnit {
  return food.category === 'beverages' ? 'ml' : 'g'
}
