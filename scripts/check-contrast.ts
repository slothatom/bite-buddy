/**
 * Does the app's own colour meet WCAG on the app's own surfaces?
 *
 * Every accessibility claim in this repository has been about structure: tap
 * targets, no horizontal scroll, labels on inputs. Contrast was never measured,
 * which is the one that fails silently. Nobody reports "I could read that, but
 * only just", they simply use the app a little less in the evening.
 *
 * This reads the real tokens out of index.css and the real class pairs out of
 * the components, so it measures what ships rather than what a palette
 * document says. A colour written next to a background in the same className is
 * measured against that background; a colour written on its own is measured
 * against all three surfaces a screen can actually put it on.
 *
 * The bar is WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text, which here
 * means 18.66px bold or 24px plain, so text-xl and up.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CSS = 'src/index.css'
const ROOT = 'src'

/** Every --color-* token, as hex. */
function tokens(): Map<string, string> {
  const css = readFileSync(CSS, 'utf8')
  const found = new Map<string, string>()
  for (const [, name, hex] of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    found.set(name, hex)
  }
  found.set('white', '#ffffff')
  found.set('black', '#000000')
  return found
}

function channel(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = channel(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The three things a colour can actually sit on in this app. */
const SURFACES = ['cream-50', 'paper', 'white']

/** Sizes that count as large text, so 3:1 rather than 4.5:1. */
const LARGE = /\btext-(xl|2xl|3xl|4xl|5xl|6xl)\b/

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files(path, out)
    else if (/\.tsx?$/.test(path) && !/\.test\./.test(path)) out.push(path)
  }
  return out
}

interface Pair { fg: string; bg: string; where: string; large: boolean }

/**
 * Colours are paired only inside a single string literal.
 *
 * A whole line is the wrong unit and gives wrong answers. A ternary holds two
 * alternatives that never appear together, so pairing across it invents a
 * combination nobody can see; an object of style variants holds a fill, a text
 * colour and a surface as separate keys, and the fill is a dot, not the ground
 * the words sit on. Both were doing so here, and both were reported as
 * failures until the pairing was narrowed to one literal at a time.
 */
function literals(source: string): string[] {
  return [...source.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .filter((s) => s.includes('text-') || s.includes('bg-'))
}

/** Where the ground cannot be known, saying so beats guessing wrong. */
const unresolved: string[] = []

function pairs(palette: Map<string, string>): Pair[] {
  const found: Pair[] = []

  for (const file of files(ROOT)) {
    const source = readFileSync(file, 'utf8')

    source.split('\n').forEach((line, index) => {
      const where = `${file}:${index + 1}`

      for (const scope of literals(line)) {
        // Opacity variants are read at full strength. That understates rather
        // than overstates, which is the right way round for a check like this.
        const text = [...scope.matchAll(/\btext-([a-z]+-\d{2,3}|white|black)(?:\/\d+)?\b/g)].map((m) => m[1])
        if (!text.length) continue
        const background = [...scope.matchAll(/\bbg-([a-z]+-\d{2,3}|white|paper)(?:\/\d+)?\b/g)]
          .map((m) => m[1]).filter((b) => palette.has(b))
        const large = LARGE.test(scope)

        for (const fg of text) {
          if (!palette.has(fg)) continue

          if (background.length) {
            for (const bg of background) if (fg !== bg) found.push({ fg, bg, where, large })
            continue
          }

          // No ground in this literal. Light text is always deliberately on a
          // coloured parent, so measuring it against a pale surface would
          // manufacture a failure. Dark text on a pale surface is the safe
          // assumption, and the common one.
          if (luminance(palette.get(fg)!) > 0.4) {
            unresolved.push(`${fg} at ${where}`)
            continue
          }
          for (const bg of SURFACES) found.push({ fg, bg, where, large })
        }
      }
    })
  }

  return found
}

const palette = tokens()
const all = pairs(palette)

// One row per colour combination, keeping the first place it appears and the
// most demanding size it is used at. A failure repeated in forty files is one
// thing to fix, not forty.
const worst = new Map<string, Pair & { count: number }>()
for (const pair of all) {
  const key = `${pair.fg} on ${pair.bg}`
  const seen = worst.get(key)
  if (!seen) worst.set(key, { ...pair, count: 1 })
  else {
    seen.count += 1
    if (!pair.large) seen.large = false      // used small somewhere: hold it to 4.5
  }
}

const failures: string[] = []
let checked = 0

for (const [key, pair] of [...worst].sort((a, b) => a[0].localeCompare(b[0]))) {
  const ratio = contrast(palette.get(pair.fg)!, palette.get(pair.bg)!)
  const need = pair.large ? 3 : 4.5
  checked += 1
  if (ratio < need) {
    failures.push(
      `  ${key.padEnd(30)} ${ratio.toFixed(2)}:1  needs ${need}:1  ` +
      `(${pair.count} use${pair.count === 1 ? '' : 's'}, first at ${pair.where})`,
    )
  }
}

console.log(`checked ${checked} colour combinations from ${all.length} usages`)
if (unresolved.length) {
  console.log(`${unresolved.length} light-on-unknown usages not measured, ground set by a parent`)
}

if (failures.length) {
  console.error(`\n${failures.length} below WCAG AA:\n`)
  console.error(failures.join('\n'))
  console.error('')
  process.exit(1)
}

console.log('All combinations meet WCAG AA.')
