/**
 * The household this account belongs to, and the people in it.
 *
 * Persisted, unlike the session: the people are what every per-person screen
 * is built from (whose weight, whose sleep), and a phone opened offline in a
 * shop still needs to know them. The database stays the authority; this is
 * the last answer it gave, refreshed on every sign-in.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './persist'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isNoInvite, membersToPeople, resolvePerson, sortMembers, toInvite, toMember,
  type Household, type HouseholdInvite, type HouseholdMember, type InviteRow, type MemberRow,
  type Role,
} from '../lib/household'
import { LOCAL_PEOPLE, type Person } from '../lib/people'
import { useSyncState } from '../lib/rows/store'

/**
 * Where this account stands.
 *
 *   unknown  not asked yet this session (a cached household may still be shown)
 *   member   in a household
 *   none     signed in, in no household, and nobody has invited it
 *   error    the database refused to say, `error` has its words
 */
export type HouseholdStatus = 'unknown' | 'member' | 'none' | 'error'

/**
 * The client this store talks through, handed in by the auth store rather
 * than imported.
 *
 * Imported, every store that asks "who are the people" (the body store does)
 * would drag the Supabase client in with it, and so would every script and
 * test that touches those stores. Until it is connected the store assumes a
 * deployment that has not finished starting, not a local copy, which is the
 * cautious reading: nothing is treated as belonging to nobody.
 */
let supabase: SupabaseClient | null = null
let isConfigured = true

export function connectHousehold(client: SupabaseClient | null, configured: boolean): void {
  supabase = client
  isConfigured = configured
  useHousehold.setState({ configured })
}

export interface ActionResult {
  ok: boolean
  error?: string
}

interface HouseholdStore {
  /** The account the cached answer belongs to, so a different sign-in starts clean. */
  userId: string | null
  household: Household | null
  members: HouseholdMember[]
  /** Pending invites. Only an admin can see them, so empty for everyone else. */
  invites: HouseholdInvite[]
  status: HouseholdStatus
  error: string | null
  /** Whether this copy talks to a database at all. Not persisted. */
  configured: boolean
  /**
   * The household this device's sync bookkeeping is about. Survives sign-out
   * on purpose: it is a fact about the bookkeeping, not about the person.
   */
  syncedFor: string | null

  /** Asks the database, joining through an invite if there is one waiting. */
  load: (userId: string) => Promise<void>
  create: (name: string) => Promise<ActionResult>
  invite: (email: string, role: Role) => Promise<ActionResult>
  revokeInvite: (id: string) => Promise<ActionResult>
  setRole: (userId: string, role: Role) => Promise<ActionResult>
  remove: (userId: string) => Promise<ActionResult>
  clear: () => void
}

const EMPTY = {
  userId: null,
  household: null,
  members: [] as HouseholdMember[],
  invites: [] as HouseholdInvite[],
  status: 'unknown' as HouseholdStatus,
  error: null,
}


