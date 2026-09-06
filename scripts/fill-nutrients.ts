import { readFileSync, writeFileSync } from 'node:fs'
import { FOODS } from '../src/data/foods.js'
import type { Food, Nutrients } from '../src/types/index.js'

/**
 * Fills in the salt and fibre figures the food database is missing.
 *
 * Run:  npm run data:nutrients            (writes nothing, shows the plan)
 *       npm run data:nutrients -- --write (edits src/data/foods.ts)
 *
 * 107 of the 122 foods have no fibre or no sodium figure, and both are shown
 * as tracked daily targets on every day summary and every recipe. A fibre
 * total built from fifteen foods is not a fibre total.
 *
 * This has to run on a machine with network access. The agent container that
 * wrote it cannot reach api.nal.usda.gov or world.openfoodfacts.org: the
 * proxy answers 403 to both, so nothing here was ever run by its author. Read
 * the diff rather than trusting it.
 *
 * Two things it will not do. It will not overwrite a figure that is already
 * there, because the curated ones came from USDA SR Legacy and European
 * composition tables and were checked by a person. And it will not invent one:
 * a food it cannot find is left alone and listed at the end, for you to fill
 * in or leave empty. Empty is a fact the app already knows how to say.
 */

const USDA = 'https://api.nal.usda.gov/fdc/v1'
/*
 * Trimmed, because a key gets here by being pasted.
 *
 * A trailing newline from a copy, or the space a phone keyboard adds after a
 * paste, both survive into a repository secret, and USDA answers the resulting
 * request with 403. Untrimmed, that is indistinguishable from a wrong key.
 */
const KEY = (process.env.USDA_API_KEY ?? 'DEMO_KEY').trim()
const WRITE = process.argv.includes('--write')

/** A request USDA turned down, as opposed to a food it does not know. */
class Refused extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`USDA answered ${status}`)
  }
}

/** USDA's own numbers for the two nutrients we are short of. */
const FIBRE = 1079
const SODIUM = 1093

/**
 * And the four we already have, which is what makes this checkable.
 *
 * Every food in the library carries curated calories and macros, verified by
 * `npm run data:check`, which fails the build if a food's stated calories
 * disagree with its own protein, carbs and fat. That is a fingerprint, and a
 * USDA row describing the same food has to match it.
 */
/*
 * Energy under any of the three ids USDA uses for it.
 *
 * 1008 is kcal on most rows; the Foundation set states Atwater general (2047)
 * and specific (2048) instead on some. Looking only for 1008 would have meant
 * the energy check silently never running on exactly the rows it matters most
 * for, which is a way of appearing to check something.
 */
const ENERGY_IDS = [1008, 2048, 2047]
const ENERGY = 1008
const PROTEIN = 1003
const CARBS = 1005
const FAT = 1004

