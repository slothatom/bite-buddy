import type { DishCategory, QuickFilter, Recipe } from '../types'
import { groupsOf, type RecipeGroup } from './recipeGroups'

/**
 * The three axes a recipe is described by.
 *
 *   meal time , when you eat it. Several, and it comes from the plans.
 *   category  , what the food is. Exactly one.
 *   filters   , what it asks of you. Any number.
 *
 * Keeping them apart is the whole point. The old single row of tags mixed all
 * three, so "dinner", "soup" and "quick" sat side by side as if they answered
 * the same question, and none of them narrowed anything usefully.
 *
 * A category says what the food *is*, never when it is eaten, how it is served
 * or how it was cooked. That rules out "Main", "Side", "Starter" and "Bowl":
 * those describe a role at a table, and a role tells you nothing when you are
 * standing in a kitchen deciding what to make.
 */

// ─── Categories ──────────────────────────────────────────────────────────────

/** Ordered roughly by how much of a meal each one usually is. */
export const DISH_CATEGORIES: DishCategory[] = [
  'soup', 'stew', 'curry', 'salad', 'pasta', 'noodles', 'rice', 'grain',
  'sandwich', 'wrap', 'burger', 'pizza', 'taco', 'quesadilla',
  'omelette', 'egg', 'meat', 'fish', 'seafood', 'vegetable',
  'porridge', 'cereal', 'pancake', 'waffle', 'bread', 'toast', 'pastry',
  'cheese', 'yogurt', 'dip', 'sauce',
  'fruit', 'snack', 'dessert', 'cake', 'cookie', 'smoothie', 'drink',
]

export const CATEGORY_LABELS: Record<DishCategory, string> = {
  soup: 'Soup', stew: 'Stew', curry: 'Curry', salad: 'Salad',
  pasta: 'Pasta', noodles: 'Noodles', rice: 'Rice', grain: 'Grain',
  sandwich: 'Sandwich', wrap: 'Wrap', burger: 'Burger', pizza: 'Pizza',
  taco: 'Taco', quesadilla: 'Quesadilla',
  omelette: 'Omelette', egg: 'Egg', meat: 'Meat', fish: 'Fish',
  seafood: 'Seafood', vegetable: 'Vegetable',
  porridge: 'Porridge', cereal: 'Cereal', pancake: 'Pancake', waffle: 'Waffle',
  bread: 'Bread', toast: 'Toast', pastry: 'Pastry',
  cheese: 'Cheese', yogurt: 'Yogurt', dip: 'Dip', sauce: 'Sauce',
  fruit: 'Fruit', snack: 'Snack', dessert: 'Dessert', cake: 'Cake',
  cookie: 'Cookie', smoothie: 'Smoothie', drink: 'Drink',
}

/**
 * When each kind of food usually gets eaten.
 *
 * This is a *default*, never an override. A recipe's own meal times come from
 * the fourteen plans, actual evidence of when it was actually eaten, and
 * always win. The mapping fills the gap in the two places there is no evidence:
 * choosing the meal times for a recipe you are writing, and offering the
 * batch-cooked dishes, which carry no meal time of their own, in the planner's
 * picker for a slot.
 */
export const CATEGORY_MEAL_TIMES: Record<DishCategory, RecipeGroup[]> = {
  soup: ['lunch', 'dinner'],
  stew: ['lunch', 'dinner'],
  curry: ['lunch', 'dinner'],
  salad: ['lunch', 'dinner'],
  pasta: ['lunch', 'dinner'],
  noodles: ['lunch', 'dinner'],
  rice: ['lunch', 'dinner'],
  // Bulgur, couscous, quinoa, and mămăligă when it is a side rather than a
  // breakfast bowl, which is why Porridge is a separate category.
  grain: ['lunch', 'dinner'],
  sandwich: ['breakfast', 'lunch', 'dinner', 'snack'],
  wrap: ['lunch', 'dinner', 'snack'],
  burger: ['lunch', 'dinner'],
  pizza: ['lunch', 'dinner', 'snack'],
  taco: ['lunch', 'dinner'],
  quesadilla: ['lunch', 'dinner', 'snack'],
  omelette: ['breakfast', 'lunch', 'dinner'],
  egg: ['breakfast', 'lunch', 'dinner'],
  meat: ['lunch', 'dinner'],
  fish: ['lunch', 'dinner'],
  seafood: ['lunch', 'dinner'],
  vegetable: ['lunch', 'dinner'],
  porridge: ['breakfast'],
  cereal: ['breakfast'],
  pancake: ['breakfast', 'snack'],
  waffle: ['breakfast', 'snack'],
  bread: ['breakfast', 'lunch', 'dinner', 'snack'],
  toast: ['breakfast', 'lunch', 'snack'],
  pastry: ['breakfast', 'snack'],
  cheese: ['breakfast', 'lunch', 'dinner', 'snack'],
  yogurt: ['breakfast', 'snack'],
  dip: ['breakfast', 'lunch', 'dinner', 'snack'],
  sauce: ['lunch', 'dinner'],
  fruit: ['breakfast', 'lunch', 'snack'],
  snack: ['snack'],
  dessert: ['snack'],
  cake: ['breakfast', 'snack'],
  cookie: ['snack'],
  smoothie: ['breakfast', 'snack'],
  drink: ['breakfast', 'lunch', 'dinner', 'snack'],
}