export const useHousehold = create<HouseholdStore>()(
  persist(
    (set, get) => {
      /** One RPC, then a reload, reporting the server's own words on refusal. */
      async function act(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
        const db = supabase
        const userId = get().userId
        if (!db || !userId) return { ok: false, error: 'Sharing is not set up on this device.' }
        const { error } = await db.rpc(fn, args)
        if (error) return { ok: false, error: error.message }
        await get().load(userId)
        return { ok: true }
      }

      return {
        ...EMPTY,
        configured: true,
        syncedFor: null,

        load: async (userId) => {
          const db = supabase
          if (!db) return
          if (get().userId !== userId) set({ ...EMPTY, userId })

          const read = () => db
            .from('household_members')
            .select('household_id, user_id, role, person_key, display_name, email, created_at')
            .order('created_at')

          let { data, error } = await read()
          // Offline, or the server having a bad minute: keep what is cached
          // rather than throwing the people away.
          if (error) {
            set({ status: get().household ? 'member' : 'error', error: error.message })
            return
          }

          let rows = (data ?? []) as MemberRow[]
          if (!rows.some((r) => r.user_id === userId)) {
            // In no household yet. An invite, or the legacy guest list, may be
            // waiting; accepting is idempotent, so asking costs nothing.
            const joined = await db.rpc('accept_invite')
            if (joined.error) {
              if (isNoInvite(joined.error)) {
                set({ ...EMPTY, userId, status: 'none' })
              } else {
                set({ status: 'error', error: joined.error.message })
              }
              return
            }
            ;({ data, error } = await read())
            if (error) { set({ status: 'error', error: error.message }); return }
            rows = (data ?? []) as MemberRow[]
          }

          const mine = rows.find((r) => r.user_id === userId)
          if (!mine) { set({ ...EMPTY, userId, status: 'none' }); return }

          const members = sortMembers(rows
            .filter((r) => r.household_id === mine.household_id)
            .map(toMember)
            .filter((m): m is HouseholdMember => m !== null))

          const { data: home } = await db
            .from('households').select('id, name').eq('id', mine.household_id).maybeSingle()

          let invites: HouseholdInvite[] = []
          if (mine.role === 'admin') {
            const { data: pending } = await db
              .from('household_invites')
              .select('id, email, role, created_at')
              .eq('household_id', mine.household_id)
              .is('accepted_at', null)
              .order('created_at')
            invites = ((pending ?? []) as InviteRow[])
              .map(toInvite)
              .filter((i): i is HouseholdInvite => i !== null)
          }

          // A different household from the one this device last synced with
          // (another account signed in here, or this one moved). What was
          // agreed with the old one says nothing about the new one, and its
          // watermark would skip the new household's older rows for good.
          const synced = get().syncedFor
          if (synced && synced !== mine.household_id) useSyncState.getState().forgetEverything()

          set({
            syncedFor: mine.household_id,
            userId,
            household: { id: mine.household_id, name: (home?.name as string | undefined) ?? 'Household' },
            members,
            invites,
            status: 'member',
            error: null,
          })
        },

        create: async (name) => {
          const db = supabase
          const userId = get().userId
          if (!db || !userId) return { ok: false, error: 'Sharing is not set up on this device.' }
          const { error } = await db.rpc('create_household', { name: name.trim() })
          if (error) return { ok: false, error: error.message }
          await get().load(userId)
          return { ok: true }
        },

        invite: (email, role) => act('invite_member', { email: email.trim(), role }),
        revokeInvite: (id) => act('revoke_invite', { invite_id: id }),
        setRole: (userId, role) => act('set_member_role', { member: userId, role }),
        remove: (userId) => act('remove_member', { member: userId }),

        clear: () => set({ ...EMPTY }),
      }
    },
    {
      name: 'bite-buddy-household',
      version: 1,
      storage: safeStorage<HouseholdStore>(),
      // The status is about this session, and starts unknown each time.
      partialize: (s) => ({
        userId: s.userId, household: s.household, members: s.members, invites: s.invites,
        syncedFor: s.syncedFor,
      }) as HouseholdStore,
    },
  ),
)

/** The signed-in account's own membership, if known. */
export function myMembership(): HouseholdMember | undefined {
  const { members, userId } = useHousehold.getState()
  return members.find((m) => m.userId === userId)
}

/**
 * The people the screens show.
 *
 * The household's members when they are known. Otherwise one person, "Me":
 * a copy that runs on its own (no Supabase, the one-file build) has nobody to
 * ask, and a single history is the honest default for one device.
 */
export function peopleFrom(members: readonly HouseholdMember[]): Person[] {
  return members.length ? membersToPeople(members) : [...LOCAL_PEOPLE]
}

export function currentPeople(): Person[] {
  return peopleFrom(useHousehold.getState().members)
}

/**
 * Whether the people list can be trusted to be complete.
 *
 * A signed-in phone that has never loaded its household falls back to "Me",
 * and every existing key would then look like nobody's. Anything that acts on
 * "this entry belongs to nobody" waits for this.
 */
export function peopleKnown(): boolean {
  return !isConfigured || useHousehold.getState().members.length > 0
}

export function usePeopleKnown(): boolean {
  const any = useHousehold((s) => s.members.length > 0)
  const configured = useHousehold((s) => s.configured)
  return !configured || any
}

export function usePeople(): Person[] {
  const members = useHousehold((s) => s.members)
  return useMemo(() => peopleFrom(members), [members])
}

/** The person key of whoever is signed in here, if they are in a household. */
export function useOwnPersonKey(): string | undefined {
  return useHousehold((s) => s.members.find((m) => m.userId === s.userId)?.personKey)
}

/** The signed-in account's role, or null when it has none. */
export function useMyRole(): Role | null {
  return useHousehold((s) => s.members.find((m) => m.userId === s.userId)?.role ?? null)
}

/**
 * A person id that means somebody: `wanted` if it still does, else the
 * signed-in person, else whoever is first. For per-device choices such as
 * "whose exercise", which can outlive the person they named.
 */
export function useResolvedPerson(wanted?: string | null): string {
  const people = usePeople()
  const own = useOwnPersonKey()
  return resolvePerson(people, wanted, own) ?? LOCAL_PEOPLE[0].id
}
