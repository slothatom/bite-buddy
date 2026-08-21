import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlans, type RawFragment } from './lib/plans.js'
import { FOODS } from '../src/data/foods.js'
import { DISHES, DISH_ALIASES, DISH_BY_WEIGHT } from '../src/data/dishes.js'
import { buildFoodIndex, resolveFood } from '../src/lib/foodSearch.js'
import { normaliseTerm } from '../src/lib/units.js'
import { buildContext, componentsNutrients } from '../src/lib/nutrition.js'
import type { RecipeComponent, MealSlot, Recipe, RecipeTag, SourcePlan } from '../src/types/index.js'

/**
 * Builds the app's plan archive and meal recipes from the dietician's .docx files.
 *
 * Run:  npx tsx scripts/build-data.ts <source-dir>
 *
 * The output is committed, so the app has no build-time dependency on the source
 * documents; re-running only matters when a new plan is added or when a dish
 * definition changes.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../src/data/generated')

const foodIndex = buildFoodIndex(FOODS)
const dishById = new Map(DISHES.map((d) => [d.id, d]))
const ctx = buildContext(FOODS, DISHES)

/** Grams the dish weighs per serving, used to convert "350 g ciorba" into servings. */
const dishGramsPerServing = new Map<string, number>()
for (const dish of DISHES) {
  const grams = dish.components.reduce((sum, c) => sum + (c.kind === 'food' ? c.grams : 0), 0)
  dishGramsPerServing.set(dish.id, grams / Math.max(1, dish.servings))
}

// Longest alias first, so "budinca de chia cu mango" beats "budinca de chia".
const dishAliases = [...DISH_ALIASES]
  .map((a) => ({ ...a, key: normaliseTerm(a.alias) }))
  .filter((a) => a.key.length >= 4)
  .sort((a, b) => b.key.length - a.key.length)

function resolveDish(term: string): string | undefined {
  const n = normaliseTerm(term)
  if (!n) return undefined
  for (const a of dishAliases) {
    if (n === a.key || n.includes(a.key)) return a.recipeId
  }
  return undefined
}

/** A fragment with no stated weight still needs a sensible portion. */
function defaultGrams(foodId: string): number {
  const food = foodIndex.all.find((f) => f.id === foodId)
  if (!food) return 0
  if (food.units.length) return food.units[0].grams
  // Seasonings and aromatics are garnish quantities, not portions.
  if (food.category === 'herbs-spices') return 3
  if (food.category === 'fats-vinegars') return 5
  return 100
}

interface Unresolved { term: string; raw: string; slot: MealSlot; file: string }
const unresolved: Unresolved[] = []

function toComponents(f: RawFragment, slot: MealSlot, file: string): RecipeComponent[] {
  if (!f.normalised) return []

  const dishId = resolveDish(f.term)
  if (dishId) {
    const perServing = dishGramsPerServing.get(dishId) ?? 0
    // "350 g ciorba a la grec" is a portion of the soup, so it scales. But
    // "tigaie picanta: 100 g piept de pui" states an ingredient weight, and
    // scaling by it would shrink the meal to a third of its real size.
    const scalable = DISH_BY_WEIGHT.has(dishId) && f.grams && perServing > 0
    const servings = scalable ? Math.round((f.grams! / perServing) * 100) / 100 : 1
    const out: RecipeComponent[] = [{ kind: 'recipe', recipeId: dishId, servings: Math.max(0.1, servings) }]

    // The parenthetical sometimes names extras the dish definition lacks -
    // "cartofi cu ou (…, sos: 100 g iaurt, 50 g telemea)". Add only what the
    // dish does not already contain, so nothing is counted twice.
    const already = new Set(
      (dishById.get(dishId)?.components ?? [])
        .filter((c): c is Extract<RecipeComponent, { kind: 'food' }> => c.kind === 'food')
        .map((c) => c.foodId),
    )
    for (const inner of f.innerFragments) {
      if (!inner.normalised || !inner.grams) continue
      const food = resolveFood(inner.term, foodIndex)
      if (!food || already.has(food.id)) continue
      already.add(food.id)
      out.push({ kind: 'food', foodId: food.id, grams: inner.grams })
    }
    return out
  }

  const food = resolveFood(f.term, foodIndex)
  if (food) {
    return [{ kind: 'food', foodId: food.id, grams: f.grams ?? defaultGrams(food.id) }]
  }

  unresolved.push({ term: f.normalised, raw: f.raw, slot, file })
  return []
}

