/**
 * Who is signed in.
 *
 * Deliberately not persisted by this app: Supabase owns the session and
 * refreshes it, so a second copy here could only ever go stale and disagree.
 * When Supabase is not configured the store settles immediately into a signed
 * -out, not-required state and nothing else in the app changes behaviour.
 */
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { isConfigured, redirectUrl, supabase } from '../lib/supabase'

export interface Member {
  id: string
  email: string
  display_name: string | null
  last_seen_at: string
}

interface AuthStore {
  /** Null until the first session check finishes — the app waits on this. */
  ready: boolean
  session: Session | null
  user: User | null
  members: Member[]
  error: string | null
  /** Set after a magic link is requested, so the UI can say "check your email". */
  linkSentTo: string | null

  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
  setDisplayName: (name: string) => Promise<void>
  refreshMembers: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  ready: !isConfigured,
  session: null,
  user: null,
  members: [],
  error: null,
  linkSentTo: null,

  signIn: async (email) => {
    if (!supabase) return
    set({ error: null })
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl() },
    })
    // Supabase deliberately does not reveal whether an address exists, so a
    // rejected guest sees the same "check your email" as a real one. Saying so
    // is better than implying the link is on its way to anyone who asks.
    if (error) set({ error: error.message })
    else set({ linkSentTo: email.trim() })
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    set({ session: null, user: null, members: [], linkSentTo: null })
  },

  setDisplayName: async (name) => {
    const user = get().user
    if (!supabase || !user) return
    await supabase.from('members').update({ display_name: name }).eq('id', user.id)
    await get().refreshMembers()
  },

  refreshMembers: async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('members')
      .select('id, email, display_name, last_seen_at')
      .order('created_at')
    if (data) set({ members: data as Member[] })
  },
}))

/**
 * Announce this user to the household.
 *
 * The row is created on first sign-in rather than by a database trigger, so
 * signing in is the only thing that puts someone on the members list — an
 * account that exists but has never been used does not appear.
 */
async function recordPresence(user: User) {
  if (!supabase) return
  await supabase.from('members').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false },
  )
  await useAuthStore.getState().refreshMembers()
}

if (supabase) {
  const apply = (session: Session | null) => {
    useAuthStore.setState({ session, user: session?.user ?? null, ready: true })
    if (session?.user) void recordPresence(session.user)
  }
  void supabase.auth.getSession().then(({ data }) => apply(data.session))
  supabase.auth.onAuthStateChange((_event, session) => apply(session))
}
