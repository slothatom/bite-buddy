import type { CookSession } from '../types'

/**
 * When to tell both of you that a cook session is coming up.
 *
 * A session is written as a date and a wall-clock time, which is what you
 * think in and not something a server can act on: "18:00" is an instant only
 * once you know where the person typing it was standing. So the browser turns
 * it into one when the session is saved, and everything after that works in
 * instants.
 */

/** Fifteen minutes: long enough to wash your hands, short enough to still be true. */
export const LEAD_MINUTES = 15

/** The instant a session starts, read in this device's timezone. */
export function sessionStart(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}

/** The instant to send the reminder, or undefined if the session is in the past. */
export function reminderAt(date: string, time: string, now = new Date()): string | undefined {
  const start = sessionStart(date, time)
  if (Number.isNaN(start.getTime())) return undefined

  const at = new Date(start.getTime() - LEAD_MINUTES * 60_000)
  // A session being planned for this evening is normal; one being planned for
  // last Tuesday is a correction, and nobody wants an email about it.
  if (at.getTime() <= now.getTime()) return undefined
  return at.toISOString()
}

/**
 * The sessions whose moment has come.
 *
 * Bounded on both sides. A job that has not run for a day should not send a
 * flurry of emails about sessions that have already happened, so anything
 * whose start time has passed is left alone.
 */
export function dueReminders(sessions: CookSession[], now: Date): CookSession[] {
  return sessions.filter((s) => {
    if (s.completed || !s.remindAt) return false
    const at = Date.parse(s.remindAt)
    const start = sessionStart(s.date, s.time).getTime()
    return at <= now.getTime() && now.getTime() < start
  })
}

/** How the reminder time reads on screen, in the timezone it was set in. */
export function reminderLabel(remindAt: string): string {
  return new Date(remindAt).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}