// ─── Quick filters ───────────────────────────────────────────────────────────

export const QUICK_FILTERS: QuickFilter[] = [
  'quick', 'lazy', 'meal-prep', 'leftovers', 'one-pan', 'freezer', 'light',
  'cozy', 'high-protein', 'veggie-packed', 'budget', 'pantry',
  'fridge-clearout', 'special',
]

/**
 * The emoji are part of the label, not decoration: at chip size on a phone this
 * row is scanned rather than read, and the picture lands before the words do.
 *
 * `derived` marks the ones the app can work out for itself from the recipe -
 * time, macros, what goes in. The rest are judgements about your week that no
 * amount of nutrition data can supply, so they start empty and are yours to
 * apply. Guessing at them would fill the library with confident nonsense.
 */
export const QUICK_FILTER_DEFINITIONS: Record<QuickFilter, {
  label: string
  emoji: string
  derived: boolean
  note: string
}> = {
  quick: { label: 'Quick & Easy', emoji: '⚡', derived: true, note: 'On the table in twenty minutes.' },
  lazy: { label: 'Lazy Meals', emoji: '🛋️', derived: false, note: 'Barely counts as cooking.' },
  'meal-prep': { label: 'Meal Prep', emoji: '🍱', derived: true, note: 'Makes more than one serving on purpose.' },
  leftovers: { label: 'Leftovers', emoji: '🥡', derived: false, note: 'Good again the next day.' },
  'one-pan': { label: 'One-Pan / One-Pot', emoji: '🍳', derived: true, note: 'One thing to wash up.' },
  freezer: { label: 'Freezer Friendly', emoji: '❄️', derived: true, note: 'Freezes and comes back unharmed.' },
  light: { label: 'Light & Fresh', emoji: '🥗', derived: true, note: 'Under 350 kcal and not heavy.' },
  cozy: { label: 'Cozy & Comforting', emoji: '🥘', derived: true, note: 'Warm, slow, the sort of thing you want in February.' },
  'high-protein': { label: 'High Protein', emoji: '💪', derived: true, note: 'At least 25 g a serving.' },
  'veggie-packed': { label: 'Veggie Packed', emoji: '🥦', derived: true, note: 'Half the plate or more is vegetables.' },
  // Not derived: the app holds no prices, and the nearest guess was true of
  // 83% of the library. See lib/classify.ts.
  budget: { label: 'Budget Friendly', emoji: '💸', derived: false, note: 'Cheap to put on the table.' },
  pantry: { label: 'Pantry Rescue', emoji: '🧺', derived: true, note: 'Made from things that keep.' },
  'fridge-clearout': { label: 'Fridge Clean-Out', emoji: '🧹', derived: false, note: 'Whatever needs using up.' },
  special: { label: 'Special Occasion', emoji: '🎉', derived: false, note: 'Worth the effort, now and then.' },
}

/** The ones you have to apply yourself, because nothing in the data implies them. */
export const HAND_APPLIED_FILTERS = QUICK_FILTERS.filter((f) => !QUICK_FILTER_DEFINITIONS[f].derived)

export function quickFilterLabel(filter: QuickFilter): string {
  const d = QUICK_FILTER_DEFINITIONS[filter]
  return `${d.emoji} ${d.label}`
}

// ─── Reading them off a recipe ───────────────────────────────────────────────

export function hasQuickFilter(recipe: Pick<Recipe, 'quickFilters'>, filter: QuickFilter): boolean {
  return recipe.quickFilters?.includes(filter) ?? false
}

/** Turns one filter on or off, keeping the declared order so the list is stable. */
export function withQuickFilter(
  current: QuickFilter[] | undefined,
  filter: QuickFilter,
  on: boolean,
): QuickFilter[] {
  const set = new Set(current ?? [])
  if (on) set.add(filter)
  else set.delete(filter)
  return QUICK_FILTERS.filter((f) => set.has(f))
}

/**
 * When a recipe is eaten, falling back to what its category implies.
 *
 * The fallback matters for exactly one group: the batch-cooked dishes, which
 * were never a meal in a plan and so carry no meal time of their own. Without
 * it, asking the planner for something to put in a lunch slot would never offer
 * you the lentil stew.
 */
export function mealTimesOf(recipe: Pick<Recipe, 'tags' | 'category'>): RecipeGroup[] {
  const own = groupsOf(recipe)
  if (!own.includes('dish')) return own
  return recipe.category ? CATEGORY_MEAL_TIMES[recipe.category] : []
}
