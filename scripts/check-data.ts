import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FOODS } from '../src/data/foods.js'
import { DISHES } from '../src/data/dishes.js'
import { MEAL_RECIPES } from '../src/data/generated/mealRecipes.js'
import { SOURCE_PLANS } from '../src/data/generated/sourcePlans.js'
import { atwaterCalories, buildContext, calorieDrift, calorieGap, recipePerServing } from '../src/lib/nutrition.js'
import { RECIPE_CLASSIFICATION } from '../src/data/generated/classification.js'
import { DISH_CATEGORIES, QUICK_FILTERS, HAND_APPLIED_FILTERS } from '../src/lib/dishCategories.js'
import { RECIPE_ALIASES } from '../src/data/generated/recipeAliases.js'
import { TIMES_PLANNED } from '../src/data/generated/reuse.js'
import { componentSignature, rebuildFromArchive, renderFiles } from './lib/library.js'
import type { Recipe } from '../src/types/index.js'

/**
 * Data integrity checks.
 *
 * Run: npx tsx scripts/check-data.ts
 *
 * These guard the failure modes that would otherwise be invisible, a component
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
        problems.push(`${plan.file} ${day.dayName} ${meal.slot}: unmapped, "${meal.text}"`)
      }
    }
  }
}

// 5. Nothing in the library produces an absurd per-serving figure.
//
// This used to warn above 1800 kcal, into `notes`, which never fails the run.
// A lunch at 1595 kcal sat beside its near-identical twin at 374 for months
// and neither the threshold nor the severity could say a word about it: the
// importer had bound a 150 g weight to olive oil instead of tofu, and an
// absolute ceiling has no way to notice that a dish is wrong for its company.
//
// So the test is now relative, and it fails the build.
const perServing = recipes
  .map((r) => ({ recipe: r, kcal: recipePerServing(r, ctx).calories }))
  .filter((r) => r.kcal > 0)
const sorted = [...perServing].map((r) => r.kcal).sort((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)] ?? 0
const ceiling = Math.max(median * 4, 900)

for (const recipe of recipes) {
  const kcal = recipePerServing(recipe, ctx).calories
  if (kcal <= 0) {
    problems.push(`${recipe.id} (${recipe.name.en}): 0 kcal per serving`)
    continue
  }
  if (kcal > ceiling) {
    problems.push(
      `${recipe.id} (${recipe.name.en}): ${Math.round(kcal)} kcal per serving, `
      + `against a library median of ${Math.round(median)}`,
    )
  }

  // The shape of the mistake, not just its size. A serving carrying more than
  // 50 g of oil or butter is a parse error every time: the dietician writes
  // teaspoons, and 150 g of olive oil is nobody's lunch. This is what would
  // have caught the tofu line on the day it was imported.
  for (const c of recipe.components) {
    if (c.kind !== 'food') continue
    const food = ctx.foods.get(c.foodId)
    if (food?.category !== 'fats-vinegars') continue
    if (c.grams / Math.max(1, recipe.servings) > 50) {
      problems.push(
        `${recipe.id} (${recipe.name.en}): ${Math.round(c.grams)} g of ${food.names.en} `
        + `in ${recipe.servings} serving(s), which is a misread line rather than a recipe`,
      )
    }
  }
}

// 6. Names are unique, so the library has no indistinguishable entries.
//
// A duplicate name used to be settled by appending a number, which told the
// reader nothing: 68 of the 204 imported recipes ended up as "Baked oats (2)".
// The importer now says what differs instead, so a duplicate reaching here is
// a rule that failed rather than a name waiting to be numbered.
const names = new Map<string, Recipe[]>()
for (const r of recipes) names.set(r.name.en, [...(names.get(r.name.en) ?? []), r])
for (const [name, group] of names) {
  if (group.length > 1) {
    problems.push(
      `duplicate recipe name: "${name}" ×${group.length} (${group.map((r) => r.id).join(', ')}), `
      + 'the importer could not find an ingredient to tell them apart',
    )
  }
  if (/ \(\d+\)$/.test(name)) {
    problems.push(`${name}: a number in brackets says nothing about the recipe`)
  }
}

// 7. No two recipes are the same recipe.
//
// The same meal is written a dozen different ways across fourteen documents,
// down to a typo in "sos de usturoi". Two entries with identical ingredients in
// identical amounts are one recipe, and the importer merges them; one arriving
// here means the merge missed it and the library is browsing worse than it needs to.
const bySignature = new Map<string, Recipe[]>()
for (const r of recipes) {
  const key = componentSignature(r.components)
  bySignature.set(key, [...(bySignature.get(key) ?? []), r])
}
for (const group of bySignature.values()) {
  if (group.length > 1) {
    problems.push(`identical ingredients: ${group.map((r) => `${r.id} (${r.name.en})`).join(' = ')}`)
  }
}

// 8. Every merged-away recipe still resolves, and none of them shadows a live one.
for (const [from, to] of Object.entries(RECIPE_ALIASES)) {
  if (!ctx.recipes.has(to)) problems.push(`alias ${from} points at missing recipe ${to}`)
  if (recipes.some((r) => r.id === from)) problems.push(`alias ${from} shadows a recipe that still exists`)
}

// 9. Every recipe says how long it takes, and how often it was cooked.
//
// Both used to be missing for the 157 imported meals, and the two discovery
// lenses that read them, "Quick tonight" and "Worth a batch", matched nothing
// at all. An empty filter is worse than an absent one: it reads as an empty
// library rather than as a question the data cannot answer.
for (const recipe of recipes) {
  if (!(recipe.prepMinutes > 0)) {
    problems.push(`${recipe.id} (${recipe.name.en}): no preparation time`)
  }
  if (recipe.prepMinutes + recipe.cookMinutes > 180) {
    problems.push(`${recipe.id} (${recipe.name.en}): ${recipe.prepMinutes + recipe.cookMinutes} minutes, which is a day rather than a meal`)
  }
}

const batchable = recipes.filter((r) =>
  r.components.length > 0
  && (r.servings >= 4 || (r.servings >= 2 && (TIMES_PLANNED[r.id] ?? 0) >= 2)))
if (batchable.length < 5) {
  problems.push(`only ${batchable.length} recipes are worth a batch, so that lens shows next to nothing`)
}

for (const id of Object.keys(TIMES_PLANNED)) {
  if (!ctx.recipes.has(id)) problems.push(`${id}: counted in the plans but no longer in the library`)
}

// 10. The generated data is what the importer would produce today.
//
// The archive keeps every meal line verbatim, so the whole library can be
// rebuilt from it without the .docx originals. That makes this a drift check:
// change a dish definition or an import rule and forget to re-run the build,
// and the committed data no longer follows from the rules that produced it.
// It is also the only way to catch a whole class of import bug, since a meal
// that quietly counts its dish's olive oil twice looks perfectly plausible
// sitting in the file.
const GENERATED = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/generated')
const rebuilt = renderFiles(rebuildFromArchive(SOURCE_PLANS))
for (const [name, content] of Object.entries(rebuilt)) {
  const onDisk = readFileSync(resolve(GENERATED, name), 'utf8')
  if (onDisk !== content) {
    problems.push(`src/data/generated/${name} is out of date, re-run: npm run data:build`)
  }
}

// 11. Every recipe knows what kind of food it is, and the file saying so is not
//     stale, a category the classifier no longer produces would silently filter
//     to nothing on the Recipes screen.
for (const recipe of recipes) {
  const classified = RECIPE_CLASSIFICATION[recipe.id]
  if (!classified) {
    problems.push(`${recipe.id} (${recipe.name.en}): no category, re-run scripts/classify-recipes.ts`)
    continue
  }
  if (!DISH_CATEGORIES.includes(classified.category)) {
    problems.push(`${recipe.id}: unknown category "${classified.category}"`)
  }
  for (const f of classified.quickFilters) {
    if (!QUICK_FILTERS.includes(f)) problems.push(`${recipe.id}: unknown quick filter "${f}"`)
    if (HAND_APPLIED_FILTERS.includes(f)) {
      problems.push(`${recipe.id}: "${f}" cannot be derived and must not be generated`)
    }
  }
}

// And nothing is classified that is no longer there. A recipe the importer
// merged away leaves its category behind, which is harmless until the day two
// of them disagree about what the surviving recipe is.
for (const id of Object.keys(RECIPE_CLASSIFICATION)) {
  if (!ctx.recipes.has(id)) {
    problems.push(`${id}: classified but no longer in the library, re-run scripts/classify-recipes.ts`)
  }
}

const categoriesUsed = new Set(Object.values(RECIPE_CLASSIFICATION).map((c) => c.category))

// ─── Report ───────────────────────────────────────────────────────────────────

const componentCount = recipes.reduce((a, r) => a + r.components.length, 0)
console.log(`foods          ${FOODS.length}`)
console.log(`dishes         ${DISHES.length}`)
console.log(`meal recipes   ${MEAL_RECIPES.length}`)
console.log(`components     ${componentCount}`)
console.log(`plan lines     ${lines} (${lines - empty} mapped)`)
console.log(`categories     ${categoriesUsed.size} of ${DISH_CATEGORIES.length} in use`)
console.log(`under 20 min   ${recipes.filter((r) => r.prepMinutes + r.cookMinutes <= 20).length}`)
console.log(`worth a batch  ${batchable.length}`)

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
