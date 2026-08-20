import type { DishCategory, QuickFilter, Recipe } from '../types'
import { recipePerServing, type NutritionContext } from './nutrition'

/**
 * Working out what a recipe is, from what goes in it.
 *
 * The 275 shipped recipes were generated from the dietician's lines, which
 * never say "this is a soup" — they say "350 g supă de fasole verde, 25 g pâine
 * int". So the category has to be read off the food, and the rules below are
 * the reading. They are checked in rather than run once and forgotten, so the
 * classification of the whole library can be re-derived and argued with.
 *
 * Three rules decide almost everything:
 *
 *  - **Only the head of the name counts.** Every generated meal is named
 *    "PRIMARY with SIDE & SIDE" — "Roasted vegetables with salmon & yogurt
 *    garlic sauce" — so the part before " with " is the dish and the rest is
 *    what came alongside. Reading the whole name made that a sauce.
 *  - **English only.** The Romanian lines are full of false friends: "pastă de
 *    brânză" is a cheese *spread*, and matching "pasta" on it filed fifteen
 *    spreads under Pasta.
 *  - **Otherwise, the heaviest thing that is not a side.** These meals are
 *    plates, and what makes it a meal is the protein, not the bread that comes
 *    with everything.
 *
 * One gap worth stating: the given categories have Rice, Pasta and Noodles but
 * nothing for the other grains, and this library runs on bulgur, couscous,
 * quinoa and mămăligă. Those dishes fall through to their protein, which reads
 * correctly ("Bulgur with chicken breast" is a meat dish) but means there is no
 * way to ask for "a grain bowl". A `grain` category would fix it in one line.
 */

// ─── Category ────────────────────────────────────────────────────────────────

/** Words in a recipe name that settle the matter, most specific first. */
const NAME_RULES: [RegExp, DishCategory][] = [
  [/\bsmoothie\b/i, 'smoothie'],
  [/\bquesadilla/i, 'quesadilla'],
  [/\btaco/i, 'taco'],
  [/\bburger/i, 'burger'],
  [/\bpizza/i, 'pizza'],
  [/\bwrap\b/i, 'wrap'],
  [/\bsandwich/i, 'sandwich'],
  [/\btoast\b/i, 'toast'],
  [/\bwaffle/i, 'waffle'],
  [/\bpancake|clatit/i, 'pancake'],
  [/\bspread|p[âa]t[ée]|hummus|humus|guacamole|\bdip\b/i, 'dip'],
  [/\bcurry\b/i, 'curry'],
  [/\b(soup|ciorb|sup[ăa])\b/i, 'soup'],
  [/\b(stew|goulash|chili con carne|tocan)/i, 'stew'],
  [/\bsalad\b/i, 'salad'],
  [/\bpasta\b|spaghetti|penne|lasagn/i, 'pasta'],
  [/\bnoodle/i, 'noodles'],
  [/\brisotto|\brice\b(?! cakes)/i, 'rice'],
  [/\bomelette|shakshuka|scrambled|fried eggs/i, 'omelette'],
  [/\bporridge|polenta|m[ăa]m[ăa]lig/i, 'porridge'],
  [/\bmuesli|granola|cereal/i, 'cereal'],
  [/\bpudding|ice bar|brownie|chocolate\b/i, 'dessert'],
  [/\boats?\b|oatmeal/i, 'porridge'],
  [/\bloaf\b|\bcake\b|banana bread/i, 'cake'],
  [/\bcookie|biscuit/i, 'cookie'],
  [/\bpastry|croissant|pie\b/i, 'pastry'],
  [/\bsauce\b|salsa\b/i, 'sauce'],
  [/\begg\b|\beggs\b/i, 'egg'],
  [/\bmuffin|patties|fritters/i, 'vegetable'],
]

/**
 * Foods that come with everything and so never decide what a meal is.
 *
 * Every plate in these plans has bread and a pile of vegetables next to it. If
 * weight alone decided, almost every lunch would be classified "bread".
 */
