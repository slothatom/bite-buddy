/**
 * Tells you things while the app is closed.
 *
 * Runs on a schedule, every five minutes, and sends nothing almost every time.
 * The app itself cannot do this: a browser that is closed sends no email and
 * receives no push, and the whole point of a reminder is that it reaches you
 * when you are not looking at the app.
 *
 * Two jobs, one schedule:
 *
 *  1. **Before a cooking session.**
 *  2. **When the other one of you changes the week.**
 *
 * Push only, both of them. There was an email path here and it has been taken
 * out: reaching two different mailboxes needs a verified sending domain, and a
 * push reaches both phones for nothing. A second channel that only worked for
 * one of the two people would have been worse than no second channel.
 *
 * Deploy: supabase functions deploy notify
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 *
 * What decides whether to send anything lives in ../_shared/notify.ts, which
 * has no imports precisely so it can be tested under vitest with the rest of
 * the app. This file is the plumbing around those decisions.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  dueSessions, cookNote, planNote,
  type CookSession, type Note, type PlanRow,
} from '../_shared/notify.ts'

interface Subscription {
  endpoint: string
  member_id: string
  p256dh: string
  auth: string
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return new Response('Missing configuration', { status: 500 })

  const db = createClient(url, key)
  const now = new Date()

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const canPush = Boolean(vapidPublic && vapidPrivate)
  if (canPush) {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:nobody@example.com',
      vapidPublic!,
      vapidPrivate!,
    )
  }

  const { data: members } = await db.from('members').select('id, email, display_name')
  const people = members ?? []
  // Only real names go in. An empty entry would beat the fallback in the
  // shared code and produce "They changed the week", which reads like a bug.
  const names = new Map(
    people
      .filter((m) => (m.display_name as string | null)?.trim())
      .map((m) => [m.id as string, (m.display_name as string).trim()]),
  )

  /**
   * Sends to every device one person has registered.
   *
   * A push service answering 404 or 410 means that subscription is gone for
   * good: the browser was uninstalled, or the person cleared their site data.
   * Marking it stops the next run trying again, for ever. Every other failure
   * is left alone, because a push service having a bad afternoon is not a
   * reason to forget somebody's phone.
   */
  async function push(memberId: string, note: Note): Promise<number> {
    if (!canPush) return 0

    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, member_id, p256dh, auth')
      .eq('member_id', memberId)
      .is('failed_at', null)

    let sent = 0
    for (const sub of (subs ?? []) as Subscription[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(note),
        )
        sent += 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions')
            .update({ failed_at: new Date().toISOString() })
            .eq('endpoint', sub.endpoint)
        } else {
          console.error('push failed', sub.endpoint.slice(-12), status, (e as Error).message)
        }
      }
    }
    return sent
  }

  /** Who wants what. Absent means yes: a new device is not a silent one. */
  async function wants(memberId: string): Promise<{ cook: boolean; plan: boolean; seen: string }> {
    const { data } = await db
      .from('notify_state')
      .select('want_cook, want_plan, plan_seen_at')
      .eq('member_id', memberId)
      .maybeSingle()

    return {
      cook: data?.want_cook ?? true,
      plan: data?.want_plan ?? true,
      seen: (data?.plan_seen_at as string) ?? new Date(now.getTime() - 60 * 60_000).toISOString(),
    }
  }

  // ─── Before a cooking session ──────────────────────────────────────────────

  const { data: sessionRows } = await db
    .from('cook_sessions').select('data').is('deleted_at', null)

  const sessions = (sessionRows ?? [])
    .map((r) => r.data as CookSession)
    .filter(Boolean)

  const ready = dueSessions(sessions, now)
  let pushed = 0

  if (ready.length) {
    // What has already gone out. Sending the same reminder twice is worse than
    // sending it late: the second one teaches you to ignore the first.
    const { data: already } = await db
      .from('reminder_log').select('session_id').in('session_id', ready.map((s) => s.id))
    const sent = new Set((already ?? []).map((r) => r.session_id as string))

    for (const session of ready) {
      if (sent.has(session.id)) continue

      const note = cookNote(session)
      let delivered = false

      for (const member of people) {
        if (!(await wants(member.id as string)).cook) continue
        const count = await push(member.id as string, note)
        pushed += count
        if (count) delivered = true
      }

      // Logged only when something actually arrived, so a run that reached
      // nobody tries again rather than recording a send that never happened.
      if (delivered) {
        await db.from('reminder_log').insert({
          session_id: session.id,
          sent_to: people.map((m) => m.email as string).filter(Boolean),
          session_at: `${session.date} at ${session.time}`,
        })
      }
    }
  }

  // ─── When the other one of you changes the week ────────────────────────────

  let told = 0

  if (canPush) {
    // A day is plenty: anything older has either been notified or is no longer
    // worth waking a phone for.
    const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
    const { data: planRows } = await db
      .from('plan_meals')
      .select('id, day, slot, updated_at, updated_by, deleted_at')
      .gt('updated_at', since)

    const rows = (planRows ?? []) as PlanRow[]

    for (const member of people) {
      const id = member.id as string
      const preference = await wants(id)
      if (!preference.plan) continue

      const result = planNote(rows, id, preference.seen, now, names)
      if (!result) continue

      const count = await push(id, result.note)
      if (!count) continue

      told += count
      // Moved only after something arrived. A watermark advanced on a failed
      // send loses the change for good, and nobody ever finds out.
      await db.from('notify_state').upsert({
        member_id: id,
        plan_seen_at: result.watermark,
        updated_at: now.toISOString(),
      }, { onConflict: 'member_id' })
    }
  }

  return Response.json({
    checked: sessions.length,
    pushed,
    told,
    pushing: canPush,
  })
})
