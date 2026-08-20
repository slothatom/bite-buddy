import type { Food } from '../types'

/**
 * Finding the same ingredient written down twice.
 *
 * Foods arrive from four directions: the curated list, a USDA search, an Open
 * Food Facts barcode, and typing one in. Nothing stops the same yogurt coming
 * in three of those ways, and once it has, every recipe that reaches for
 * yogurt has three things to choose between, all of them right. Worse, the
 * shopping list keys on the food, so one ingredient bought once appears as
 * three lines.
 *
 * Merging is a note saying which one is real. Nothing is deleted, because
 * recipes and plan lines already name the others by id. See the food store's
 * `mergedInto`.
 */

/** Names that differ only in case, spacing or punctuation are the same name. */
export function normalisedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * What a food amounts to per 100 g.
 *
 * Rounded, because two sources rarely agree to the decimal and a gram of
 * rounding drift is not a difference anybody eats. Weighed state is part of
 * it: 100 g of dry bulgur and 100 g of cooked bulgur are not the same food and
 * must never be merged.
 */
export function foodSignature(food: Food): string {
  const n = food.per100g
  return [
    food.state,
    Math.round(n.calories),
    Math.round(n.protein),
    Math.round(n.carbs),
    Math.round(n.fat),
  ].join('/')
}

export interface FoodDuplicates {
  /** The one to keep: curated first, else the oldest. */
  keep: Food
  /** The others, in library order. */
  fold: Food[]
}

/**
 * Groups of foods that are the same ingredient by every measure the app has.
 *
 * Two rules, and both have to hold. Same thing by name or by the source's own
 * id, so a barcode that matches an existing entry counts even when the name
 * reads differently, and the same numbers, so anything that would actually
 * change a total is left alone for you to look at rather than merged quietly.
 */
export function duplicateFoods(foods: Food[], isCurated: (id: string) => boolean): FoodDuplicates[] {
  const byKey = new Map<string, Food[]>()

  for (const food of foods) {
    // An external id is exact, so it takes precedence over the name.
    const key = food.provenance?.externalId
      ? `id:${food.provenance.source}:${food.provenance.externalId}`
      : `name:${normalisedName(food.names.en)}`
    const group = byKey.get(key)
    if (group) group.push(food)
    else byKey.set(key, [food])
  }

  const out: FoodDuplicates[] = []

  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const signature = foodSignature(group[0])
    if (!group.every((f) => foodSignature(f) === signature)) continue

    // Keep a curated food over an imported one: it carries the Romanian and
    // Hungarian names, the household units and the Mediterranean tier, none of
    // which a search result has.
    const keep = group.find((f) => isCurated(f.id)) ?? group[0]
    out.push({ keep, fold: group.filter((f) => f.id !== keep.id) })
  }

  return out.sort((a, b) => a.keep.names.en.localeCompare(b.keep.names.en))
}
