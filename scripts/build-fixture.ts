import { resolve } from 'node:path'
import { buildLibrary, toArchive, type PlanInput } from './lib/library.js'
import { writeArchiveFile } from './lib/archiveFile.js'
import { archiveCounts } from '../src/data/archiveFormat.js'
import type { MealSlot } from '../src/types/index.js'

/**
 * A made-up plan archive, for the tests.
 *
 * Run: npx tsx scripts/build-fixture.ts
 *
 * The real archive is private and never committed, so CI has none. The unit
 * tests and the end-to-end build run against this instead: four invented
 * weeks written in the shape the dietician's are (Romanian and Hungarian, the
 * same meal worded two ways, one dish at several portions, a week for somebody
 * else), put through the real importer so the recipes, aliases and counts are
 * exactly what it would make of them. Every line below was written for this
 * file and none is taken from a plan.
 *
 * Writes src/test/fixtures/archive.json, which is committed.
 */

const OUT = resolve(import.meta.dirname, '../src/test/fixtures/archive.json')

const RO_DAYS = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica']
const HU_DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

type Day = Partial<Record<MealSlot, string[]>>

function week(
  n: number, language: 'ro' | 'hu', issuedOn: string, days: Day[],
  subject: 'self' | 'other' = 'self',
): PlanInput {
  const names = language === 'hu' ? HU_DAYS : RO_DAYS
  const when = new Date(issuedOn + 'T12:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return {
    id: `plan-${String(n).padStart(2, '0')}`,
    file: `fixture-week-${n}.docx`,
    label: subject === 'other' ? `Week of ${when} (Sam)` : `Week of ${when}`,
    language,
    issuedOn,
    subject,
    days: days.map((day, i) => ({
      dayName: names[i % 7],
      weekday: (i + 1) % 7,
      meals: (['breakfast', 'snack', 'lunch', 'dinner'] as MealSlot[]).flatMap((slot) =>
        (day[slot] ?? []).map((text) => ({ slot, text }))),
    })),
  }
}

// ─── Romanian, two weeks ──────────────────────────────────────────────────────

const roBreakfasts = [
  '170 g iaurt, 30 g fulgi de ovaz, 90 g fructe de padure',
  '2 felii de paine int, 70 g branza de vaci, rosii, castraveti',
  'terci de ovaz, 120 g pere',
  'omleta cu spanac, 1 felie de paine int',
  'budinca de chia cu mango',
  '170 g iaurt, 45 g fulgi de ovaz, 90 g fructe de padure',
  'fulgi de ovaz la cuptor',
]
const roSnacks = [
  '220 g mere, 15 g migdale',
  '180 g chefir',
  '260 g grapefruit, 12 g nuci',
  '1 banana',
  '160 g capsuni',
  '220 g mere, 15 g migdale',
  '30 g ciocolata neagra',
]
const roLunches = [
  '320 g ciorba de legume, 30 g paine int',
  '130 g somon, 220 g legume la cuptor, 40 g sos de usturoi cu iaurt',
  '110 g piept de pui, 60 g bulgur nefiert, salata de cruditati',
  'mancare de linte, 30 g paine int',
  'chili con carne, 55 g bulgur nefiert, muraturi',
  '320 g supa crema de dovleac, 30 g paine int',
  'tigaie picanta',
]
const roDinners = [
  'salata cu feta, 20 g orez expandat',
  'bruschete cu telemea',
  '160 g branza de vaci, 1 felie de paine int, ardei',
  'cod cu sos de salsa, 55 g orez brun nefiert',
  '320 g supa crema de conopida, 30 g paine int',
  'pasta de ton, 2 felii de paine int, castraveti',
  '300 g ciorba de pui, 1 felie de paine int',
]

const roWeek1: Day[] = RO_DAYS.map((_, i) => ({
  breakfast: [roBreakfasts[i]],
  snack: [roSnacks[i], roSnacks[(i + 3) % 7]],
  lunch: [roLunches[i]],
  dinner: [roDinners[i]],
}))

