import { writeFileSync } from 'node:fs'
import { FOODS } from '../src/data/foods.js'

/**
 * Every food whose Romanian or Hungarian name needs your eye.
 *
 * Run: npm run data:translations
 *
 * Wholemeal bread is stored as "paine int" rather than "pâine integrală", and
 * that abbreviation is used verbatim in the search placeholder, so the first
 * thing anybody sees on the Foods screen is a typo. Quinoa has the English
 * word in both slots. Puffed rice cakes has only Romanian.
 *
 * Nothing here guesses. The author of this file does not speak either language
 * well enough to be trusted with a diacritic, and a wrong translation is worse
 * than a missing one: a missing one is visibly missing, and a wrong one is
 * quietly wrong in a search box for years.
 *
 * So it writes a list. Fill in the blanks, hand it back, and the values go into
 * `src/data/foods.ts` exactly as you typed them.
 */

interface Row {
  id: string
  english: string
  ro: string
  hu: string
  why: string[]
}

/** An abbreviation somebody typed in a hurry: a short word ending mid-word. */
const CLIPPED = /\b(int|integr|prep|congel|nefiert|prajit)\b/i

function reasons(en: string, ro: string | undefined, hu: string | undefined): string[] {
  const why: string[] = []

  if (!ro) why.push('no Romanian')
  if (!hu) why.push('no Hungarian')

  if (ro && ro.toLowerCase() === en.toLowerCase()) why.push('Romanian is the English word')
  if (hu && hu.toLowerCase() === en.toLowerCase()) why.push('Hungarian is the English word')

  if (ro && CLIPPED.test(ro)) why.push('Romanian looks abbreviated')
  if (hu && CLIPPED.test(hu)) why.push('Hungarian looks abbreviated')

  /*
   * A name with no diacritics is not evidence of anything.
   *
   * The first version of this flagged any Romanian or Hungarian name of more
   * than five letters that carried no diacritic, on the theory that it had
   * been typed on a keyboard without them. That put 75 of the 122 foods on the
   * list, and almost all of them were "orez expandat" and "zabpehely": real
   * words that simply have no diacritic in them. A list that is three quarters
   * noise is a list nobody finishes.
   *
   * The signal that actually distinguishes a stripped spelling is having both
   * versions, one in the name and one in the aliases. Where that is true the
   * name is already the right one, which is the case for "pâine integrală"
   * against its "paine int" alias, and there is nothing to fix.
   */
  return why
}

const rows: Row[] = []
for (const food of FOODS) {
  const why = reasons(food.names.en, food.names.ro, food.names.hu)
  if (!why.length) continue
  rows.push({
    id: food.id,
    english: food.names.en,
    ro: food.names.ro ?? '',
    hu: food.names.hu ?? '',
    why,
  })
}

const OUT = 'data/translations.json'
writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n')

console.log(`${rows.length} of ${FOODS.length} foods want a look.\n`)
const counted = new Map<string, number>()
for (const r of rows) for (const w of r.why) counted.set(w, (counted.get(w) ?? 0) + 1)
for (const [why, n] of [...counted].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${why}`)
}

console.log(`\nwrote ${OUT}`)
console.log('Fill in the "ro" and "hu" fields and leave anything you are unsure of as it is.')
console.log('Nothing here has been guessed at, and nothing will be.')
