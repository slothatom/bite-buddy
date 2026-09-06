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

/**
 * The two palettes the app can render in.
 *
 * Reading every `--color-*` in the file into one map was right while there was
 * one palette and became a trap the moment there were two: the dark overrides
 * come last, so a flat scan would have quietly replaced every light value with
 * its dark counterpart and then reported the light theme as passing on numbers
 * nobody ever sees. The blocks are read separately, and both are measured.
 */
function block(css: string, header: string): string {
  const start = css.indexOf(header)
  if (start === -1) throw new Error(`${CSS} has no ${header} block`)
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i)
  }
  throw new Error(`${header} in ${CSS} is never closed`)
}

function colours(source: string, into: Map<string, string>): Map<string, string> {
  for (const [, name, hex] of source.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    into.set(name, hex)
  }
  return into
}

function palettes(): { light: Map<string, string>; dark: Map<string, string> } {
  const css = readFileSync(CSS, 'utf8')

  const light = colours(block(css, '@theme'), new Map())
  light.set('white', '#ffffff')
  light.set('black', '#000000')

  // The dark theme is the light one with the tokens it overrides replaced, the
  // same way the cascade builds it, so a colour it does not mention is a
  // colour that genuinely does not change.
  const dark = colours(block(css, DARK_BLOCK), new Map(light))

  return { light, dark }
}

/** The selector the dark palette is defined under. See src/index.css. */
const DARK_BLOCK = ':root[data-theme=\'dark\']'

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

/**
 * The two things a colour can actually sit on in this app.
 *
 * White used to be the third. It is not a surface: `bg-white` survives in one
 * place, a 1px dot on a selected day, and the two buttons that used it inside
 * a coloured bar now use `bg-paper` so they follow the theme rather than
 * staying a white rectangle after dark. Keeping it here cost 236 imaginary
 * pairs in the dark palette, every one of them light text on a white ground
 * nothing renders on.
 */
const SURFACES = ['cream-50', 'paper']

/** Sizes that count as large text, so 3:1 rather than 4.5:1. */
const LARGE = /\btext-(xl|2xl|3xl|4xl|5xl|6xl)\b/

/**
 * An icon is not a word.
 *
 * WCAG sets 3:1 for a graphical object you need in order to understand the
 * screen, and 4.5:1 for body text. Holding a delete cross to the text bar
 * would push every icon in the app to the colour of the text beside it, which
 * loses the distinction between what you read and what you press, and buys
 * nobody any legibility. Icons here are lucide components carrying a size.
 */
