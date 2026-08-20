/**
 * Emails both of you before a cook session.
 *
 * Runs on a schedule, every five minutes, and sends nothing almost every time.
 * The app itself cannot do this: a browser that is closed sends no email, and
 * the whole point of a reminder is that it reaches you when you are not
 * looking at the app.
 *
 * Deploy: supabase functions deploy cook-reminders
 * Secrets it needs: RESEND_API_KEY, REMINDER_FROM.
 * See the README for the schedule and the table it writes to.
 *
 * Times: a session is stored with `remindAt`, an instant worked out by the
 * browser that scheduled it. This function never parses a wall-clock time,
 * because it has no idea which wall the clock is on.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface CookSession {
  id: string
  date: string
  time: string
  label: string
  recipeIds: string[]
  completed: boolean
  remindAt?: string
}

const LEAD_MINUTES = 15

/**
 * Which reminders are due, from the instant alone.
 *
 * An hour-wide window, open at the reminder time. Wide enough that a job which
 * missed a run still sends, narrow enough that a job which was down all
 * morning does not deliver a flurry of emails about lunches that have already
 * happened. The session's own date and time are never parsed here: they are
 * wall-clock, and this process has no idea which wall.
 */
function due(sessions: CookSession[], now: Date): CookSession[] {
  const WINDOW_MS = 60 * 60_000
  return sessions.filter((s) => {
    if (s.completed || !s.remindAt) return false
    const at = Date.parse(s.remindAt)
    if (Number.isNaN(at)) return false
    return at <= now.getTime() && now.getTime() < at + WINDOW_MS
  })
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resend = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM')

  if (!url || !key || !resend || !from) {
    return new Response('Missing configuration', { status: 500 })
  }

  const db = createClient(url, key)
  const now = new Date()

  const { data: state } = await db
    .from('app_state').select('data').eq('key', 'bite-buddy-cook').maybeSingle()

  const sessions: CookSession[] = (state?.data as { sessions?: CookSession[] })?.sessions ?? []
  const ready = due(sessions, now)
  if (!ready.length) return Response.json({ sent: 0, checked: sessions.length })

  // What has already gone out. Sending the same reminder twice is worse than
  // sending it late: the second one teaches you to ignore the first.
  const { data: already } = await db
    .from('reminder_log').select('session_id').in('session_id', ready.map((s) => s.id))
  const sent = new Set((already ?? []).map((r) => r.session_id as string))

  const { data: members } = await db.from('members').select('email, display_name')
  const to = (members ?? []).map((m) => m.email as string).filter(Boolean)
  if (!to.length) return Response.json({ sent: 0, reason: 'nobody has signed in yet' })

  let count = 0

  for (const session of ready) {
    if (sent.has(session.id)) continue

    const when = `${session.date} at ${session.time}`
    const body = [
      `${session.label} starts at ${session.time}.`,
      session.recipeIds.length
        ? `${session.recipeIds.length} dishes to get through.`
        : 'Nothing picked out yet.',
      '',
      'Bite Buddy',
    ].join('\n')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Cooking in ${LEAD_MINUTES} minutes: ${session.label}`,
        text: body,
      }),
    })

    if (!response.ok) {
      // Left unlogged deliberately, so the next run tries again rather than
      // recording a send that never happened.
      console.error('send failed', session.id, await response.text())
      continue
    }

    await db.from('reminder_log').insert({
      session_id: session.id,
      sent_to: to,
      session_at: when,
    })
    count += 1
  }

  return Response.json({ sent: count, checked: sessions.length })
})
