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
import { connectHousehold, useHousehold } from './useHousehold'
import { connectArchive, useArchive } from './useArchive'

connectHousehold(supabase, isConfigured)
connectArchive(supabase, isConfigured)

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
    // Other people's names and roles: not something to leave on a device
    // nobody is signed in to. Nor the dietician's plans, which are the most
    // private thing the app holds.
    useHousehold.getState().clear()
    await useArchive.getState().clear()
  },

  setDisplayName: async (name) => {
    const user = get().user
    if (!supabase || !user) return false
    // Through a function, because the name lives in two places, the account's
    // own row and its household membership, and only the database may write
    // the second.
    const { error } = await supabase.rpc('set_display_name', { name })
    if (error) return false
    // Optimistic, so the field keeps the name even if the reload is slow or the
    // row comes back filtered by a policy.
    set({ members: get().members.map((m) => (m.id === user.id ? { ...m, display_name: name } : m)) })
    await get().refreshMembers()
    await useHousehold.getState().load(user.id)
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
 * Announce this user, then find their household.
 *
 * The members row is a note of who has signed in and when; it grants nothing.
 * What decides access is `household_members`, which `useHousehold.load` reads,
 * accepting a waiting invite on the way if there is one (or, during the
 * transition, joining the original household if this email is on the old
 * guest list). An account that ends up in no household is shown the screen
 * to start one, not an error.
 */
async function recordPresence(user: User) {
  if (!supabase) return
  // Best effort: nothing depends on it, and a refusal here says nothing about
  // whether this account can read or write the household's data.
  await supabase.from('members').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false },
  )

  await useHousehold.getState().load(user.id)
  await useAuthStore.getState().refreshMembers()

  const after = useHousehold.getState()
  if (after.status === 'error' && !after.household) {
    // Not in a household, and the database would not say why. Every policy
    // consults membership, so this account can read and write nothing, which
    // from the inside looks exactly like an app that has stopped saving.
    // Saying so, with the server's own words, is the only useful thing left.
    useAuthStore.setState({
      error: 'Signed in, but the household could not be loaded, so nothing can be saved yet. '
        + `The database said: ${after.error ?? 'nothing'}`,
    })
  }
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
    // Signed out, here or anywhere else (another tab, an expired session):
    // the plans kept on this device go with the session.
    else void useArchive.getState().clear()
  }
  void supabase.auth.getSession().then(({ data }) => apply(data.session))
  supabase.auth.onAuthStateChange((_event, session) => apply(session))
}
