import type { FoodState } from '../types'

/**
 * Turning the dietician's shorthand into grams.
 *
 * The plans are written in Romanian and Hungarian kitchen vocabulary rather than
 * in a machine-readable format: "o lingurita de ulei de masline", "jumatate de
 * farfurie de legume", "50 g bulgur nefiert". Everything in this module exists to
 * resolve that shorthand to a gram weight plus the state the food was weighed in.
 */

// ─── Spoon and household measures ─────────────────────────────────────────────

/**
 * Spoon measures, in grams. These are weights for the thing usually being
 * spooned in these plans (oil, yogurt, flour), not volumes: the dietician uses
 * them as portions of fat and dairy, and a gram figure is what we need.
 */
const SPOON_GRAMS: Record<string, number> = {
  // Romanian — lingurita = teaspoon, lingura = tablespoon
  'lingurita': 5,
  'lingurite': 5,
  'lingura': 15,
  'linguri': 15,
  'lg': 15,
  'lgt': 5,
  // Hungarian — teáskanál = teaspoon, evőkanál = tablespoon
  'tk': 5,
  'tk.': 5,
  'teaskanal': 5,
  'ek': 15,
  'ek.': 15,
  'evokanal': 15,
}

/**
 * Vague portions the dietician uses freely. Each resolves to a gram estimate.
 * These are deliberately generous on vegetables — the guide's whole point is
 * that vegetables are the base of the plate and are not tightly weighed.
 */
export const VAGUE_PORTIONS: { match: RegExp; grams: number; term: string }[] = [
  // "jumatate de farfurie de legume" / "fel tanyer zoldseg" — half a plate of veg
  { match: /(jum[aă]tate|1\/2|½)\s+(de\s+)?farfurie\s+(de\s+)?legume/i, grams: 150, term: 'mixed vegetables' },
  { match: /f[eé]l\s+t[aá]ny[eé]r\s+z[oö]lds[eé]g/i,                    grams: 150, term: 'mixed vegetables' },
  { match: /salat[aă]\s+de\s+crudit[aă][tțt]i/i,                        grams: 200, term: 'raw vegetable salad' },
  { match: /vegyes\s+sal[aá]ta/i,                                       grams: 200, term: 'raw vegetable salad' },
  { match: /^legume$/i,                                                 grams: 150, term: 'mixed vegetables' },
  { match: /^z[oö]lds[eé]g(ek)?$/i,                                     grams: 150, term: 'mixed vegetables' },
  { match: /mur[aă]turi|savany[uú]s[aá]g|savany[uú]\s+uborka/i,         grams: 100, term: 'pickles' },
]

/** Whole-item weights, for lines written as "1 mar" rather than "150 g mere". */
const ITEM_GRAMS: Record<string, number> = {
  mar: 150, mere: 150, alma: 150,
  para: 170, pere: 170, korte: 170,
  portocala: 180, portocale: 180, narancs: 180,
  grapefruit: 250,
  banana: 120,
  kiwi: 75,
  mango: 200,
  ou: 55, oua: 55, tojas: 55,
  felie: 40,
  clementina: 75, clementine: 75, mandarina: 75,
}

// ─── State markers ────────────────────────────────────────────────────────────

/**
 * Markers meaning "weighed before cooking". Getting this wrong is the single
 * biggest error source in the whole import: 50 g of dry bulgur is ~180 kcal,
 * 50 g of cooked bulgur is ~60 kcal.
 */
const RAW_MARKERS = /\b(nefiert[aă]?|nefiart[aă]|crud[ăai]?|cruzi|c[aâ]nt[aă]rit[ăei]?\s+crud[aăi]?|nyersen|nyers)\b/i
const COOKED_MARKERS = /\b(fiert[ăai]?|fiart[aă]|f[őo]tt|copt[ăai]?|s[uü]lt)\b/i

/** Foods that are always weighed dry in these plans unless said otherwise. */
const DRY_BY_DEFAULT = /\b(fulgi de ovaz|ovaz|zabpehely|bulgur|quinoa|orez|rizs|linte|lencse|paste|laska|malai|faina|cuscus|couscous|hrisca|arpacas)\b/i

export type ParsedState = FoodState

export function detectState(text: string): ParsedState | undefined {
  if (RAW_MARKERS.test(text)) return DRY_BY_DEFAULT.test(text) ? 'dry' : 'raw'
  if (COOKED_MARKERS.test(text)) return 'cooked'
  if (DRY_BY_DEFAULT.test(text)) return 'dry'
  return undefined
}

// ─── Number parsing ───────────────────────────────────────────────────────────

/** Handles "1,5", "1.5", "½", "1/2", "2-3" (takes the midpoint). */
export function parseNumber(raw: string): number | undefined {
  const s = raw.trim().replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75')
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/)
  if (range) {
    return (num(range[1]) + num(range[2])) / 2
  }
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = num(s)
  return Number.isFinite(n) ? n : undefined
}

function num(s: string): number {
  return Number(s.replace(',', '.'))
}

// ─── Fragment parsing ─────────────────────────────────────────────────────────

