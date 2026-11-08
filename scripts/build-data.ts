import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlans } from './lib/plans.js'
import { buildLibrary, rebuildFromArchive, toArchive, type PlanInput } from './lib/library.js'
import { ARCHIVE_PATH, readArchiveFile, writeArchiveFile } from './lib/archiveFile.js'
import { FOODS } from '../src/data/foods.js'
import { DISHES } from '../src/data/dishes.js'
import { buildContext, componentsNutrients } from '../src/lib/nutrition.js'

/**
 * Builds the app's plan archive and meal recipes from the dietician's .docx files.
 *
 * Run:  npx tsx scripts/build-data.ts [source-dir]
 *
 * Writes `data/archive.json`, which is gitignored and never committed: the
 * plans are private and this repository is public. An admin uploads the file
 * in Settings, and the household reads it from Supabase behind the login.
 * Re-running only matters when a new plan is added or when a dish definition
 * or an import rule changes.
 *
 * Without the source documents it rebuilds from the existing archive instead,
 * which stores every meal line verbatim. That covers the second case on a
 * machine that has the archive but not the original documents.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
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
const existing = haveSource ? null : readArchiveFile()
if (!haveSource && !existing) {
  console.log(`No source documents at ${SOURCE_DIR} and no archive at ${ARCHIVE_PATH}.`)
  console.log('Put the dietician\'s documents in data/source (or pass a folder) and run this again.')
  process.exit(1)
}
if (!haveSource) {
  console.log(`no source documents at ${SOURCE_DIR}, rebuilding from ${ARCHIVE_PATH}\n`)
}

const library = haveSource ? buildLibrary(fromDocuments()) : rebuildFromArchive(existing!.sourcePlans)
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

writeArchiveFile(toArchive(library))

console.log(`\nwrote ${ARCHIVE_PATH}`)
console.log('It is private: never commit it. Upload it in Settings, Plan history, to share it with the household.')
