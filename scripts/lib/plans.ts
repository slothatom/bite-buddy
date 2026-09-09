import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { readDocxParagraphs } from './docx.js'
import { splitComponents, parseFragment, normaliseTerm } from '../../src/lib/units.js'
import type { MealSlot, PlanLanguage } from '../../src/types/index.js'

/**
 * Reads the dietician's .docx plans into structured data.
 *
 * The documents follow a stable shape: a day name on its own line, then five
 * `SLOT: text` lines. Only the slot abbreviations differ between the Hungarian
 * (2021) and Romanian (2022) plans.
 */

const SLOT_KEYS: Record<string, MealSlot> = {
  // Romanian
  md: 'breakfast', g1: 'snack', pranz: 'lunch', p: 'lunch', g2: 'snack', cina: 'dinner', c: 'dinner',
  // Hungarian
  reggeli: 'breakfast', uzsi1: 'snack', ebed: 'lunch', uzsi2: 'snack', vacsi: 'dinner',
}

const DAY_NAMES: Record<string, number> = {
  // Romanian, 0 = Sunday
  duminica: 0, luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6,
  // Hungarian
  vasarnap: 0, hetfo: 1, kedd: 2, szerda: 3, csutortok: 4, pentek: 5, szombat: 6,
}

export interface RawFragment {
  raw: string
  term: string
  normalised: string
  grams?: number
  state?: string
  estimated: boolean
  /** Text inside parentheses, recipe internals, e.g. "pt 2 portii: 135 g ton…". */
  inner?: string
  /**
   * The parenthetical parsed as components. The dietician often spells out
   * extras there that a dish definition does not cover, "cartofi cu ou (…,
   * sos: 100 g iaurt, 50 g telemea)" adds a sauce worth 200 kcal.
   */
  innerFragments: Omit<RawFragment, 'inner' | 'innerFragments'>[]
  /**
   * The part of the line before a colon, which names the meal rather than
   * listing an ingredient of it.
   *
   * "quinoas gombas salata : 150 g gomba + 140 g fott quinoa" is a title and
   * then its contents. Splitting on the colon is what lets the 150 g reach the
   * mushrooms, but it also hands "quinoas gombas salata" to the food resolver,
   * which found quinoa in the name and invented a default 100 g of it on top
   * of the 140 g she actually wrote.
   *
   * A heading that names a dish the app knows is still worth keeping, since
   * that is where the rest of the recipe comes from. One that resolves to a
   * bare food with no weight of its own is just the title, and is dropped.
   */
  heading?: boolean
}

export interface RawMeal {
  slot: MealSlot
  text: string
  fragments: RawFragment[]
}

export interface RawDay {
  dayName: string
  weekday: number
  meals: RawMeal[]
}

export interface RawPlan {
  id: string
  file: string
  label: string
  language: PlanLanguage
  issuedOn?: string
  subject: 'self' | 'other'
  days: RawDay[]
}

function describeFile(file: string): Omit<RawPlan, 'days' | 'id' | 'file'> {
  const name = basename(file, '.docx')
  // Uploaded files carry an 8-hex prefix; strip it before matching.
  const stem = name.replace(/^[0-9a-f]{8}-/, '')

  const isHungarian = /_trend$/i.test(stem) || /AranyM_k/i.test(stem)
  const other = /Dospinescu|Olivia/i.test(stem)

  const date = stem.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  const issuedOn = date ? `${date[3]}-${date[2]}-${date[1]}` : undefined

  const label = issuedOn
    ? `Week of ${new Date(issuedOn + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })}`
    : other ? 'Olivia, week 1' : 'Undated week'

  return {
    label: other ? `${label} (Olivia)` : label,
    language: isHungarian ? 'hu' : 'ro',
    issuedOn,
    subject: other ? 'other' : 'self',
  }
}

function parseDocument(path: string, id: string): RawPlan {
  const meta = describeFile(path)
  const days: RawDay[] = []
  let current: RawDay | undefined

  for (const line of readDocxParagraphs(path)) {
    // Most documents write "Miercuri    :", but one writes a bare "MIERCURI".
    const bareDay = DAY_NAMES[normaliseTerm(line).replace(/\s+/g, '')]
    if (bareDay !== undefined) {
      current = { dayName: titleCase(line.trim()), weekday: bareDay, meals: [] }
      days.push(current)
      continue
    }

    const match = line.match(/^([A-Za-zăâîșțáéíóöőúüű_]+[0-9]?)\s*:\s*(.*)$/i)
    if (!match) continue

    const key = normaliseTerm(match[1]).replace(/\s+/g, '')
    const value = match[2].trim()

    // A "Miercuri :" line with nothing after the colon opens a new day.
    if (!value) {
      const weekday = DAY_NAMES[key]
      if (weekday !== undefined) {
        current = { dayName: match[1].trim(), weekday, meals: [] }
        days.push(current)
      }
      continue
    }

    const slot = SLOT_KEYS[key]
    if (!slot || !current) continue
    if (value === '-') continue

    current.meals.push({
      slot,
      text: value.replace(/\s+/g, ' ').trim(),
      fragments: fragmentsOf(value),
    })
  }

  return { id, file: basename(path), ...meta, days }
}

function bare(text: string): Omit<RawFragment, 'inner' | 'innerFragments'> {
  const parsed = parseFragment(text)
  return {
    raw: text.trim(),
    term: parsed.term,
    normalised: normaliseTerm(parsed.term),
    grams: parsed.grams,
    state: parsed.state,
    estimated: parsed.estimated,
  }
}

/**
 * A meal line, split into the things it names.
 *
 * Exported because the committed archive stores each line verbatim, so the
 * whole library can be rebuilt from `sourcePlans.ts` alone when the .docx
 * originals are not to hand. Both paths must parse a line identically, so
 * there is one function and `parseDocument` uses it too.
 */
export function fragmentsOf(text: string): RawFragment[] {
  const parts = splitComponents(text)
  // Only when a colon actually did the splitting: it is the one separator that
  // puts a name on the left rather than another ingredient.
  const titled = /^[^(,+]*:/.test(text)
  return parts.map((part, i) => ({ ...toFragment(part), heading: titled && i === 0 }))
}

function toFragment(fragment: string): RawFragment {
  const paren = fragment.match(/^([^(]*)\(([^)]*)\)(.*)$/)
  const head = paren ? (paren[1] + paren[3]).trim() : fragment.trim()
  const inner = paren ? paren[2].trim() : undefined

  return {
    ...bare(head),
    raw: fragment.trim(),
    inner,
    innerFragments: inner
      // "pt 2 portii:" and "sos:" are labels, not ingredients.
      ? splitComponents(inner.replace(/\b(pt\s*\d+\s*portii|sos|2\s*adag)\s*:/gi, ' ')).map(bare)
      : [],
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function loadPlans(sourceDir: string): RawPlan[] {
  const files = readdirSync(sourceDir)
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .sort()

  return files.map((f, i) => parseDocument(join(sourceDir, f), `plan-${String(i + 1).padStart(2, '0')}`))
}