export interface ParsedQuantity {
  /** Weight in grams. `undefined` when the line names a food with no quantity. */
  grams?: number
  /** The food term, stripped of quantity and state words. */
  term: string
  state?: ParsedState
  /** True when the gram figure is an estimate rather than a stated weight. */
  estimated: boolean
  /** The fragment exactly as it appeared. */
  raw: string
}

const ARTICLE = /^(o|un|una|el|la|de|un|egy|az|a)\s+/i

/**
 * Parses one comma- or plus-separated fragment of a meal line.
 *
 *   "100 g piept de pui crud"  → { grams: 100, term: 'piept de pui', state: 'raw' }
 *   "o lingurita de ulei"      → { grams: 5,   term: 'ulei', estimated: true }
 *   "jumatate de farfurie de legume" → { grams: 150, term: 'mixed vegetables', estimated: true }
 */
export function parseFragment(fragment: string): ParsedQuantity {
  const raw = fragment.trim()
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return { term: '', estimated: true, raw }

  const state = detectState(text)

  // 1. Vague portions win outright — they name their own food.
  for (const v of VAGUE_PORTIONS) {
    if (v.match.test(text)) {
      return { grams: v.grams, term: v.term, state, estimated: true, raw }
    }
  }

  // 2. Explicit weight or volume: "135 g ton", "330 ml kefir", "150 ml lapte".
  const weight = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grame|ml|dl)\b/i)
  if (weight) {
    const value = parseNumber(weight[1]) ?? 0
    const grams = /^dl$/i.test(weight[2]) ? value * 100 : value
    return { grams, term: cleanTerm(text.replace(weight[0], '')), state, estimated: false, raw }
  }

  // 3. Spoon measures: "o lingurita de ulei de masline", "2 lg de iaurt", "1 tk. olivaolaj".
  const spoon = text.match(
    /(\d+(?:[.,]\d+)?|o|un|una|egy)?\s*\b(lingurit[ae]|lingur[ai]|lg|lgt|tk\.?|ek\.?|teaskanal|evokanal)\b/i
  )
  if (spoon) {
    const count = spoon[1] ? (parseNumber(spoon[1]) ?? 1) : 1
    const per = SPOON_GRAMS[spoon[2].toLowerCase().replace(/\.$/, '')] ?? SPOON_GRAMS[spoon[2].toLowerCase()] ?? 5
    return {
      grams: Math.round((Number.isFinite(count) ? count : 1) * per),
      term: cleanTerm(text.replace(spoon[0], '')),
      state,
      estimated: true,
      raw,
    }
  }

  // 4. Countable items: "1 mar", "2 oua", "1,5 felie de brownie".
  const item = text.match(/^(\d+(?:[.,]\d+)?|o|un|una|egy|jum[aă]tate|f[eé]l|½)\s+(?:de\s+)?([a-zăâîșțáéíóöőúüű\- ]{2,30})/i)
  if (item) {
    const countWord = item[1].toLowerCase()
    const count = /^(o|un|una|egy)$/.test(countWord) ? 1
      : /^(jum[aă]tate|f[eé]l|½)$/.test(countWord) ? 0.5
      : (parseNumber(item[1]) ?? 1)
    const head = cleanTerm(item[2]).split(' ')[0]
    const per = ITEM_GRAMS[stripDiacritics(head)]
    if (per) {
      return { grams: Math.round(count * per), term: cleanTerm(item[2]), state, estimated: true, raw }
    }
  }

  // 5. No quantity at all — a bare food name, or a dish referenced by name.
  return { term: cleanTerm(text), state, estimated: true, raw }
}

/**
 * Splits a full meal line into fragments. The dietician separates components
 * with commas and plus signs, but parenthetical groups are recipe internals
 * ("pasta de ton ( pt 2 portii: 135 g ton, 50 g branza cremoasa )") and must not
 * be split on their inner commas.
 */
export function splitComponents(line: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === ',' || ch === '+')) {
      // A comma between two digits is a decimal point, not a separator —
      // "iaurt 1,5-3,5%" is one component, not three.
      const isDecimal = ch === ',' && /\d/.test(line[i - 1] ?? '') && /\d/.test(line[i + 1] ?? '')
      if (!isDecimal) {
        out.push(current)
        current = ''
        continue
      }
    }
    current += ch
  }
  out.push(current)
  return out.map((s) => s.trim()).filter(Boolean)
}

/** Pulls the parenthetical out of a fragment: "pasta de ton (135 g ton)" → both halves. */
export function splitParenthetical(fragment: string): { head: string; inner?: string } {
  const m = fragment.match(/^([^(]*)\(([^)]*)\)(.*)$/)
  if (!m) return { head: fragment.trim() }
  return { head: (m[1] + m[3]).trim(), inner: m[2].trim() }
}

function cleanTerm(text: string): string {
  let t = text
    .replace(RAW_MARKERS, ' ')
    .replace(COOKED_MARKERS, ' ')
    .replace(/[():]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  while (ARTICLE.test(t)) t = t.replace(ARTICLE, '')
  return t.replace(/^[-–\s]+|[-–\s]+$/g, '').trim()
}

export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .toLowerCase()
}

/** Normalised key for matching a term against food names and aliases. */
export function normaliseTerm(s: string): string {
  return stripDiacritics(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
