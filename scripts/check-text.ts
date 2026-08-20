import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Keeps em dashes out of the repository.
 *
 * Run: npx tsx scripts/check-text.ts
 *
 * They were everywhere: in the interface copy, in the comments, in the README.
 * They are gone, and the only way they stay gone is if something notices when
 * one comes back. A style rule nobody checks is a style rule that lasts about a
 * fortnight.
 *
 * A comma, a colon or a full stop says the same thing and reads the same way on
 * a phone, where a long dash is easy to mistake for a hyphen anyway.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const SEARCH = ['src', 'e2e', 'scripts', 'docs', 'supabase', '.github']
/**
 * The root files, listed rather than globbed.
 *
 * The three config files were missed for a fortnight because the walk only
 * covered directories, and a rule that quietly exempts the files you edit least
 * often is the one that lets the character back in.
 */
const FILES = [
  'README.md', 'index.html', 'package.json',
  'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'eslint.config.js',
]
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.md', '.css', '.html', '.sql', '.yml', '.yaml']

/** The character itself, built from its code point so this file stays clean. */
const EM_DASH = String.fromCharCode(0x2014)

function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.git')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, into)
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) into.push(path)
  }
  return into
}

const targets = [
  ...SEARCH.flatMap((d) => {
    try { return walk(resolve(ROOT, d)) } catch { return [] }
  }),
  ...FILES.map((f) => resolve(ROOT, f)),
]

const problems: string[] = []

for (const path of targets) {
  let text: string
  try { text = readFileSync(path, 'utf8') } catch { continue }
  if (!text.includes(EM_DASH)) continue

  text.split('\n').forEach((line, i) => {
    if (line.includes(EM_DASH)) {
      problems.push(`${path.replace(ROOT + '/', '')}:${i + 1}: ${line.trim().slice(0, 90)}`)
    }
  })
}

console.log(`checked ${targets.length} files for em dashes`)

if (problems.length) {
  console.error(`\n${problems.length} em dash(es), use a comma, a colon or a full stop:`)
  for (const p of problems.slice(0, 40)) console.error(`  x ${p}`)
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`)
  process.exit(1)
}

console.log('No em dashes.')
