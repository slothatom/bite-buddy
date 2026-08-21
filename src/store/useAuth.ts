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
  /** Null until the first session check finishes, the app waits on this. */
  ready: boolean
  session: Session | null
  user: User | null
  members: Member[]
  error: string | null
  /** Set after a magic link is requested, so the UI can say "check your email". */
  linkSentTo: string | null

  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** Whether the name actually saved, so the button can tell the truth. */
  setDisplayName: (name: string) => Promise<boolean>
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
    if (!supabase || !user) return false
    // .select() matters: a row-level policy that refuses the update does not
    // raise an error, it just changes nothing. Asking for the changed rows back
    // is the only way to tell a save from a silent refusal.
    const { data, error } = await supabase
      .from('members').update({ display_name: name }).eq('id', user.id).select('id')
    if (error || !data?.length) return false
    // Optimistic, so the field keeps the name even if the reload is slow or the
    // row comes back filtered by a policy.
    set({ members: get().members.map((m) => (m.id === user.id ? { ...m, display_name: name } : m)) })
    await get().refreshMembers()
    return true
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
 * signing in is the only thing that puts someone on the members list, an
 * account that exists but has never been used does not appear.
 */
async function recordPresence(user: User) {
  if (!supabase) return
  const { error } = await supabase.from('members').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false },
  )

  if (!error) {
    await useAuthStore.getState().refreshMembers()
    return
  }

  // The write failing does not necessarily mean anything is wrong. The database
  // adds an account to the household the moment it is created, so this row
  // usually exists already and all that was refused is a note of when you were
  // last here, which nothing depends on.
  //
  // What matters is the answer to one question, so ask it rather than guessing.
  const { data } = await supabase.from('members').select('id').eq('id', user.id).maybeSingle()
  if (data) {
    await useAuthStore.getState().refreshMembers()
    return
  }

  // Not a member, and writing the row directly was refused. There is one more
  // way in, and it exists precisely for this: a function that runs as its owner
  // and so answers to none of the policies that might be wrong. It can add one
  // row, yours.
  const { error: joinError } = await supabase.rpc('join_household')
  if (!joinError) {
    await useAuthStore.getState().refreshMembers()
    return
  }

  // Not a member, and the app cannot make itself one. Every policy in the
  // database consults membership, so this account can read and write nothing,
  // which from the inside looks exactly like an app that has stopped saving.
  // Saying so, with the server's own words, is the only useful thing left.
  useAuthStore.setState({
    error: 'Signed in, but this account is not in the household, so nothing can be saved. '
      + `Run supabase/fix-membership.sql in the Supabase SQL editor. The database said: ${joinError.message}`,
  })
}

if (supabase) {
  const apply = (session: Session | null) => {
    useAuthStore.setState({ session, user: session?.user ?? null, ready: true })
    // Deliberately not awaited inside the callback, and deliberately deferred:
    // Supabase warns that calling back into the client from inside an auth
    // event can deadlock, and a request made before the session has finished
    // being stored goes out without a token, which the database sees as nobody
    // at all.
    if (session?.user) setTimeout(() => void recordPresence(session.user), 0)
  }
  void supabase.auth.getSession().then(({ data }) => apply(data.session))
  supabase.auth.onAuthStateChange((_event, session) => apply(session))
}
