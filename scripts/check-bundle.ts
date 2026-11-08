import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readArchiveFile } from './lib/archiveFile.js'
import { FIXTURE_PATH } from '../src/test/archive.js'
import { parseArchiveText, type PlanArchive } from '../src/data/archiveFormat.js'

/**
 * Keeps the dietician's plans out of the repository and out of the site.
 *
 * Run: npx tsx scripts/check-bundle.ts   (after `npm run build`)
 *
 * The plans are somebody's medical correspondence. They used to ship in the
 * public bundle, from a public repository, and the fix only holds while
 * nothing puts them back, so this fails the build when:
 *
 *   - anything under src/data/generated/ is tracked again, or an archive file
 *     is (data/archive.json is gitignored, but `git add -f` exists);
 *   - the built site contains anything shaped like plan data: the importer's
 *     recipe and plan ids, a plan's file name, the made-up test archive (which
 *     only the end-to-end build may carry);
 *   - on a machine that has the real archive, any of its meal lines or file
 *     names appears in the built site, word for word.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const problems: string[] = []

// ─── The repository ───────────────────────────────────────────────────────────

const tracked = execFileSync('git', ['-c', 'core.fileMode=false', 'ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
for (const path of tracked) {
  if (path.startsWith('src/data/generated/')) problems.push(`${path} is tracked: the plans must not be in the repository`)
  if (/^data\/.*archive\.json$/.test(path)) problems.push(`${path} is tracked: the plan archive must not be in the repository`)
}

// ─── The built site ───────────────────────────────────────────────────────────

if (!existsSync(DIST)) {
  console.error('No dist/ to check. Run `npm run build` first.')
  process.exit(1)
}

function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, into)
    else if (/\.(js|mjs|css|html|json|webmanifest|txt|map)$/.test(entry)) into.push(path)
  }
  return into
}

const files = walk(DIST).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }))

/** Shapes that only plan data has. The app's own code never spells these. */
const MARKERS: [RegExp, string][] = [
  [/\bmeal-(?:breakfast|lunch|dinner|snack\d?)-\d{3}\b/, 'an imported meal\'s recipe id'],
  [/["'`]plan-\d{2}["'`]/, 'a plan id'],
  [/[\w.-]+\.(?:docx|pdf)\b/i, 'a plan document\'s file name'],
  [/"sourceLine"\s*:\s*"/, 'a recipe carrying the dietician\'s line'],
  [/"sourcePlans"\s*:\s*\[\s*\{/, 'an archive written into the bundle'],
]

for (const { path, text } of files) {
  for (const [pattern, what] of MARKERS) {
    const found = text.match(pattern)
    if (found) problems.push(`${path} contains ${what}: "${found[0]}"`)
  }
}

/** Distinctive strings out of an archive: its file names, labels and longer meal lines. */
function fingerprints(archive: PlanArchive): string[] {
  const out = new Set<string>()
  for (const plan of archive.sourcePlans) {
    out.add(plan.file)
    for (const day of plan.days) {
      for (const meal of day.meals) if (meal.text.length >= 24) out.add(meal.text)
    }
  }
  for (const recipe of archive.mealRecipes) {
    if (recipe.sourceLine && recipe.sourceLine.length >= 24) out.add(recipe.sourceLine)
  }
  return [...out]
}

/**
 * The importer's vocabulary, which is public and ships on purpose: the dish
 * names and aliases it matches lines against, the food names, the dictionary.
 * A plan line that is nothing but one of those ("budinca de chia cu mango")
 * tells nobody anything, and finding it in the bundle is not a leak.
 */
const VOCABULARY = ['src/data/dishes.ts', 'src/data/foods.ts', 'data/translations.json']
  .map((path) => readFileSync(resolve(ROOT, path), 'utf8').toLowerCase())
  .join('\n')

function lookFor(archive: PlanArchive, which: string) {
  const prints = fingerprints(archive).filter((p) => !VOCABULARY.includes(p.toLowerCase()))
  for (const { path, text } of files) {
    // JSON.stringify'd strings escape quotes and non-ASCII differently from
    // source text, so both spellings are looked for.
    const hit = prints.find((p) => text.includes(p) || text.includes(JSON.stringify(p).slice(1, -1)))
    if (hit) problems.push(`${path} contains a line of the ${which}: "${hit.slice(0, 60)}"`)
  }
  return prints.length
}

const fixture = parseArchiveText(readFileSync(FIXTURE_PATH, 'utf8'))
const fixturePrints = lookFor(fixture, 'made-up test archive, which only the end-to-end build may carry')

let real: PlanArchive | null = null
try {
  real = readArchiveFile()
} catch (e) {
  problems.push(`data/archive.json could not be read: ${(e as Error).message}`)
}
const realPrints = real ? lookFor(real, 'real plan archive') : 0

console.log(`checked ${tracked.length} tracked files and ${files.length} built files`)
console.log(`  ${MARKERS.length} patterns, ${fixturePrints} lines of the test archive`
  + (real ? `, ${realPrints} lines of the real archive` : ', no real archive here to compare against'))

if (problems.length) {
  console.error(`\n${problems.length} problem(s), the plans are private:`)
  for (const p of problems.slice(0, 40)) console.error(`  x ${p}`)
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`)
  process.exit(1)
}

console.log('\nNo plan data in the repository or the built site.')