// ─── Naming ───────────────────────────────────────────────────────────────────

const SLOT_TAG: Record<MealSlot, RecipeTag> = {
  breakfast: 'breakfast', snack1: 'snack', lunch: 'lunch', snack2: 'snack', dinner: 'dinner',
}

function labelFor(c: RecipeComponent): string {
  const raw = c.kind === 'recipe'
    ? dishById.get(c.recipeId)?.name.en ?? 'Dish'
    : foodIndex.all.find((f) => f.id === c.foodId)?.names.en ?? 'Food'
  // "Red kidney beans, cooked" is right in the food library but reads badly
  // inside a meal name, as does a parenthetical gloss.
  return raw.replace(/,\s*(cooked|dry|raw)\b/i, '').replace(/\s*\([^)]*\)/, '').trim()
}

/**
 * Names a meal after what dominates it.
 *
 * Components are ranked by calorie contribution, with prepared dishes promoted
 * above raw ingredients, "Lentils with spinach & wholemeal bread" reads better
 * than "Wholemeal bread with lentils", even when the bread carries more calories.
 */
function nameMeal(components: RecipeComponent[]): string {
  // Anything already inside a dish in this meal must not also appear in the
  // name: "Apple & cinnamon porridge with apple" reads as a mistake, because
  // it is one.
  const insideADish = new Set<string>()
  for (const c of components) {
    if (c.kind !== 'recipe') continue
    for (const part of dishById.get(c.recipeId)?.components ?? []) {
      if (part.kind === 'food') insideADish.add(part.foodId)
    }
  }

  const ranked = components
    .filter((c) => {
      if (c.kind !== 'food') return true
      if (insideADish.has(c.foodId)) return false
      // Seasonings are never what a meal is called after, however
      // calorie-dense they are per 100 g.
      const category = foodIndex.all.find((f) => f.id === c.foodId)?.category
      return category !== 'herbs-spices'
    })
    .map((c) => ({
      c,
      label: labelFor(c),
      kcal: componentsNutrients([c], ctx).calories + (c.kind === 'recipe' ? 400 : 0),
    }))
    .filter((r) => r.kcal > 0)
    .sort((a, b) => b.kcal - a.kcal)

  if (!ranked.length) return 'Meal'

  const seen = new Set<string>()
  const parts: string[] = []
  for (const r of ranked) {
    if (seen.has(r.label)) continue
    seen.add(r.label)
    parts.push(r.label)
    if (parts.length === 3) break
  }

  const head = parts[0]
  const rest = parts.slice(1)
  if (!rest.length) return head
  // A dish whose own name contains "with" would otherwise read
  // "Lentils with spinach with halloumi".
  const join = /\bwith\b/i.test(head) ? ',' : ' with'
  if (rest.length === 1) return `${head}${join} ${lower(rest[0])}`
  return `${head}${join} ${lower(rest[0])} & ${lower(rest[1])}`
}

/** Place names and personal names stay capitalised mid-sentence. */
const PROPER = /^(Telemea|Greek|Caesar|Tabbouleh|Mediterranean|Swiss)\b/

