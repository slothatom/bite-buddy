import type { Recipe, RecipeTag } from '../types'

/**
 * A simpler way to talk about the recipe library.
 *
 * The library carries fifteen tags, and the Recipes screen used to offer
 * thirteen of them as filter chips side by side, meal times, diets and dish
 * shapes all in one row, as if "dinner", "vegan" and "soup" were the same kind
 * of choice. They are not, and mixing them is what made the library feel like a
 * dump: no arrangement, just a wall you filtered by guessing.
 *
 * So the tags are read through two axes instead:
 *
 *  - **Group**, when you eat it. Breakfast, Lunch, Dinner, Snacks, and Dishes
 *    for the batch-cooked things that are components of meals rather than meals.
 *    This is the shelf a recipe sits on, and every recipe sits on one.
 *  - **Category**, what the food is, one per recipe. See lib/dishCategories.ts.
 *  - **Quick filters**, what a recipe asks of you. Any number.
 *
 * The old tag list carried a fourth idea, a handful of "labels" (quick, batch,
 * veggie, high protein), which the quick filters replace outright, keeping both
 * would mean two ways to ask the same question. The dish-shaped tags it also
 * carried (soup, salad, spread) are now said better by the category.
 *
 * Nothing here is stored differently: this is a reading of the meal tags the
 * generated library already has, so the shipped recipes did not need re-tagging and
 * a tag this file has never heard of round-trips through the editor unharmed.
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
  snack: 'Between meals, mostly a fruit and a handful of nuts.',
  dish: 'Cooked once and eaten across several meals. These are the ones with a method.',
}

/** The tags that decide a group, in the order they are checked. */
const GROUP_TAGS = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' } as const

/**
 * Every shelf a recipe belongs on.
 *
 * A handful of dishes are written for two meals, the same lentil stew is lunch
 * on Friday and dinner on Saturday, so this returns a list rather than picking
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
 * opening on the full 228, which is the screen this replaces.
 */
export function groupForTime(now = new Date()): RecipeGroup {
  const h = now.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  return 'dinner'
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

// ─── Variants ────────────────────────────────────────────────────────────────

/**
 * The same dish, weighed differently.
 *
 * A recipe is generated for every distinct line across the fourteen plans, and
 * the dietician repeats a dish at different portions all the time: "Rolled oats
 * with yogurt & mixed berries" appears at 30, 40 and 45 g of oats. The importer
 * says so in the name, since a card has to be able to stand alone, but three
 * near-identical names in a row is not a library, it is a list.
 *
 * Grouped, they are one dish you can flip between portions of, which is what
 * they always were. The bracket at the end is what marks a portion: an ingredient
 * that differs is folded into the name instead, and that really is another dish.
 */
export function baseName(name: string): string {
  // Only the importer's own shapes, "(45 g rolled oats)", "(300 g)", "(no
  // yogurt garlic sauce)", and the numbering it used to append. A recipe you
  // named "Porridge (the good one)" keeps its bracket.
  return name.replace(/\s*\((?:\d+|\d+ g(?: [^()]+)?|no [^()]+)\)\s*$/, '')
}

export interface RecipeVariants {
  /** The name with the portion in brackets taken off. */
  name: string
  /**
   * Always at least one. The first is what the card shows and what opens when
   * you tap it, so it is chosen rather than left to the order they arrived in.
   */
  variants: Recipe[]
}

/**
 * The version that speaks for the group.
 *
 * One with the dietician's own line first. The card shows that line, and a
 * shelf holding two of a dish would show it while tapping through opened a
 * third version from elsewhere in the library that had no line at all, so the
 * provenance visibly disappeared between the card and the recipe. Whether a
 * version carries its source line is a property of the version, not of which
 * shelf you came from, so picking on that makes the two agree.
 */
function leadFirst(variants: Recipe[]): Recipe[] {
  const lead = variants.findIndex((r) => r.sourceLine)
  if (lead <= 0) return variants
  return [variants[lead], ...variants.filter((_, i) => i !== lead)]
}

export function groupVariants(recipes: Recipe[]): RecipeVariants[] {
  const byName = new Map<string, Recipe[]>()

  for (const recipe of recipes) {
    const name = baseName(recipe.name.en)
    const existing = byName.get(name)
    if (existing) existing.push(recipe)
    else byName.set(name, [recipe])
  }

  return [...byName].map(([name, variants]) => ({ name, variants: leadFirst(variants) }))
}
