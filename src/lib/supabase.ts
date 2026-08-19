/**
 * The Supabase connection, and the decision of whether there is one at all.
 *
 * The app has to work in two modes and must not pretend otherwise:
 *
 *  - **Configured.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at
 *    build time, so the deployed site asks you to sign in and syncs the shared
 *    household data between the two of you.
 *  - **Not configured.** A local clone, the one-file build, or the test suite.
 *    No login, no network, everything in localStorage exactly as before.
 *
 * `isConfigured` is what every caller branches on. Nothing else should reach
 * for the environment variables directly, so there is one place where the two
 * modes are decided.
 *
 * The anon key is public by design — it ships in the bundle and anyone can read
 * it. It grants nothing on its own: every table is protected by row-level
 * security that requires an authenticated session belonging to a household
 * member. See `supabase/schema.sql`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE returns the magic link's code as a query parameter. The default
        // implicit flow puts tokens in the hash, which this app uses for
        // routing — the router would try to render "#access_token=..." as a
        // route before Supabase had a chance to strip it.
        flowType: 'pkce',
      },
    })
  : null

/** Where the magic link should land. Works from any base path or port. */
export function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}
