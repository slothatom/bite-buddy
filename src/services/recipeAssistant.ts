import { supabase } from '../lib/supabase'
import type { Food } from '../types'
import { DISH_CATEGORIES, QUICK_FILTERS } from '../lib/dishCategories'
import { readDraft, type RecipeDraft } from '../lib/recipeDraft'

/**
 * Asking the assistant to read a paste.
 *
 * The key it needs never comes near this file. It lives as a secret on a
 * Supabase Edge Function, which checks that whoever is calling is in the
 * household before it spends anything, so a public site can offer this without
 * publishing a key anyone could read and run up a bill on.
 *
 * Everything here is failure-first, because this is the one part of the app
 * that depends on somebody else's server being up and in a good mood. Offline,
 * unconfigured, refused, slow, malformed: each has its own answer, and none of
 * them lose what you typed.
 */

export type DraftResult =
  | { ok: true; draft: RecipeDraft }
  | { ok: false; error: string }

const TIMEOUT_MS = 60_000

export async function draftFromText(text: string, foods: Food[]): Promise<DraftResult> {
  if (!supabase) {
    return {
      ok: false,
      error: 'This copy runs on its own, with no account, so the assistant is not available.',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { data, error } = await supabase.functions.invoke('recipe-assistant', {
      body: {
        text,
        // Ids and names only. The database goes up so ingredients can be matched
        // to real foods; nothing about what you eat or when does.
        foods: foods.map((f) => ({ id: f.id, name: f.names.en })),
        categories: DISH_CATEGORIES,
        quickFilters: QUICK_FILTERS,
      },
    })

    if (error) return { ok: false, error: await readError(error) }

    const draft = readDraft((data as { draft?: unknown })?.draft)
    if (!draft) {
      return {
        ok: false,
        error: (data as { error?: string })?.error
          ?? 'That came back in a shape this app could not read. Nothing has changed.',
      }
    }

    return { ok: true, draft }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { ok: false, error: 'That took too long. Your text is still here, try again.' }
    }
    return { ok: false, error: `Could not reach the assistant: ${(e as Error).message}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The server's own words, where they are useful.
 *
 * Supabase does not hand back the function's reply on a failure. It throws, and
 * puts the whole `Response` on `error.context`, body unread. Reaching for
 * `context.error` finds nothing and leaves you showing "Edge Function returned
 * a non-2xx status code", which tells somebody standing in their kitchen
 * precisely nothing. The body has to be read, and reading it is asynchronous.
 *
 * A clone is read rather than the response itself, so that a body can only be
 * consumed once here and never at the cost of a caller who wants it later.
 */
async function readError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context

  // The old shape, kept because a mock or a wrapper may still use it.
  const plain = (context as { error?: unknown } | undefined)?.error
  if (typeof plain === 'string' && plain) return plain

  const response = context as Response | undefined
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json() as { error?: unknown; message?: unknown }
      const said = body?.error ?? body?.message
      if (typeof said === 'string' && said) return said
    } catch {
      // Not JSON. The status still says something useful.
    }

    if (response.status === 404) {
      return 'The assistant is not deployed on this project yet. See docs/DEPLOY.md.'
    }
    if (response.status === 401) {
      return 'That session has expired. Sign in again and your text will still be here.'
    }
    // Anything else, including a gateway that answered in HTML. The status is
    // the only fact available, so say that much and stop pretending otherwise.
    return `The assistant answered with an error (${response.status}). Your text is still here.`
  }

  const message = (error as Error).message ?? ''
  if (message.includes('Failed to send')) {
    return 'Could not reach the assistant. Either you are offline, or it is not deployed yet.'
  }
  return message || 'The assistant could not be reached.'
}
