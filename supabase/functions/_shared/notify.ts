/**
 * What is worth waking a phone for.
 *
 * Deliberately free of imports, so the same file runs in the Edge Function on
 * Deno and under vitest here. The part of a notification system that goes wrong
 * is never the encryption, which is a library's job; it is deciding what to
 * send and how often, which is this, and which is testable.
 *
 * The rule throughout: a notification you would not have wanted is more
 * expensive than one you missed. The first teaches people to turn the whole
 * thing off.
 */

export interface CookSession {
  id: string
  date: string
  time: string
  label: string
  recipeIds: string[]
  completed: boolean
  remindAt?: string
}

/** A plan row as the database holds it. */
export interface PlanRow {
  id: string
  day: string | null
  slot: string | null
  updated_at: string
  updated_by: string | null
  deleted_at: string | null
}

export interface Note {
  /** Groups notifications on the phone, so a newer one replaces its elder. */
  tag: string
  title: string
  body: string
  /** Where tapping it should land. */
  path: string
}

export const LEAD_MINUTES = 15

/**
 * Which reminders are due, from the instant alone.
 *
 * An hour-wide window, open at the reminder time. Wide enough that a job which
 * missed a run still sends, narrow enough that a job which was down all morning
 * does not deliver a flurry about lunches that already happened. The session's
 * own date and time are never parsed: they are wall-clock, and this process has
 * no idea which wall.
 */
export function dueSessions(sessions: CookSession[], now: Date): CookSession[] {
  const WINDOW_MS = 60 * 60_000
  return sessions.filter((s) => {
    if (s.completed || !s.remindAt) return false
    const at = Date.parse(s.remindAt)
    if (Number.isNaN(at)) return false
    return at <= now.getTime() && now.getTime() < at + WINDOW_MS
  })
}

export function cookNote(session: CookSession): Note {
  const dishes = session.recipeIds.length
  return {
    tag: `cook-${session.id}`,
    title: `Cooking in ${LEAD_MINUTES} minutes`,
    body: dishes
      ? `${session.label} at ${session.time}, ${dishes} dish${dishes === 1 ? '' : 'es'} to get through.`
      : `${session.label} at ${session.time}.`,
    path: '/#/schedule',
  }
}

/**
 * How long a person gets to finish planning before anyone is told about it.
 *
 * Planning a week is thirty edits in five minutes, and thirty notifications is
 * an uninstall. Nothing is sent until the other person has been still for this
 * long, at which point the whole burst becomes one line.
 */
export const SETTLE_MINUTES = 10

/**
 * What the other person did, once they have stopped doing it.
 *
 * `since` is the last thing this recipient was told about. Rows they wrote
 * themselves are skipped: you do not need telling what you just did, and a
 * notification for your own edit is the single fastest way to lose someone's
 * trust in the feature.
 *
 * Returns null when there is nothing to say, which is almost every run.
 */
export function planNote(
  rows: PlanRow[],
  recipient: string,
  since: string,
  now: Date,
  names: Map<string, string> = new Map(),
): { note: Note; watermark: string } | null {
  const settled = now.getTime() - SETTLE_MINUTES * 60_000

  const theirs = rows.filter((r) =>
    r.updated_by
    && r.updated_by !== recipient
    && r.updated_at > since
    && Date.parse(r.updated_at) <= settled)

  if (!theirs.length) return null

  // Still typing. Say nothing at all rather than half of it, and leave the
  // watermark alone so the whole burst arrives together on a later run.
  const stillGoing = rows.some((r) =>
    r.updated_by
    && r.updated_by !== recipient
    && Date.parse(r.updated_at) > settled)
  if (stillGoing) return null

  const added = theirs.filter((r) => !r.deleted_at).length
  const removed = theirs.filter((r) => r.deleted_at).length
  const days = new Set(theirs.map((r) => r.day).filter(Boolean))
  const who = names.get(theirs[0].updated_by!) ?? 'The other one of you'

  const parts: string[] = []
  if (added) parts.push(`${added} meal${added === 1 ? '' : 's'} planned`)
  if (removed) parts.push(`${removed} taken off`)

  return {
    note: {
      tag: 'plan-changes',
      title: `${who} changed the week`,
      body: `${parts.join(', ')} across ${days.size} day${days.size === 1 ? '' : 's'}.`,
      path: '/#/plan',
    },
    watermark: theirs.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), since),
  }
}
