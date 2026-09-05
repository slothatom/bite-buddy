/**
 * Getting a phone to accept being told something.
 *
 * Four separate things have to be true before a notification can arrive, and
 * each fails differently, so each is reported differently rather than as one
 * unhelpful "notifications unavailable":
 *
 *  1. the browser has to support push at all;
 *  2. the household has to have a signing key set up, which is a one-time
 *     piece of setup somebody does in SQL;
 *  3. the person has to grant permission, which is irreversible from inside
 *     the app once refused;
 *  4. the subscription has to be stored somewhere the sender can find it.
 *
 * The subscription belongs to one browser on one phone. It is not synced and
 * must never be: it is the credential for reaching that device, and putting it
 * in the shared tables would hand the other person's phone the ability to
 * notify yours.
 */

import { supabase } from './supabase'

export type PushState =
  /** This browser cannot do it. Nothing to offer. */
  | { kind: 'unsupported' }
  /** Nobody has set a signing key up yet. */
  | { kind: 'unconfigured' }
  /** Available, and not on. */
  | { kind: 'off' }
  /** On, for this device. */
  | { kind: 'on' }
  /** Refused. The browser will not ask again, and the app cannot make it. */
  | { kind: 'blocked' }

export function supported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

/**
 * The key, base64url as the standard writes it, into the bytes the browser
 * wants. `applicationServerKey` predates the browser accepting a string.
 */
export function decodeKey(base64url: string): Uint8Array {
  const padded = base64url.padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** A key of the wrong shape is worth catching before a browser rejects it. */
export function looksLikeAKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{80,}$/.test(value.trim())
}

/**
 * The subscription's keys, base64 encoded for storage.
 *
 * `getKey` returns raw bytes, and the sender needs them as text. Doing it here
 * rather than in the sender keeps the database column a plain string.
 */
export function encodeKeys(subscription: PushSubscription): { p256dh: string; auth: string } {
  const asText = (name: 'p256dh' | 'auth') => {
    const raw = subscription.getKey(name)
    if (!raw) return ''
    return btoa(String.fromCharCode(...new Uint8Array(raw)))
  }
  return { p256dh: asText('p256dh'), auth: asText('auth') }
}

async function publicKey(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('push_config').select('value').eq('key', 'vapid_public').maybeSingle()
  const value = (data as { value?: string } | null)?.value
  return looksLikeAKey(value) ? value.trim() : null
}

/** Where things stand on this device, right now. */
export async function currentState(): Promise<PushState> {
  if (!supported()) return { kind: 'unsupported' }
  if (Notification.permission === 'denied') return { kind: 'blocked' }
  if (!await publicKey()) return { kind: 'unconfigured' }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  return existing ? { kind: 'on' } : { kind: 'off' }
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Ask, subscribe, and remember where to send.
 *
 * The permission prompt is only ever raised from a real tap. Browsers punish
 * asking on page load by refusing outright, and more to the point, being asked
 * before you have said you want anything is how people learn to hit Block.
 */
export async function enable(label?: string): Promise<EnableResult> {
  if (!supported()) {
    return { ok: false, reason: 'This browser cannot show notifications.' }
  }
  if (!supabase) {
    return { ok: false, reason: 'This copy runs on its own, with no account, so there is nothing to notify about.' }
  }

  const key = await publicKey()
  if (!key) {
    return { ok: false, reason: 'No signing key is set up for this household yet. See the README.' }
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()

  if (permission !== 'granted') {
    return {
      ok: false,
      reason: permission === 'denied'
        ? 'Your browser is set to block notifications for this site. That has to be changed in its settings.'
        : 'Not now, then. Nothing has changed.',
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      // Anything less means a browser may deliver a push without showing
      // anything, and Chrome refuses the subscription outright.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(key) as BufferSource,
    })

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) return { ok: false, reason: 'Sign in first.' }

    const { p256dh, auth } = encodeKeys(subscription)
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      member_id: user.user.id,
      p256dh,
      auth,
      label: label ?? deviceLabel(),
      failed_at: null,
    }, { onConflict: 'endpoint' })

    if (error) {
      // Leaving the browser subscribed to a sender that cannot find it is
      // worse than not being subscribed: nothing arrives and the app says it
      // is on.
      await subscription.unsubscribe()
      return { ok: false, reason: `Could not save this device: ${error.message}` }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, reason: `Could not subscribe: ${(e as Error).message}` }
  }
}

/** Off, for this device only. The other one keeps whatever it had. */
export async function disable(): Promise<void> {
  if (!supported()) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  // The row goes first. A browser unsubscribed from a sender that still holds
  // its endpoint is merely untidy; a row deleted while the browser stays
  // subscribed means the app says off and the phone still buzzes.
  if (supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  }
  await subscription.unsubscribe()
}

/** Something a person can recognise in a list of their own devices. */
export function deviceLabel(agent: string = navigator.userAgent): string {
  if (/android/i.test(agent)) return 'Android phone'
  if (/iphone|ipad/i.test(agent)) return 'iPhone'
  if (/macintosh/i.test(agent)) return 'Mac'
  if (/windows/i.test(agent)) return 'Windows'
  return 'This device'
}

// ─── Which of them you want ───────────────────────────────────────────────────

/**
 * The two things this app will ever send, each on its own switch.
 *
 * The panel had one switch for the whole device while the paragraph above it
 * named two different notifications: a reminder before a cooking session, and
 * a line when the other one of you changes the week. Wanting the first and not
 * the second is an ordinary thing to want, and the only answer available was
 * all or nothing.
 *
 * Per person rather than per device, which is the opposite of the on/off
 * switch above and deliberate. Whether this phone is reachable is a fact about
 * this phone. Whether you care about a cooking reminder is a fact about you,
 * and it should not have to be set again on the tablet. The row lives in
 * `notify_state`, which does not sync, so it is still yours rather than the
 * household's: on the synced profile, turning one off would turn it off for
 * both of you.
 */
export interface Wants {
  cook: boolean
  plan: boolean
}

/** Both on, which is what a member with no row yet already gets from the sender. */
export const WANTS_ALL: Wants = { cook: true, plan: true }

export async function readWants(): Promise<Wants> {
  if (!supabase) return WANTS_ALL
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return WANTS_ALL

  const { data } = await supabase
    .from('notify_state').select('want_cook, want_plan')
    .eq('member_id', user.user.id).maybeSingle()

  // No row is not a refusal. The sender defaults an absent row to both, so
  // reading it as both is the app agreeing with what would actually happen.
  return { cook: data?.want_cook ?? true, plan: data?.want_plan ?? true }
}

/**
 * Writes both, as an upsert, because a member may have no row yet.
 *
 * `plan_seen_at` is deliberately not sent: it is the sender's bookmark for how
 * far through your plan changes it has got, and overwriting it here would
 * either replay a fortnight of notifications or swallow the next one.
 */
export async function writeWants(wants: Wants): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!supabase) return { ok: false, reason: 'This copy runs on its own, with no account.' }
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return { ok: false, reason: 'Sign in first.' }

  const { error } = await supabase.from('notify_state').upsert({
    member_id: user.user.id,
    want_cook: wants.cook,
    want_plan: wants.plan,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'member_id' })

  return error ? { ok: false, reason: error.message } : { ok: true }
}
