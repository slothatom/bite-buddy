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

    if (error) return { ok: false, error: readError(error) }

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
 * Supabase wraps a function's response, so the message worth reading is often
 * inside rather than on the surface. "This account is not in the household" is
 * worth showing; "FunctionsHttpError" is not.
 */
function readError(error: unknown): string {
  const context = (error as { context?: { error?: string } }).context
  if (context?.error) return context.error

  const message = (error as Error).message ?? ''
  if (message.includes('Failed to send')) {
    return 'The assistant is not set up on this project yet. See docs/DEPLOY.md.'
  }
  return message || 'The assistant could not be reached.'
}
