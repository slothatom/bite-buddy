/**
 * Holds `public/` and `src/generated/icons.ts` to the same story.
 *
 * The artwork's filenames carry a hash of their contents now, which fixes one
 * problem and creates another: a name that changes is a name that can be
 * wrong. Edit the mascot and forget `npm run icons` and the module still names
 * last week's files, which is harmless. Run `npm run icons` and forget to
 * commit `public/` and the deployed page points at artwork that is not there,
 * which is a home screen with a blank square on it and no error anywhere.
 *
 * So this checks both directions: every name the module gives must exist, and
 * every piece of artwork in `public/` must be named by the module. The second
 * half is what stops old brands accumulating in the deploy.
 *
 * It also re-hashes each file, because a name is only a promise about contents
 * until somebody checks it. Hand-editing a PNG and keeping its name would slip
 * past a check that only looked for the file.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { APPLE_TOUCH_ICON, FAVICON, ICONS, SPLASHES } from '../src/generated/icons'

const PUBLIC = resolve(import.meta.dirname, '../public')

/** Everything `npm run icons` writes, and nothing else in the folder. */
const ARTWORK = /^(icon-|splash-|favicon)/

const named = new Set([FAVICON, APPLE_TOUCH_ICON, ...ICONS.map((i) => i.src), ...SPLASHES.map((s) => s.src)])

const problems: string[] = []

for (const name of named) {
  const path = resolve(PUBLIC, name)
  if (!existsSync(path)) {
    problems.push(`${name} is named in src/generated/icons.ts but is not in public/`)
    continue
  }
  // The hash sits between the stem and the extension: icon-192.<hash>.png.
  const stamped = name.split('.').at(-2)
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8)
  if (stamped !== actual) {
    problems.push(`${name} says its contents hash to ${stamped}, and they hash to ${actual}`)
  }
}

for (const name of readdirSync(PUBLIC)) {
  if (!ARTWORK.test(name)) continue
  if (!named.has(name)) {
    problems.push(`public/${name} is not named in src/generated/icons.ts, so nothing will ever ask for it`)
  }
}

if (problems.length) {
  console.error('Artwork and its manifest disagree:\n')
  for (const line of problems) console.error(`  ${line}`)
  console.error('\nRun `npm run icons` and commit public/ together with src/generated/icons.ts.')
  process.exit(1)
}

console.log(`Artwork checked: ${named.size} files, each named for its own contents.`)