const ALWAYS_A_SIDE = new Set([
  'bread-wholemeal', 'flatbread-wholemeal', 'rice-cakes', 'olive-oil', 'olives',
  'salad-raw', 'vegetables-mixed', 'pickles', 'lemon-juice', 'mustard',
  'basil', 'cinnamon', 'dill', 'parsley', 'vanilla-extract', 'honey', 'water',
])

/** What a food's own group implies, when the name has not already decided. */
const FOOD_CATEGORY: Record<string, DishCategory> = {
  'fish-seafood': 'fish',
  poultry: 'meat',
  'red-meat': 'meat',
  eggs: 'egg',
  dairy: 'cheese',
  legumes: 'stew',
  vegetables: 'vegetable',
  fruits: 'fruit',
  'nuts-seeds': 'snack',
  grains: 'porridge',
  treats: 'dessert',
  'spreads-sauces': 'dip',
  beverages: 'drink',
  'fats-vinegars': 'sauce',
  'herbs-spices': 'sauce',
  sweeteners: 'dessert',
  pantry: 'snack',
}

/** Shrimp and the like are seafood; fish is fish. */
const SEAFOOD = new Set(['shrimp'])

/**
 * The category for one recipe.
 *
 * Nested recipes are followed, since a meal is often "one serving of the lentil
 * stew" plus bread and the stew is where the answer is.
 */
export function categorise(recipe: Recipe, ctx: NutritionContext): DishCategory {
  for (const [pattern, category] of NAME_RULES) {
    if (pattern.test(headOfName(recipe.name.en))) return category
  }

  // Nothing in the name, so ask the food. Yogurt is called out because it is a
  // dairy food that is a meal in its own right at breakfast.
  const weights = weighFoods(recipe, ctx)
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1])
  // Sides are set aside first, but a dish that is *only* sides — "Roasted
  // vegetables" — still has to be something, so they come back rather than
  // falling through to a meaningless "snack".
  const lead = ranked.find(([id]) => !ALWAYS_A_SIDE.has(id)) ?? ranked[0]

  if (!lead) return 'snack'
  const [foodId] = lead
  if (foodId === 'yogurt' || foodId === 'kefir') return 'yogurt'
  if (SEAFOOD.has(foodId)) return 'seafood'

  const food = ctx.foods.get(foodId)
  return (food && FOOD_CATEGORY[food.category]) ?? 'snack'
}

/**
 * The dish, without what came alongside it.
 *
 * "Carrot salad with cottage cheese & wholemeal bread" is a salad; the cheese
 * and the bread are the plate around it. The generator wrote every one of these
 * names the same way, so the split is reliable.
 */
export function headOfName(name: string): string {
  return name.split(/\s+with\s+|,\s+/i)[0]
}

/** Grams of each food in a recipe, following nested recipes down. */
function weighFoods(
  recipe: Recipe,
  ctx: NutritionContext,
  scale = 1,
  seen = new Set<string>(),
  into = new Map<string, number>(),
): Map<string, number> {
  if (seen.has(recipe.id)) return into
  seen.add(recipe.id)

  for (const c of recipe.components) {
    if (c.kind === 'food') {
      into.set(c.foodId, (into.get(c.foodId) ?? 0) + c.grams * scale)
      continue
    }
    const nested = ctx.recipes.get(c.recipeId)
    if (nested) {
      const per = nested.servings > 0 ? nested.servings : 1
      weighFoods(nested, ctx, (scale * c.servings) / per, seen, into)
    }
  }
  return into
}

// ─── Quick filters ───────────────────────────────────────────────────────────