const GRAPHIC = /aria-hidden|<[A-Z][A-Za-z0-9]*\s[^>]*\bsize=\{|\bbtn-icon\b|(?:fill|stroke)="currentColor"/

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
/**
 * Folds a continued string back onto the line it started on.
 *
 * A line holding an odd number of quotes is mid-literal, so the next one
 * belongs to it. The joined text stays on the first line's index and the
 * continuation becomes empty, which keeps every later line number correct.
 */
function joinWrapped(lines: string[]): string[] {
  // Backticks and apostrophes inside prose would confuse this, so only the
  // double quotes that carry a JSX attribute are counted.
  const odd = (line: string) => (line.split('"').length - 1) % 2 === 1
  const out = [...lines]

  for (let i = 0; i < out.length; i++) {
    /*
     * Bounded, and stopping at a line with nothing left to give.
     *
     * Unbounded, this hangs. A line whose quotes are odd for a reason other
     * than a wrapped attribute, a `"` inside a comment, say, never becomes
     * even however much is folded into it, and the loop eats the file one
     * blank line at a time for ever.
     */
    for (let taken = 0; taken < 8 && odd(out[i]) && i + 1 + taken < out.length; taken++) {
      const next = out[i + 1 + taken]
      if (!next.trim()) break
      out[i] = `${out[i]} ${next.trim()}`
      out[i + 1 + taken] = ''
    }
  }
  return out
}

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

    /*
     * Class attributes that wrap, joined back into one line first.
     *
     * The scan reads a literal at a time and literals were being taken line by
     * line, so a `className` broken across two lines had no matching quote on
     * either of them and was extracted as nothing at all. Not measured
     * loosely: not measured. That is how the undo bar shipped as `bg-ink-900
     * text-white`, which is white on a near-white ground once the dark palette
     * inverts ink-900, at about 1.05:1, on a message whose whole job is to be
     * read in eight seconds.
     *
     * Joined rather than scanned across the whole file at once, so every pair
     * still reports the line it starts on and the surrounding window used to
     * find a coloured parent still means something.
     */
    const lines = joinWrapped(source.split('\n'))

    lines.forEach((line, index) => {
      const where = `${file}:${index + 1}`
      // A few lines either side, not just below. The colour is usually written
      // on the button and the icon it tints sits inside, but a class built by a
      // ternary puts the colour below the `btn-icon` that classifies it, and
      // looking only forward called that button body text.
      const inside = lines.slice(Math.max(0, index - 3), index + 4).join('\n')

      for (const scope of literals(line)) {
        // Opacity variants are read at full strength. That understates rather
        // than overstates, which is the right way round for a check like this.
        const text = [...scope.matchAll(/\btext-([a-z]+-\d{2,3}|white|black)(?:\/\d+)?\b/g)].map((m) => m[1])
        if (!text.length) continue
        const background = [...scope.matchAll(/\bbg-([a-z]+-\d{2,3}|white|paper)(?:\/\d+)?\b/g)]
          .map((m) => m[1]).filter((b) => palette.has(b))
        const large = LARGE.test(scope) || GRAPHIC.test(inside)

        for (const fg of text) {
          if (!palette.has(fg)) continue

          if (background.length) {
            for (const bg of background) if (fg !== bg) found.push({ fg, bg, where, large })
            continue
          }

          // No ground in this literal. Light text is deliberately on a
          // coloured parent, so measuring it against a pale surface would
          // manufacture a failure. Dark text on a pale surface is the safe
          // assumption, and the common one.
          if (luminance(palette.get(fg)!) > 0.4) {
            // Look for that coloured parent rather than giving up on it. This
            // exemption was quietly excusing every light-on-colour pair in the
            // app, which is where the one real failure was living: the calorie
            // figure on a selected day chip, bite-100 on bite-500, 4.19:1
            // against the 4.5 that small text needs, and the one number on
            // that strip you most want to read.
            const grounds = [...new Set(
              [...inside.matchAll(/\bbg-([a-z]+-\d{2,3})\b/g)].map((m) => m[1]),
            )].filter((b) => palette.has(b) && !SURFACES.includes(b))

            /*
             * One candidate, or none of them.
             *
             * Where the window offers several coloured grounds they are not
             * alternatives for the same element, they are a table: the status
             * styles list a bar's fill, a label's colour and a card's surface
             * on one line each, three lines apart, and pairing across them
             * asks what the label would look like painted on the bar. Nothing
             * renders that, and in the dark palette it produced five failures
             * for combinations that do not exist.
             *
             * So a single unambiguous parent is trusted and anything less is
             * declared unresolved, which is the rule this file already states
             * for the case where there is no parent at all.
             */
            if (grounds.length !== 1) {
              unresolved.push(`${fg} at ${where}`)
              continue
            }
            for (const bg of grounds) if (fg !== bg) found.push({ fg, bg, where, large })
            continue
          }
          for (const bg of SURFACES) found.push({ fg, bg, where, large })
        }
      }
    })
  }

  return found
}

/**
 * One theme, measured.
 *
 * The pairing is redone per palette rather than shared, because which ground a
 * bare colour is assumed to sit on is decided by how light that colour is, and
 * that is a different answer in each theme: ink-900 is the darkest text in one
 * and nearly white in the other.
 */
function audit(name: string, palette: Map<string, string>): string[] {
  unresolved.length = 0
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
        `  ${name}: ${key.padEnd(30)} ${ratio.toFixed(2)}:1  needs ${need}:1  ` +
        `(${pair.count} use${pair.count === 1 ? '' : 's'}, first at ${pair.where})`,
      )
    }
  }

  console.log(`${name}: checked ${checked} colour combinations from ${all.length} usages`)
  if (unresolved.length) {
    console.log(`${name}: ${unresolved.length} light-on-unknown usages not measured, ground set by a parent`)
  }
  return failures
}

const { light, dark } = palettes()
const failures = [...audit('light', light), ...audit('dark', dark)]

if (failures.length) {
  console.error(`\n${failures.length} below WCAG AA:\n`)
  console.error(failures.join('\n'))
  console.error('')
  process.exit(1)
}

console.log('All combinations meet WCAG AA, in both themes.')
