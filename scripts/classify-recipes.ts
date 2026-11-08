import { DISHES } from '../src/data/dishes.js'
import { CATEGORY_LABELS } from '../src/lib/dishCategories.js'
import { classifyAll } from './lib/library.js'
import { ARCHIVE_PATH, noArchiveMessage, readArchiveFile, writeArchiveFile } from './lib/archiveFile.js'

/**
 * Assigns every recipe a dish category and its derivable quick filters.
 *
 * Run: npx tsx scripts/classify-recipes.ts
 *
 * The result is written into the plan archive rather than computed at startup,
 * for two reasons: it is data about a recipe and belongs next to the recipe,
 * and it has to be editable, the moment you disagree with one of these, your
 * version has to win. Re-running overwrites it, so edit the rules in
 * lib/classify.ts rather than the output.
 *
 * The archive is private and gitignored (see docs/DEPLOY.md), so this reads
 * and rewrites `data/archive.json` and does nothing without it. `npm run
 * data:build` classifies as it builds; this is for when only the rules changed.
 */

const archive = readArchiveFile()
if (!archive) {
  console.log(noArchiveMessage('classifying'))
  process.exit(0)
}

const classification = classifyAll(archive.mealRecipes)
writeArchiveFile({ ...archive, classification })
console.log(`wrote ${ARCHIVE_PATH}\n`)

const rows = [...DISHES, ...archive.mealRecipes].map((r) => [r.id, classification[r.id]] as const)

// A summary, so a change in the rules is visible rather than buried in a diff.
const byCategory = new Map<string, number>()
const byFilter = new Map<string, number>()
for (const [, c] of rows) {
  byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1)
  for (const f of c.quickFilters) byFilter.set(f, (byFilter.get(f) ?? 0) + 1)
}

console.log(`${rows.length} recipes classified into ${byCategory.size} of ${Object.keys(CATEGORY_LABELS).length} categories\n`)
for (const [c, n] of [...byCategory].sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(4), c)
}
console.log('\nquick filters')
for (const [f, n] of [...byFilter].sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(4), f)
}