// The second week comes back to some of the first, the way hers do: the same
// lunch with a typo in it (the importer folds the two together), the same
// breakfast at another weight (one card, two portions).
const roWeek2: Day[] = RO_DAYS.map((_, i) => ({
  breakfast: [[
    '170 g iaurt, 40 g fulgi de ovaz, 90 g fructe de padure',
    'omleta cu ciuperci, 1 felie de paine int',
    'terci de ovaz, 120 g pere',
    '170 g iaurt, 30 g fulgi de ovaz, 90 g fructe de padure',
    '2 felii de paine int, 70 g branza de vaci, rosii, castraveti',
    'budinca de chia',
    'fulgi de ovaz la cuptor',
  ][i]],
  snack: [roSnacks[(i + 1) % 7]],
  lunch: [[
    '130 g somon, 220 g legume la cuptor, 40 g sos de usturoy cu iaurt',
    '320 g ciorba de varza, 30 g paine int',
    'mancare de linte, 30 g paine int',
    '110 g piept de pui, 60 g bulgur nefiert, salata de cruditati',
    'chili con carne, 55 g bulgur nefiert, muraturi',
    'tigaie picanta',
    '320 g ciorba de legume, 30 g paine int',
  ][i]],
  dinner: [[
    'bruschete cu telemea',
    'salata cu feta, 20 g orez expandat',
    '60 g telemea, 1 felie de paine int, rosii',
    '160 g branza de vaci, 1 felie de paine int, ardei',
    '320 g supa crema de conopida, 30 g paine int',
    'cod cu sos de salsa, 55 g orez brun nefiert',
    'pasta de ton, 2 felii de paine int, castraveti',
  ][i]],
}))

// ─── Hungarian, one week ──────────────────────────────────────────────────────

const huWeek: Day[] = [
  { breakfast: ['zabkása, 150 g áfonya'], snack: ['1 alma, 10 g dió'],
    lunch: ['gombakrémleves, 30 g teljes kiőrlésű kenyér'], dinner: ['130 g csirkemell, 180 g sült zöldségek'] },
  { breakfast: ['2 szelet teljes kiőrlésű kenyér, 50 g túró, paprika'], snack: ['170 g joghurt, 70 g málna'],
    lunch: ['lencsefőzelék, 1 tojás'], dinner: ['körözött, 2 szelet teljes kiőrlésű kenyér, uborka'] },
  { breakfast: ['spenótos rántotta, 1 szelet teljes kiőrlésű kenyér'], snack: ['1 körte, 12 g mandula'],
    lunch: ['zöldbableves, 30 g teljes kiőrlésű kenyér'], dinner: ['puliszka, 120 g túró, 150 g joghurt'] },
  { breakfast: ['zabkása, 150 g áfonya'], snack: ['1 alma, 10 g dió'],
    lunch: ['130 g lazac, 180 g sült zöldségek'], dinner: ['tonhalkrém, 2 szelet teljes kiőrlésű kenyér, paradicsom'] },
  { breakfast: ['chiamagos puding'], snack: ['170 g joghurt, 70 g málna'],
    lunch: ['tökfőzelék, 120 g csirkemell'], dinner: ['gombás quinoa'] },
]

// ─── Somebody else's week ─────────────────────────────────────────────────────

const otherWeek: Day[] = [
  { breakfast: ['terci de ovaz, 120 g pere'], snack: ['200 g struguri'],
    lunch: ['supa crema de rosii, 30 g paine int'], dinner: ['salata cu ton'] },
  { breakfast: ['2 ochiuri, 1 felie de paine int'], snack: ['1 banana'],
    lunch: ['mancare de spanac, 2 ochiuri'], dinner: ['bruschete cu telemea'] },
  { breakfast: ['170 g iaurt, 40 g fulgi de ovaz, 90 g fructe de padure'], snack: ['180 g chefir'],
    lunch: ['tocanita de porc, mamaliga'], dinner: ['salata de mozzarella'] },
]

const plans: PlanInput[] = [
  week(1, 'ro', '2025-01-06', roWeek1),
  // The newest: a full week, so loading the top one fills seven days.
  week(2, 'ro', '2025-01-13', roWeek2),
  week(3, 'hu', '2024-11-04', huWeek),
  week(4, 'ro', '2024-09-02', otherWeek, 'other'),
]

const library = buildLibrary(plans)
if (library.unresolved.length) {
  console.log('unresolved:')
  for (const u of library.unresolved) console.log(`  ${u.term}   <- ${u.raw}`)
}
const archive = toArchive(library)
writeArchiveFile(archive, OUT)
const counts = archiveCounts(archive)
console.log(`wrote ${OUT}: ${counts.plans} plans, ${counts.days} days, ${counts.recipes} recipes, `
  + `${Object.keys(archive.recipeAliases).length} aliases, ${library.lineCount} lines (${library.mappedLines} mapped)`)
