import type { Recipe, RecipeTag } from '../types'

/**
 * A simpler way to talk about the recipe library.
 *
 * The library carries fifteen tags, and the Recipes screen used to offer
 * thirteen of them as filter chips side by side — meal times, diets and dish
 * shapes all in one row, as if "dinner", "vegan" and "soup" were the same kind
 * of choice. They are not, and mixing them is what made 275 recipes feel like a
 * dump: no arrangement, just a wall you filtered by guessing.
 *
 * So the tags are read through two axes instead:
 *
 *  - **Group** — when you eat it. Breakfast, Lunch, Dinner, Snacks, and Dishes
 *    for the batch-cooked things that are components of meals rather than meals.
 *    This is the shelf a recipe sits on, and every recipe sits on one.
 *  - **Label** — four optional notes about the cooking: quick, batch, veggie,
 *    high protein. These are filters, not shelves.
 *
 * Everything else a recipe is tagged with (soup, salad, spread, low-carb…)
 * survives untouched and is shown on the recipe itself, but no longer competes
 * for space at the top of the screen. Nothing is stored differently — this is a
 * reading of the tags that already exist, so the 275 generated recipes did not
 * need re-tagging and any tag this file does not know about round-trips through
 * the editor unharmed.
 */

// ─── Groups ──────────────────────────────────────────────────────────────────

export type RecipeGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dish'

/** Display order: the day, then the things you cook to fill it. */
export const RECIPE_GROUPS: RecipeGroup[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dish']

export const GROUP_LABELS: Record<RecipeGroup, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  dish: 'Dishes',
}

/** Shown under the heading, so "Dishes" does not need explaining twice. */
export const GROUP_BLURBS: Record<RecipeGroup, string> = {
  breakfast: 'How the plans started the day.',
  lunch: 'The midday meals, as your dietician wrote them.',
  dinner: 'Evening meals from the fourteen weeks.',
  snack: 'Between meals — mostly a fruit and a handful of nuts.',
  dish: 'Cooked once and eaten across several meals. These are the ones with a method.',
}

/** The tags that decide a group, in the order they are checked. */
const GROUP_TAGS = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' } as const

/**
 * Every shelf a recipe belongs on.
 *
 * A handful of dishes are written for two meals — the same lentil stew is lunch
 * on Friday and dinner on Saturday — so this returns a list rather than picking
 * a winner, and those recipes appear under both.
 */
export function groupsOf(recipe: Pick<Recipe, 'tags'>): RecipeGroup[] {
  const groups = (Object.keys(GROUP_TAGS) as (keyof typeof GROUP_TAGS)[])
    .filter((g) => recipe.tags.includes(GROUP_TAGS[g]))

  // No meal tag means it is not a meal: it is something you cook and then use.
  return groups.length ? groups : ['dish']
}

/** The one to show on a card, when there is only room for one. */
export function primaryGroupOf(recipe: Pick<Recipe, 'tags'>): RecipeGroup {
  return groupsOf(recipe)[0]
}

/**
 * Which shelf to open on.
 *
 * Opening on Breakfast at nine in the morning is right far more often than
 * opening on the full 275, which is the screen this replaces.
 */
export function groupForTime(now = new Date()): RecipeGroup {
  const h = now.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  return 'dinner'
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export type RecipeLabel = 'quick' | 'batch' | 'veggie' | 'high-protein'

export const RECIPE_LABELS: RecipeLabel[] = ['quick', 'batch', 'veggie', 'high-protein']

/**
 * Four, deliberately.
 *
 * "Veggie" covers both vegan and vegetarian: the difference matters when you are
 * cooking for someone else, and neither of the two people using this is vegan,
 * so as a filter it only ever split one small pile into two smaller ones.
 */
export const LABEL_DEFINITIONS: Record<RecipeLabel, { label: string; tags: RecipeTag[] }> = {
  quick: { label: 'Quick', tags: ['quick'] },
  batch: { label: 'Batch cook', tags: ['batch'] },
  veggie: { label: 'Veggie', tags: ['vegan', 'vegetarian'] },
  'high-protein': { label: 'High protein', tags: ['high-protein'] },
}

export function hasLabel(recipe: Pick<Recipe, 'tags'>, label: RecipeLabel): boolean {
  return LABEL_DEFINITIONS[label].tags.some((t) => recipe.tags.includes(t))
}

/**
 * Tags that are neither a group nor a label — soup, salad, spread, low-carb,
 * pescatarian, dessert. Shown on the recipe, never as a filter chip.
 */
export function otherTags(recipe: Pick<Recipe, 'tags'>): RecipeTag[] {
  const claimed = new Set<string>([
    ...Object.values(GROUP_TAGS),
    ...RECIPE_LABELS.flatMap((l) => LABEL_DEFINITIONS[l].tags),
  ])
  return recipe.tags.filter((t) => !claimed.has(t))
}

// ─── Editing ─────────────────────────────────────────────────────────────────

/**
 * Rewrites the group tags, leaving everything else exactly as it was.
 *
 * The editor only ever offers the simplified axes, so it must not quietly drop
 * the tags it does not show. Passing `['dish']` clears the meal tags, which is
 * how a recipe becomes a component of other recipes rather than a meal.
 */
export function withGroups(tags: RecipeTag[], groups: RecipeGroup[]): RecipeTag[] {
  const mealTags = new Set<string>(Object.values(GROUP_TAGS))
  const kept = tags.filter((t) => !mealTags.has(t))
  const added = groups
    .filter((g): g is Exclude<RecipeGroup, 'dish'> => g !== 'dish')
    .map((g) => GROUP_TAGS[g])

  return [...added, ...kept]
}

/**
 * Turns one label on or off.
 *
 * Turning "veggie" on adds `vegetarian` — the safe half of the pair — unless the
 * recipe is already tagged `vegan`, which is the stronger claim and is kept.
 * Turning it off removes both, because leaving one behind would mean the chip
 * you just switched off is still lit.
 */
export function withLabel(tags: RecipeTag[], label: RecipeLabel, on: boolean): RecipeTag[] {
  const definition = LABEL_DEFINITIONS[label]
  const without = tags.filter((t) => !definition.tags.includes(t))
  if (!on) return without
  if (definition.tags.some((t) => tags.includes(t))) return tags

  // The last tag of a pair is the default: vegetarian rather than vegan.
  return [...without, definition.tags[definition.tags.length - 1]]
}

// ─── Variants ────────────────────────────────────────────────────────────────

/**
 * The same dish, weighed differently.
 *
 * A recipe was generated for every distinct line across the fourteen plans, and
 * the dietician repeats a dish at different portions all the time — so 68 of the
 * 204 meals are called something like "Green bean soup with wholemeal bread &
 * yogurt (3)". As separate cards they are a third of the library and pure noise:
 * four near-identical names in a row, differing only in grams.
 *
 * Grouped, they are one dish you can flip between portions of, which is what
 * they always were.
 */
export function baseName(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, '')
}

export interface RecipeVariants {
  /** The name with the generator's numbering taken off. */
  name: string
  /** Always at least one, in the order they were given. */
  variants: Recipe[]
}

export function groupVariants(recipes: Recipe[]): RecipeVariants[] {
  const byName = new Map<string, RecipeVariants>()

  for (const recipe of recipes) {
    const name = baseName(recipe.name.en)
    const existing = byName.get(name)
    if (existing) existing.variants.push(recipe)
    else byName.set(name, { name, variants: [recipe] })
  }

  return [...byName.values()]
}
