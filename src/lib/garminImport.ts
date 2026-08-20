import type { SleepEntry, StepEntry } from '../types'

/**
 * Reading a Garmin export.
 *
 * Garmin has no free public API. Connect's API is a partner programme you
 * apply to, it needs a server holding the OAuth credentials, and this app has
 * neither, so nothing here talks to Garmin: it reads the file Garmin gives
 * you. Connect will export steps and sleep as CSV from its reports, and the
 * whole account as JSON from the privacy settings, and both land here.
 *
 * Deliberately tolerant. The column names differ by locale and by which report
 * you exported, the same file has been reshaped more than once over the years,
 * and a parser that only accepts one spelling is a parser that stops working
 * without warning. It looks for a date and a number, and says how many rows it
 * understood so a file it could not read is visibly a file it could not read.
 */

export interface ImportedActivity {
  steps: StepEntry[]
  sleep: SleepEntry[]
  /** Rows it saw and could not make sense of, so silence is never mistaken for success. */
  skipped: number
}

const DATE_KEYS = ['date', 'calendardate', 'day', 'data', 'datum']
const STEP_KEYS = ['steps', 'totalsteps', 'stepcount', 'pasi', 'schritte']
const SLEEP_KEYS = [
  'duration', 'sleeptime', 'totalsleep', 'sleepduration', 'hours', 'sleeptimeseconds',
]

function normalise(header: string): string {
  return header.toLowerCase().replace(/[^a-z]/g, '')
}

/** An ISO date out of whatever the export wrote. */
export function parseDate(value: string): string | undefined {
  const text = value.trim().replace(/"/g, '')
  if (!text) return undefined

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // 20/08/2026 and 20.08.2026, which is how Connect exports in Europe.
  const european = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text)
  if (european) {
    const [, d, m, y] = european
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString().slice(0, 10)
}

/**
 * Hours of sleep out of the several ways Garmin writes a duration.
 *
 * "7h 32m", "7:32", "452" meaning minutes, "27120" meaning seconds. The
 * distinction between the last two is by size, which is a guess, but a
 * defensible one: nobody sleeps 452 seconds and nobody sleeps 27120 minutes.
 */
export function parseDuration(value: string): number | undefined {
  const text = value.trim().replace(/"/g, '').toLowerCase()
  if (!text) return undefined

  const hm = /^(\d+)\s*h\s*(\d+)?\s*m?/.exec(text)
  if (hm) return Number(hm[1]) + Number(hm[2] ?? 0) / 60

  const colon = /^(\d+):(\d{2})$/.exec(text)
  if (colon) return Number(colon[1]) + Number(colon[2]) / 60

  const number = Number(text.replace(',', '.'))
  if (!Number.isFinite(number) || number <= 0) return undefined

  if (number > 1000) return number / 3600   // seconds
  if (number > 24) return number / 60       // minutes
  return number                             // already hours
}

function splitCsvLine(line: string): string[] {
  // Enough CSV for an export: quoted fields, commas or semicolons between.
  const out: string[] = []
  let field = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') { quoted = !quoted; continue }
    if ((char === ',' || char === ';') && !quoted) { out.push(field); field = ''; continue }
    field += char
  }
  out.push(field)
  return out
}

export interface ImportOptions {
  personId: string
  /** Which figures the file holds, since one export rarely holds both. */
  kind: 'steps' | 'sleep'
}

function id(prefix: string, personId: string, date: string): string {
  return `${prefix}-${personId}-${date}`
}

export function parseGarminCsv(text: string, { personId, kind }: ImportOptions): ImportedActivity {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const result: ImportedActivity = { steps: [], sleep: [], skipped: 0 }
  if (lines.length < 2) return result

  const headers = splitCsvLine(lines[0]).map(normalise)
  const dateAt = headers.findIndex((h) => DATE_KEYS.includes(h))
  const valueAt = headers.findIndex((h) =>
    (kind === 'steps' ? STEP_KEYS : SLEEP_KEYS).includes(h))

  if (dateAt < 0 || valueAt < 0) return result

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const date = parseDate(cells[dateAt] ?? '')
    const raw = cells[valueAt] ?? ''

    if (!date) { result.skipped += 1; continue }

    if (kind === 'steps') {
      const steps = Number(raw.replace(/[^\d]/g, ''))
      if (!Number.isFinite(steps) || steps <= 0) { result.skipped += 1; continue }
      result.steps.push({ id: id('steps', personId, date), personId, date, steps, source: 'garmin' })
    } else {
      const hours = parseDuration(raw)
      if (hours == null) { result.skipped += 1; continue }
      result.sleep.push({
        id: id('sleep', personId, date), personId, date,
        hours: Math.round(hours * 100) / 100, source: 'garmin',
      })
    }
  }

  return result
}

/**
 * The account export, which is JSON rather than CSV.
 *
 * Garmin's privacy export is a zip of files with different shapes; the two
 * that matter carry a calendar date beside a step count or a sleep duration in
 * seconds. Anything else in the file is ignored rather than guessed at.
 */
export function parseGarminJson(text: string, personId: string): ImportedActivity {
  const result: ImportedActivity = { steps: [], sleep: [], skipped: 0 }

  let data: unknown
  try { data = JSON.parse(text) } catch { return result }

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data as Record<string, unknown>[]
    : typeof data === 'object' && data !== null
      ? Object.values(data as Record<string, unknown>).flatMap((v) =>
          Array.isArray(v) ? v as Record<string, unknown>[] : [])
      : []

  for (const row of rows) {
    const rawDate = row.calendarDate ?? row.date ?? row.sleepStartTimestampLocal
    const date = typeof rawDate === 'string' ? parseDate(rawDate) : undefined
    if (!date) { result.skipped += 1; continue }

    const steps = row.totalSteps ?? row.steps
    if (typeof steps === 'number' && steps > 0) {
      result.steps.push({ id: id('steps', personId, date), personId, date, steps, source: 'garmin' })
    }

    const seconds = row.sleepTimeSeconds ?? row.sleepingSeconds
    if (typeof seconds === 'number' && seconds > 0) {
      result.sleep.push({
        id: id('sleep', personId, date), personId, date,
        hours: Math.round((seconds / 3600) * 100) / 100, source: 'garmin',
      })
    }
  }

  return result
}
