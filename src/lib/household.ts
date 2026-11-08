import type { Person } from './people'

/**
 * A household, as the database describes it, and the people in it as the app
 * needs them.
 *
 * Pure on purpose: the store around it talks to Supabase, and this decides what
 * the answers mean, so it can be tested without either.
 *
 * Roles follow rebelMerch's model without the pending state: an account with
 * no household simply has no row here, and becomes a member by accepting an
 * invite or by starting a household of its own. Enforced by row-level security
 * in the database (supabase/migrations/20261109000100_households), so what this
 * file says about who can do what is a courtesy to the screen, never the guard.
 */

export type Role = 'admin' | 'editor' | 'viewer'

export const ROLES: readonly Role[] = ['admin', 'editor', 'viewer']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export const ROLE_HINTS: Record<Role, string> = {
  admin: 'Can change everything, and invite or remove people.',
  editor: 'Can plan, cook, shop and log.',
  viewer: 'Can see everything, change nothing.',
}

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 }

export function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'editor' || value === 'viewer'
}

/** Whether `role` is at least `min`. No role is below every role. */
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  return role != null && RANK[role] >= RANK[min]
}

export interface Household {
  id: string
  name: string
}

export interface HouseholdMember {
  userId: string
  role: Role
  /** The id the app's own rows use for this person, e.g. `memberId` on a weight. */
  personKey: string
  displayName: string | null
  email: string | null
  createdAt: string
}

export interface HouseholdInvite {
  id: string
  email: string
  role: Role
  createdAt: string
}

/** A `household_members` row, as PostgREST returns it. */
export interface MemberRow {
  household_id: string
  user_id: string
  role: string
  person_key: string
  display_name: string | null
  email: string | null
  created_at: string
}

export interface InviteRow {
  id: string
  email: string
  role: string
  created_at: string
}

/** A row the database sent, or null if it is not one this app understands. */
export function toMember(row: MemberRow): HouseholdMember | null {
  if (!row?.user_id || !row.person_key || !isRole(row.role)) return null
  return {
    userId: row.user_id,
    role: row.role,
    personKey: row.person_key,
    displayName: row.display_name?.trim() || null,
    email: row.email ?? null,
    createdAt: row.created_at ?? '',
  }
}

export function toInvite(row: InviteRow): HouseholdInvite | null {
  if (!row?.id || !row.email || !isRole(row.role)) return null
  return { id: row.id, email: row.email, role: row.role, createdAt: row.created_at ?? '' }
}

/** Oldest first, so the order on screen does not shuffle between loads. */
export function sortMembers(members: readonly HouseholdMember[]): HouseholdMember[] {
  return [...members].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.personKey.localeCompare(b.personKey))
}

function capitalise(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word
}

/**
 * What to call somebody: the name they chose, else the first part of their
 * email, else their person key. Never empty and never a raw address.
 */
export function memberName(member: Pick<HouseholdMember, 'displayName' | 'email' | 'personKey'>): string {
  if (member.displayName?.trim()) return member.displayName.trim()
  const local = member.email?.split('@')[0]?.split(/[^A-Za-z0-9]/)[0]
  if (local) return capitalise(local)
  return capitalise(member.personKey)
}

/**
 * The people the screens show, one per member, keyed by person key.
 *
 * The key is what keeps existing rows attached to the right person: the two
 * original members were backfilled with the ids that used to be hardcoded, so a
 * weight logged as 'oli' a year ago is still Oli's.
 */
export function membersToPeople(members: readonly HouseholdMember[]): Person[] {
  return sortMembers(members).map((m) => ({ id: m.personKey, name: memberName(m) }))
}

/**
 * A person id that means somebody, given the one asked for.
 *
 * `wanted` survives across sessions (it is persisted per device) and so can
 * name someone who has since left, or nobody at all on a fresh install. Falls
 * back to `own`, the signed-in person, then to whoever is first.
 */
export function resolvePerson(
  people: readonly Person[],
  wanted: string | null | undefined,
  own?: string | null,
): string | undefined {
  if (wanted && people.some((p) => p.id === wanted)) return wanted
  if (own && people.some((p) => p.id === own)) return own
  return people[0]?.id
}

/**
 * Whether a refusal from `accept_invite` means "nobody has invited you".
 *
 * The function raises `no_data_found` (P0002) for exactly that, so the app can
 * offer to start a household instead of reporting an error. Everything else is
 * a real failure, and is shown as one.
 */
export function isNoInvite(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === 'P0002'
}

/**
 * Whether the admin controls should offer to change this member.
 *
 * The database has the final word (it refuses to leave a household without an
 * admin), but offering a button that can only fail is worse than not offering
 * it.
 */
export function canChange(
  members: readonly HouseholdMember[],
  target: HouseholdMember,
  myRole: Role | null | undefined,
): { role: boolean; remove: boolean } {
  if (!roleAtLeast(myRole, 'admin')) return { role: false, remove: false }
  const admins = members.filter((m) => m.role === 'admin').length
  const lastAdmin = target.role === 'admin' && admins <= 1
  return { role: !lastAdmin, remove: !lastAdmin }
}