function lower(s: string): string {
  if (PROPER.test(s)) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function emojiFor(components: RecipeComponent[], slot: MealSlot): string {
  for (const c of components) {
    if (c.kind === 'recipe') {
      const e = dishById.get(c.recipeId)?.emoji
      if (e) return e
    }
  }
  return { breakfast: '🌅', snack1: '🍎', lunch: '🍽️', snack2: '🍏', dinner: '🌙' }[slot]
}

// ─── Build ────────────────────────────────────────────────────────────────────

const plans = loadPlans(process.argv[2] ?? resolve(HERE, '../data/source'))

/** Distinct main meals, keyed by their source text, become named recipes. */
const mealRecipes = new Map<string, Recipe>()
const sourcePlans: SourcePlan[] = []

let lineCount = 0
let mappedLines = 0

for (const plan of plans) {
  const days = plan.days.map((day) => ({
    dayName: day.dayName,
    weekday: day.weekday,
    meals: day.meals.map((meal) => {
      lineCount++
      const entries = meal.fragments.flatMap((f) => toComponents(f, meal.slot, plan.file))
      if (entries.length) mappedLines++

      // Snacks stay as plain food lines; main meals become named recipes.
      const isMain = meal.slot === 'breakfast' || meal.slot === 'lunch' || meal.slot === 'dinner'
      if (!isMain || !entries.length) {
        return { slot: meal.slot, text: meal.text, entries }
      }

      const key = `${meal.slot}::${normaliseTerm(meal.text)}`
      let recipe = mealRecipes.get(key)
      if (!recipe) {
        const id = `meal-${meal.slot}-${String(mealRecipes.size + 1).padStart(3, '0')}`
        recipe = {
          id,
          name: { en: nameMeal(entries) },
          emoji: emojiFor(entries, meal.slot),
          servings: 1,
          prepMinutes: 0,
          cookMinutes: 0,
          components: entries,
          steps: [],
          tags: [SLOT_TAG[meal.slot]],
          sourceLine: meal.text,
          sourcePlanId: plan.id,
          createdAt: plan.issuedOn ? `${plan.issuedOn}T00:00:00.000Z` : '2022-01-01T00:00:00.000Z',
        }
        mealRecipes.set(key, recipe)
      }

      return { slot: meal.slot, text: meal.text, entries: [{ kind: 'recipe' as const, recipeId: recipe.id, servings: 1 }] }
    }),
  }))

  sourcePlans.push({
    id: plan.id, file: plan.file, label: plan.label, language: plan.language,
    issuedOn: plan.issuedOn, subject: plan.subject, days,
  })
}

// ─── Report ───────────────────────────────────────────────────────────────────

const recipes = [...mealRecipes.values()]
// Dish names are seeded first, so a generated meal named "Oat porridge" is
// numbered against the dish of that name rather than shadowing it.
const byName = new Map<string, number>()
for (const d of DISHES) byName.set(d.name.en, 1)
for (const r of recipes) byName.set(r.name.en, (byName.get(r.name.en) ?? 0) + 1)

// Several plan lines can reduce to the same components; number the repeats so
// every recipe has a unique name, leaving the first occurrence unadorned.
for (const [name, count] of byName) {
  if (count < 2) continue
  // Start at 1 when a dish already owns the bare name, so the first generated
  // meal becomes "(2)" rather than colliding.
  let i = DISHES.some((d) => d.name.en === name) ? 1 : 0
  for (const r of recipes) {
    if (r.name.en !== name) continue
    i++
    if (i > 1) r.name.en = `${name} (${i})`
  }
}

const totalCtx = buildContext(FOODS, [...DISHES, ...recipes])
const dayTotals: number[] = []
for (const plan of sourcePlans) {
  for (const day of plan.days) {
    const kcal = day.meals.reduce(
      (sum, m) => sum + componentsNutrients(m.entries, totalCtx).calories, 0)
    if (kcal > 0) dayTotals.push(kcal)
  }
}
const avg = dayTotals.reduce((a, b) => a + b, 0) / Math.max(1, dayTotals.length)

console.log(`plans          ${sourcePlans.length}`)
console.log(`days           ${sourcePlans.reduce((a, p) => a + p.days.length, 0)}`)
console.log(`meal lines     ${lineCount} (${mappedLines} mapped)`)
console.log(`meal recipes   ${recipes.length}`)
console.log(`dishes         ${DISHES.length}`)
console.log(`foods          ${FOODS.length}`)
console.log(`avg day kcal   ${avg.toFixed(0)}  (min ${Math.min(...dayTotals).toFixed(0)}, max ${Math.max(...dayTotals).toFixed(0)})`)

if (unresolved.length) {
  const grouped = new Map<string, Unresolved & { n: number }>()
  for (const u of unresolved) {
    const e = grouped.get(u.term) ?? { ...u, n: 0 }
    e.n++; grouped.set(u.term, e)
  }
  console.log(`\nunresolved terms (${grouped.size}):`)
  for (const [term, e] of [...grouped].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(e.n).padStart(3)}  ${term}   ← ${e.raw}`)
  }
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

const banner = `// Generated by scripts/build-data.ts, do not edit by hand.
// Source: the 14 dietician plan documents. Re-run the script to regenerate.
`

writeFileSync(
  resolve(OUT_DIR, 'sourcePlans.ts'),
  `${banner}import type { SourcePlan } from '../../types'\n\n` +
  `export const SOURCE_PLANS: SourcePlan[] = ${JSON.stringify(sourcePlans, null, 2)}\n`,
)

writeFileSync(
  resolve(OUT_DIR, 'mealRecipes.ts'),
  `${banner}import type { Recipe } from '../../types'\n\n` +
  `export const MEAL_RECIPES: Recipe[] = ${JSON.stringify(recipes, null, 2)}\n`,
)

console.log(`\nwrote ${OUT_DIR}/sourcePlans.ts and mealRecipes.ts`)