/** Categories that are a hot bowl of something. */
const COZY: DishCategory[] = ['soup', 'stew', 'curry', 'porridge']
/** Categories that survive a freezer without turning to mush. */
const FREEZABLE: DishCategory[] = ['soup', 'stew', 'curry', 'sauce']
/** Categories that are cooked in a single pan or pot by their nature. */
const ONE_VESSEL: DishCategory[] = ['soup', 'stew', 'curry', 'omelette']
/** Things that keep in a cupboard for months. */
const PANTRY_CATEGORIES = new Set(['grains', 'legumes', 'nuts-seeds', 'pantry', 'sweeteners', 'fats-vinegars'])
const PANTRY_FOODS = new Set(['tuna-canned'])

/**
 * The filters that can be read off the recipe.
 *
 * Deliberately not all fourteen. Lazy Meals, Leftovers, Fridge Clean-Out and
 * Special Occasion are judgements about a particular week in a particular
 * kitchen, and there is nothing in a component list that implies them —
 * inventing them would fill the library with confident nonsense that is tedious
 * to undo. They stay empty until somebody says otherwise.
 *
 * Budget Friendly is the same, for a different reason: the app holds no prices.
 * The nearest guess — "contains nothing expensive" — was true of 83% of the
 * library, because Mediterranean home cooking out of a Romanian supermarket is
 * cheap almost by definition. A filter that matches four recipes in five
 * narrows nothing, so it is left for you to apply where it means something.
 */
export function deriveQuickFilters(
  recipe: Recipe,
  category: DishCategory,
  ctx: NutritionContext,
): QuickFilter[] {
  const filters: QuickFilter[] = []
  const n = recipePerServing(recipe, ctx)
  const minutes = recipe.prepMinutes + recipe.cookMinutes

  // Zero means "never written down", not "instant", so it cannot count as quick.
  if (minutes > 0 && minutes <= 20) filters.push('quick')
  if (recipe.servings > 1) filters.push('meal-prep')
  if (COZY.includes(category)) filters.push('cozy')
  if (FREEZABLE.includes(category)) filters.push('freezer')
  if (n.protein >= 25) filters.push('high-protein')
  if (n.calories > 0 && n.calories <= 350 && !COZY.includes(category)) filters.push('light')

  const weights = weighFoods(recipe, ctx)
  const total = [...weights.values()].reduce((a, b) => a + b, 0)
  if (total > 0) {
    const veg = [...weights.entries()]
      .filter(([id]) => ctx.foods.get(id)?.category === 'vegetables')
      .reduce((a, [, g]) => a + g, 0)
    if (veg / total >= 0.5) filters.push('veggie-packed')

    const keeps = [...weights.entries()]
      .filter(([id]) => PANTRY_FOODS.has(id) || PANTRY_CATEGORIES.has(ctx.foods.get(id)?.category ?? ''))
      .reduce((a, [, g]) => a + g, 0)
    if (keeps / total >= 0.5) filters.push('pantry')
  }

  // A soup is one pot whether or not anybody wrote the method down. Where there
  // is a method, it can also say so — and can rule it out.
  const steps = recipe.steps.map((s) => s.instruction.toLowerCase()).join(' ')
  const twoVessels = /\b(another|second|separate) (pan|pot|tray)/.test(steps)
  if (!twoVessels && (ONE_VESSEL.includes(category) || /\b(pan|pot|skillet|tray)\b/.test(steps))) {
    filters.push('one-pan')
  }

  return filters
}

/** Both at once, for the generator and the editor's suggestion. */
export function classify(recipe: Recipe, ctx: NutritionContext): {
  category: DishCategory
  quickFilters: QuickFilter[]
} {
  const category = categorise(recipe, ctx)
  return { category, quickFilters: deriveQuickFilters(recipe, category, ctx) }
}

/** Kept for the editor: what a component list weighs, for showing why. */
export function leadingFood(recipe: Recipe, ctx: NutritionContext): string | undefined {
  const weights = weighFoods(recipe, ctx)
  return [...weights.entries()]
    .filter(([id]) => !ALWAYS_A_SIDE.has(id))
    .sort((a, b) => b[1] - a[1])[0]?.[0]
}
