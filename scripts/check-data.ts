import { FOODS } from '../src/data/foods.js'
import { DISHES } from '../src/data/dishes.js'
import { MEAL_RECIPES } from '../src/data/generated/mealRecipes.js'
import { SOURCE_PLANS } from '../src/data/generated/sourcePlans.js'
import { atwaterCalories, buildContext, calorieDrift, calorieGap, recipePerServing } from '../src/lib/nutrition.js'
import type { Recipe } from '../src/types/index.js'

/**
 * Data integrity checks.
 *
 * Run: npx tsx scripts/check-data.ts
 *
 * These guard the failure modes that would otherwise be invisible — a component
 * pointing at a food that no longer exists, a recipe that nests itself, or a
 * mis-keyed nutrition value that makes a food's calories disagree with its own
 * macros. All of those produce plausible-looking numbers rather than crashes.
 */

const recipes: Recipe[] = [...DISHES, ...MEAL_RECIPES]
const ctx = buildContext(FOODS, recipes)
const problems: string[] = []
const notes: string[] = []

// 1. Every reference resolves.
for (const recipe of recipes) {
  for (const c of recipe.components) {
    if (c.kind === 'food' && !ctx.foods.has(c.foodId)) {
      problems.push(`${recipe.id}: unknown food "${c.foodId}"`)
    }
    if (c.kind === 'recipe' && !ctx.recipes.has(c.recipeId)) {
      problems.push(`${recipe.id}: unknown recipe "${c.recipeId}"`)
    }
    if (c.kind === 'food' && !(c.grams > 0)) {
      problems.push(`${recipe.id}: food "${c.foodId}" has no weight`)
    }
  }
}

// 2. No cycles in nested recipes.
function findCycle(id: string, seen: string[]): string[] | null {
  if (seen.includes(id)) return [...seen, id]
  const recipe = ctx.recipes.get(id)
  if (!recipe) return null
  for (const c of recipe.components) {
    if (c.kind !== 'recipe') continue
    const cycle = findCycle(c.recipeId, [...seen, id])
    if (cycle) return cycle
  }
  return null
}
for (const recipe of recipes) {
  const cycle = findCycle(recipe.id, [])
  if (cycle) problems.push(`cycle: ${cycle.join(' → ')}`)
}

// 3. Stated calories agree with the macros they are made of.
//
// Foods whose energy is genuinely not all in the macros. Vanilla extract is
// mostly ethanol, which carries 7 kcal/g and is not a tracked macro.
const ENERGY_NOT_IN_MACROS = new Set(['vanilla-extract'])

for (const food of FOODS) {
  if (ENERGY_NOT_IN_MACROS.has(food.id)) continue
  const drift = calorieDrift(food.per100g)
  // Both tests must fail: a 20% gap on spinach is 5 kcal and means nothing,
  // while a 12% gap on olive oil is 100 kcal and means a typo.
  if (drift > 0.12 && calorieGap(food.per100g) > 15) {
    problems.push(
      `${food.id}: ${food.per100g.calories} kcal but macros imply ` +
      `${Math.round(atwaterCalories(food.per100g))} (${(drift * 100).toFixed(0)}% off)`,
    )
  }
}

// 4. Every plan line resolved to something.
let lines = 0
let empty = 0
for (const plan of SOURCE_PLANS) {
  for (const day of plan.days) {
    for (const meal of day.meals) {
      lines++
      if (!meal.entries.length) {
        empty++
        problems.push(`${plan.file} ${day.dayName} ${meal.slot}: unmapped — "${meal.text}"`)
      }
    }
  }
}

// 5. Nothing in the library produces an absurd per-serving figure.
for (const recipe of recipes) {
  const kcal = recipePerServing(recipe, ctx).calories
  if (kcal <= 0) problems.push(`${recipe.id} (${recipe.name.en}): 0 kcal per serving`)
  else if (kcal > 1800) notes.push(`${recipe.id} (${recipe.name.en}): ${Math.round(kcal)} kcal per serving looks high`)
}

// 6. Names are unique, so the library has no indistinguishable entries.
const names = new Map<string, number>()
for (const r of recipes) names.set(r.name.en, (names.get(r.name.en) ?? 0) + 1)
for (const [name, count] of names) {
  if (count > 1) problems.push(`duplicate recipe name: "${name}" ×${count}`)
}

// ─── Report ───────────────────────────────────────────────────────────────────

const componentCount = recipes.reduce((a, r) => a + r.components.length, 0)
console.log(`foods          ${FOODS.length}`)
console.log(`dishes         ${DISHES.length}`)
console.log(`meal recipes   ${MEAL_RECIPES.length}`)
console.log(`components     ${componentCount}`)
console.log(`plan lines     ${lines} (${lines - empty} mapped)`)

if (notes.length) {
  console.log(`\n${notes.length} note(s):`)
  for (const n of notes.slice(0, 10)) console.log(`  · ${n}`)
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`)
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`)
  process.exit(1)
}

console.log('\nAll checks passed.')