interface Found {
  fiber?: number
  sodium?: number
  /** What it matched, so a wrong match is visible in the report. */
  matched: string
  /** USDA's own id, so a figure can be traced back to a row. */
  fdcId: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The best USDA row for a food, preferring the least processed description.
 *
 * SR Legacy and Foundation are composition-table data. Branded is whatever a
 * manufacturer typed on a label, and its sodium figures in particular are all
 * over the place, so it is asked for last and only when nothing else answers.
 */
/**
 * The searches to try, best data first, and the last one unfiltered.
 *
 * `undefined` is the point of the third. The first two ask only for
 * composition-table rows, which is right when they have the food, and wrong
 * when nothing in them matches: a filter that excludes every row returns an
 * empty answer rather than a worse one, and the script read that as USDA not
 * knowing what an apple is.
 */
const ATTEMPTS: (string | undefined)[] = ['Foundation,SR Legacy', 'Survey (FNDDS)', undefined]

/**
 * The query string, with the commas left alone.
 *
 * `encodeURIComponent('Foundation,SR Legacy')` turns the comma into `%2C`, and
 * USDA splits its dataType list on a literal comma before decoding, so the
 * whole thing arrived as one dataType nobody has ever heard of. It answered
 * 200 with an empty list, 119 times, and the report called that "nothing
 * found". Each part is encoded on its own and the separators stay separators.
 */
function search(query: string, dataType: string | undefined): string {
  const parts = [
    `api_key=${encodeURIComponent(KEY)}`,
    `query=${encodeURIComponent(query)}`,
    // Ten, not one. The top hit is whatever USDA's relevance ranking likes,
    // and for a legume that is reliably the tin. See `pick` below.
    'pageSize=10',
  ]
  if (dataType) {
    parts.push(`dataType=${dataType.split(',').map(encodeURIComponent).join(',')}`)
  }
  return `${USDA}/foods/search?${parts.join('&')}`
}

export interface Candidate {
  fdcId: number
  description: string
  foodNutrients?: { nutrientId: number; value: number }[]
}

/**
 * Which of ten USDA rows is the food the dietician actually wrote down.
 *
 * The first run that worked imported 413 mg of sodium for rolled oats, 238 for
 * cooked lentils and 243 for cooked chickpeas. Rolled oats have about 2. So do
 * lentils you boiled yourself. Those figures are real, and they belong to
 * instant fortified oat cereal and to lentils out of a tin, which is what
 * USDA's relevance ranking hands back first for a bare word like "lentils".
 *
 * That mattered more than a wrong fibre figure would have. Sodium is one of
 * the daily targets this app reports against, the plans say "linte fiartă",
 * home-boiled, and importing the tin would have had the app quietly reporting
 * a salt intake that never happened, sourced and cited and wrong.
 *
 * So the description is read. Anything processed or salted is refused outright
 * rather than ranked down, because a wrong number is worse than no number and
 * the app already knows how to say it does not know.
 */
const PROCESSED = /\b(canned|salted|with salt|in brine|pickled|instant|fortified|dry mix|restaurant|fast ?food|baby ?food|infant|sweetened|breaded|fried)\b/i

/** What a plain, unmessed-with row tends to say about itself. */
const PLAIN = /\b(raw|without salt|unsalted|boiled, drained|drained solids|uncooked|dry|whole)\b/i

export /**
 * Whether a USDA row is plausibly the same food we already hold.
 *
 * Reading the description was not enough, and the run that proved it is worth
 * recording. Searching by name gave "Chicken, roasting" for roasted
 * vegetables, smoked salmon for telemea, water spinach for water, milk
 * crackers for milk, goat meat for goat cheese, corned beef for beef, grape
 * leaves for grapes, orange peel for oranges and rose-apples for apples. Two
 * dozen more like it. Every one of those descriptions is honest; the search
 * simply answered a different question from the one being asked.
 *
 * The library already knows what each of these foods is: calories, protein,
 * carbs and fat, curated by hand and checked against each other on every
 * build. USDA states the same four. A row that agrees on all of them is very
 * likely the same food, and a row that does not is not, whatever its name
 * says. Water is nought calories and water spinach is nineteen; that is the
 * end of the argument, and no amount of string matching gets there.
 *
 * It also disposes of the house dishes without a special case. Eggplant
 * spread, yogurt garlic sauce, the coconut and raspberry cake: USDA has never
 * heard of any of them, will hand back an ingredient or a brand, and the
 * macros will say so.
 */
const TOLERANCE: { id: number; of: (n: Nutrients) => number | undefined; floor: number }[] = [
  // A quarter out, or the floor, whichever is more forgiving. The floors are
  // there so a food with almost no fat is not failed by a rounding difference
  // in the first decimal place.
  { id: ENERGY, of: (n) => n.calories, floor: 15 },
  { id: PROTEIN, of: (n) => n.protein, floor: 2 },
  { id: CARBS, of: (n) => n.carbs, floor: 2.5 },
  { id: FAT, of: (n) => n.fat, floor: 2 },
]

/** How many rows the macro check refused across the run, for the report. */
let turnedDown = 0

/** A figure off a USDA row, taking the first id it actually states. */
function stated(candidate: Candidate, ids: number[]): number | undefined {
  for (const id of ids) {
    const found = candidate.foodNutrients?.find((n) => n.nutrientId === id)?.value
    if (found != null) return found
  }
  return undefined
}

export function resembles(candidate: Candidate, food: Food): boolean {
  for (const { id, of, floor } of TOLERANCE) {
    const theirs = stated(candidate, id === ENERGY ? ENERGY_IDS : [id])
    const ours = of(food.per100g)
    // A figure one of them does not state cannot disagree. Energy in
    // particular is absent from some rows, which is not evidence either way.
    if (theirs == null || ours == null) continue
    if (Math.abs(theirs - ours) > Math.max(floor, ours * 0.25)) return false
  }
  return true
}

export function pick(candidates: Candidate[], food: Food): Candidate | undefined {
  const usable = candidates.filter((c) => {
    // A row with neither figure answers neither question.
    const has = c.foodNutrients?.some((n) => n.nutrientId === FIBRE || n.nutrientId === SODIUM)
    if (!has || PROCESSED.test(c.description)) return false
    if (!resembles(c, food)) {
      turnedDown += 1
      return false
    }
    return true
  })

  // A cooked food wants a cooked row, and a dry one a dry row, where USDA
  // offers both. Where it offers neither, order is USDA's own relevance, which
  // is a reasonable answer once the salted rows are out of the way.
  const wants = food.state === 'cooked' ? /\bcooked|boiled\b/i
    : food.state === 'raw' ? /\braw\b/i
      : food.state === 'dry' ? /\bdry|uncooked|raw\b/i
        : null

  return (wants && usable.find((c) => wants.test(c.description)))
    ?? usable.find((c) => PLAIN.test(c.description))
    ?? usable[0]
}

async function lookup(food: Food): Promise<Found | null> {
  const query = food.names.en
  /** Every status USDA gave, so a food that fails everywhere says how. */
  const refusals: number[] = []
  /** Whether anything was offered and turned down, as opposed to nothing found. */
  let rejected = false

  for (const dataType of ATTEMPTS) {
    const url = search(query, dataType)

    const res = await fetch(url)
    if (res.status === 429) {
      console.error('\nUSDA is rate limiting. DEMO_KEY allows very few requests an hour.')
      console.error('Get a free key at https://fdc.nal.usda.gov/api-key-signup.html and re-run with')
      console.error('  USDA_API_KEY=your-key npm run data:nutrients -- --write\n')
      process.exit(1)
    }
    /*
     * A refusal is not an absence.
     *
     * This line was `if (!res.ok) continue`, which threw the status away and
     * carried on. The first real run of this script put a key with a trailing
     * character into every request, USDA answered 403 to all 119 of them, and
     * the report said "119 left alone, nothing found" as though the world's
     * largest food composition database had never heard of broccoli. A wrong
     * key and a missing food have to look different, so this says which.
     */
    /*
     * A refusal is not an absence, but nor is it the end of this food.
     *
     * The status used to be thrown away entirely, which is how 119 rejected
     * requests came to be reported as a database with no broccoli in it. Then
     * it was thrown, which was too far the other way: one attempt answering
     * 400 abandoned a food that the next attempt would have found, and six
     * were lost that way. Remembered, tried past, and reported only if every
     * attempt fails.
     */
    if (!res.ok) {
      refusals.push(res.status)
      continue
    }

    const body = await res.json() as { foods?: Candidate[] }
    const offered = body.foods ?? []
    const hit = pick(offered, food)
    if (!hit) {
      // Worth telling apart in the report. "USDA has nothing for pomelo" and
      // "USDA offered ten rows and none of them was pomelo" are different
      // facts, and after the macro check the second is the common one and is
      // the check working rather than a gap in the data.
      if (offered.length) rejected = true
      continue
    }

    const value = (id: number) =>
      hit.foodNutrients?.find((n) => n.nutrientId === id)?.value

    const fiber = value(FIBRE)
    const sodium = value(SODIUM)
    if (fiber == null && sodium == null) continue

    return { fiber, sodium, matched: hit.description, fdcId: hit.fdcId }
  }

  if (refusals.length === ATTEMPTS.length) {
    throw new Refused(refusals[0], `every attempt refused: ${refusals.join(', ')}`)
  }
  if (rejected) throw new Error('USDA offered rows, none of them this food')
  return null
}

/**
 * The first request, reported rather than merely survived.
 *
 * Twice now this script has printed a tidy report of a run in which every
 * single request came back useless, because a request that answers 200 with an
 * empty list is indistinguishable from a food nobody has heard of once you
 * have thrown the response away. So the first one is described out loud: the
 * URL it asked, what came back, and what was in it. Nine lines of output, and
 * the difference between diagnosing this in one run and in three.
 */
const PROBE = 'broccoli'

/** Named in the report, so a stale checkout is visible in its own output. */
const MATCHING = 'name, then description, then calories and macros'

const NAMES: Record<number, string> = {
  [ENERGY]: 'kcal', [PROTEIN]: 'protein', [CARBS]: 'carbs', [FAT]: 'fat',
}

async function preflight(): Promise<void> {
  // A word USDA certainly holds, rather than the first food in the library.
  // The first food is "Wholemeal flatbread", which may honestly have no match
  // in a composition table, and a preflight that fails on a real absence would
  // stop a perfectly healthy run.
  // A line that changes whenever the matching changes. Two runs in a row have
  // come back byte-identical to the one before them, and there was no way to
  // tell a fix that did not work from a fix that was not running.
  console.log(`Matching on: ${MATCHING}`)
  console.log(`Asking USDA about "${PROBE}" first, to see what it says.\n`)

  for (const dataType of ATTEMPTS) {
    // The key is the one thing that must not be printed. It goes into a
    // repository secret, and Actions redacts secrets from its logs, but a log
    // is not the only place output ends up.
    const url = search(PROBE, dataType)
    console.log(`  ${dataType ?? 'no dataType filter'}`)
    console.log(`    ${url.replace(/api_key=[^&]*/, 'api_key=REDACTED')}`)

    const res = await fetch(url)
    if (!res.ok) throw new Refused(res.status, (await res.text()).slice(0, 300))

    // The full row shape, not just a description: the report below reads the
    // nutrients off it to prove the macro check has figures to compare.
    const body = await res.json() as { foods?: Candidate[] }
    const hits = body.foods ?? []
    console.log(`    ${res.status}, ${hits.length} result${hits.length === 1 ? '' : 's'}`
      + (hits[0] ? `: "${hits[0].description}"` : ''))

    if (hits.length) {
      /*
       * What the row actually carries, before anything is trusted.
       *
       * The macro check compares four figures USDA is assumed to state. If it
       * states none of them the check passes everything and looks exactly like
       * a check that is working, which is the failure this prints its way out
       * of. Four numbers here means the comparison has something to compare.
       */
      const seen = TOLERANCE.map(({ id }) => {
        const value = stated(hits[0], id === ENERGY ? ENERGY_IDS : [id])
        return `${NAMES[id]} ${value ?? 'absent'}`
      })
      console.log(`    it states: ${seen.join(', ')}`)
      if (seen.every((t) => t.endsWith('absent'))) {
        console.error('\nUSDA is stating none of the four figures the match is checked against,')
        console.error('so every row would pass unchecked. Refusing to import on that basis.\n')
        process.exit(1)
      }
      console.log('\nThat works. Fetching the rest.\n')
      return
    }
  }

  console.error(`\nUSDA answered every one of those about "${PROBE}" and had nothing in any.`)
  console.error('That is not a key problem: it accepted the request. Either the search')
  console.error('endpoint has changed shape, or the query is being sent wrong.')
  console.error('Send the three lines above to whoever maintains this script.\n')
  process.exit(1)
}

/** Rounded the way the rest of the file is: a decimal for grams, whole for mg. */
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

async function main() {
  const wanted = FOODS.filter((f) => f.per100g.fiber == null || f.per100g.sodium == null)
  console.log(`${wanted.length} of ${FOODS.length} foods are missing fibre, sodium or both.\n`)
  if (KEY === 'DEMO_KEY') {
    console.log('No USDA_API_KEY set, so this is using DEMO_KEY and will be rate limited.')
    console.log('A free key takes a minute: https://fdc.nal.usda.gov/api-key-signup.html\n')
  }

  const edits: { id: string; fiber?: number; sodium?: number; matched: string; fdcId: number }[] = []
  const missed: string[] = []

  /*
   * One request before the other 118.
   *
   * Everything that can be wrong with the setup, a bad key, a key with a
   * newline in it, no network, USDA down, is wrong on the first request as
   * surely as on the last. Finding out here costs two seconds; finding out at
   * the end costs five minutes and a page of dots that reads like an answer.
   */
  try {
    await preflight()
  } catch (e) {
    if (e instanceof Refused) {
      console.error(`\nUSDA turned the first request down: ${e.status}.\n`)
      if (e.status === 403 || e.status === 401) {
        console.error('That is what it answers to a key it does not accept. Check the')
        console.error('USDA_API_KEY secret for a stray space or newline from the paste,')
        console.error('and that it is the key from https://fdc.nal.usda.gov/api-key-signup.html')
      }
      console.error(`\nWhat it said:\n${e.body}\n`)
    } else {
      console.error(`\nCould not reach USDA at all: ${(e as Error).message}\n`)
    }
    process.exit(1)
  }

  for (const food of wanted) {
    const found = await lookup(food).catch((e: Error) => {
      // Past the preflight, one food failing is not worth abandoning the rest,
      // but it is worth saying so rather than filing it under "not found".
      missed.push(`${food.id} (${food.names.en}): ${e.message}`)
      return null
    })
    // Gentle on a public API that asks nicely.
    await sleep(250)

    if (!found) {
      // A lookup that threw has already said why. This is the other case: USDA
      // answered, and had nothing for this name.
      if (!missed.some((m) => m.startsWith(`${food.id} (`))) {
        missed.push(`${food.id} (${food.names.en})`)
      }
      process.stdout.write('.')
      continue
    }

    const edit = {
      id: food.id,
      fiber: food.per100g.fiber == null && found.fiber != null ? round(found.fiber, 1) : undefined,
      sodium: food.per100g.sodium == null && found.sodium != null ? round(found.sodium, 0) : undefined,
      matched: found.matched,
      fdcId: found.fdcId,
    }
    if (edit.fiber == null && edit.sodium == null) {
      missed.push(`${food.id} (${food.names.en}): matched but had neither figure`)
      process.stdout.write('.')
      continue
    }
    edits.push(edit)
    process.stdout.write('+')
  }

  console.log('\n')
  if (turnedDown) {
    console.log(`${turnedDown} rows were offered and refused: they did not match the`)
    console.log('calories and macros this library already holds for that food.\n')
  }
  for (const e of edits) {
    const parts = [
      e.fiber != null ? `fibre ${e.fiber} g` : null,
      e.sodium != null ? `sodium ${e.sodium} mg` : null,
    ].filter(Boolean).join(', ')
    console.log(`  ${e.id.padEnd(28)} ${parts.padEnd(34)} from "${e.matched}" (#${e.fdcId})`)
  }

  if (missed.length) {
    console.log(`\n${missed.length} left alone, nothing found:\n  ${missed.join('\n  ')}`)
    console.log('\nThese stay empty. The app says "not known" rather than nought,')
    console.log('which is the honest answer and the one it already knows how to give.')
  }

  if (!WRITE) {
    console.log(`\n${edits.length} foods would change. Re-run with --write to make the edits.`)
    return
  }

  // Edited as text rather than regenerated, so the file keeps its comments,
  // its ordering and its section headings. Every one of those was written by
  // a person and none of it survives a round trip through JSON.
  let source = readFileSync('src/data/foods.ts', 'utf8')
  let changed = 0

  for (const edit of edits) {
    const at = source.indexOf(`id: '${edit.id}'`)
    if (at < 0) continue
    const open = source.indexOf('per100g: {', at)
    const close = source.indexOf('}', open)
    if (open < 0 || close < 0) continue

    let block = source.slice(open, close)
    if (edit.fiber != null && !/\bfiber:/.test(block)) block += `, fiber: ${edit.fiber}`
    if (edit.sodium != null && !/\bsodium:/.test(block)) block += `, sodium: ${edit.sodium}`
    source = source.slice(0, open) + block + source.slice(close)
    changed += 1
  }

  writeFileSync('src/data/foods.ts', source)
  console.log(`\nwrote ${changed} foods into src/data/foods.ts`)
  console.log('Now run:  npm run verify')
  console.log('Then read the diff before committing. Every number in it came from')
  console.log('a search result, and a search result can match the wrong food.')
}

/*
 * Only when run, never when imported.
 *
 * `pick` decides which of ten USDA rows becomes a number in the app, which
 * makes it the one part of this file worth testing, and a module that fetches
 * 119 foods the moment it is imported cannot be tested at all.
 */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '\u0000')) {
  void main()
}
