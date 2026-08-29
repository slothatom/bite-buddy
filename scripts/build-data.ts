import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlans } from './lib/plans.js'
import { buildLibrary, rebuildFromArchive, renderFiles, type PlanInput } from './lib/library.js'
import { SOURCE_PLANS } from '../src/data/generated/sourcePlans.js'
import { FOODS } from '../src/data/foods.js'
import { DISHES } from '../src/data/dishes.js'
import { buildContext, componentsNutrients } from '../src/lib/nutrition.js'

/**
 * Builds the app's plan archive and meal recipes from the dietician's .docx files.
 *
 * Run:  npx tsx scripts/build-data.ts [source-dir]
 *
 * The output is committed, so the app has no build-time dependency on the source
 * documents; re-running only matters when a new plan is added or when a dish
 * definition changes.
 *
 * Without the source documents it rebuilds from the committed archive instead,
 * which stores every meal line verbatim. That covers the second case, a dish
 * definition or an import rule changing, on a machine that has the repository
 * but not the fourteen .docx originals.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../src/data/generated')
const SOURCE_DIR = process.argv[2] ?? resolve(HERE, '../data/source')

function fromDocuments(): PlanInput[] {
  return loadPlans(SOURCE_DIR).map((plan) => ({
    id: plan.id,
    file: plan.file,
    label: plan.label,
    language: plan.language,
    issuedOn: plan.issuedOn,
    subject: plan.subject,
    days: plan.days.map((day) => ({
      dayName: day.dayName,
      weekday: day.weekday,
      meals: day.meals.map((meal) => ({ slot: meal.slot, text: meal.text })),
    })),
  }))
}

const haveSource = existsSync(SOURCE_DIR)
if (!haveSource) {
  console.log(`no source documents at ${SOURCE_DIR}, rebuilding from the committed archive\n`)
}

const library = haveSource ? buildLibrary(fromDocuments()) : rebuildFromArchive(SOURCE_PLANS)
const { plans, recipes, aliases, unresolved, lineCount, mappedLines } = library

// ─── Report ───────────────────────────────────────────────────────────────────

const totalCtx = buildContext(FOODS, [...DISHES, ...recipes], aliases)
const dayTotals: number[] = []
for (const plan of plans) {
  for (const day of plan.days) {
    const kcal = day.meals.reduce(
      (sum, m) => sum + componentsNutrients(m.entries, totalCtx).calories, 0)
    if (kcal > 0) dayTotals.push(kcal)
  }
}
const avg = dayTotals.reduce((a, b) => a + b, 0) / Math.max(1, dayTotals.length)

console.log(`plans          ${plans.length}`)
console.log(`days           ${plans.reduce((a, p) => a + p.days.length, 0)}`)
console.log(`meal lines     ${lineCount} (${mappedLines} mapped)`)
console.log(`meal recipes   ${recipes.length} (${Object.keys(aliases).length} merged away)`)
console.log(`dishes         ${DISHES.length}`)
console.log(`foods          ${FOODS.length}`)
console.log(`avg day kcal   ${avg.toFixed(0)}  (min ${Math.min(...dayTotals).toFixed(0)}, max ${Math.max(...dayTotals).toFixed(0)})`)

if (unresolved.length) {
  const grouped = new Map<string, (typeof unresolved)[number] & { n: number }>()
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

const files = renderFiles(library)
for (const [name, content] of Object.entries(files)) {
  writeFileSync(resolve(OUT_DIR, name), content)
}

console.log(`\nwrote ${Object.keys(files).join(', ')} into ${OUT_DIR}`)
