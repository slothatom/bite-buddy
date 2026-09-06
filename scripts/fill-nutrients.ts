import { readFileSync, writeFileSync } from 'node:fs'
import { FOODS } from '../src/data/foods.js'
import type { Food } from '../src/types/index.js'

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
async function lookup(food: Food): Promise<Found | null> {
  const query = food.names.en
  for (const dataType of ['SR Legacy,Foundation', 'Survey (FNDDS)']) {
    const url = `${USDA}/foods/search?api_key=${encodeURIComponent(KEY)}`
      + `&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent(dataType)}&pageSize=1`

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
    if (!res.ok) throw new Refused(res.status, (await res.text()).slice(0, 300))

    const body = await res.json() as {
      foods?: { fdcId: number; description: string; foodNutrients?: { nutrientId: number; value: number }[] }[]
    }
    const hit = body.foods?.[0]
    if (!hit) continue

    const value = (id: number) =>
      hit.foodNutrients?.find((n) => n.nutrientId === id)?.value

    const fiber = value(FIBRE)
    const sodium = value(SODIUM)
    if (fiber == null && sodium == null) continue

    return { fiber, sodium, matched: hit.description, fdcId: hit.fdcId }
  }
  return null
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
    await lookup(wanted[0])
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

void main()
