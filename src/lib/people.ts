/**
 * The people this app is for.
 *
 * Weight, measurements, sleep and exercise are personal, so every one of those
 * rows has to say whose it is. The obvious identifier is the signed-in account
 * id, and it was the wrong one: it only exists once you have signed in, it is
 * different on each device until then, and it left the screen showing a single
 * unnamed history to whoever happened to be holding the phone.
 *
 * So rows carry a person key instead: a short, stable id per person, shared by
 * every device. It used to be a hardcoded list of two. It is data now, one
 * `person_key` per row in `household_members`, and the two original people
 * were backfilled with the ids they always had, so nothing logged before
 * changed owner. See lib/household.ts and store/useHousehold.ts.
 */
export type PersonId = string

export interface Person {
  id: PersonId
  name: string
}

/**
 * Who is here when there is no household to ask: a copy running on its own,
 * without Supabase. One person, one history.
 */
export const LOCAL_PEOPLE: readonly Person[] = [{ id: 'me', name: 'Me' }]

/**
 * Whether a stored id still means somebody.
 *
 * Entries logged before people existed carry either nothing or an account id
 * from whichever session wrote them. Neither names a person, so both count as
 * unclaimed and the screen offers them back rather than hiding them.
 */
export function isPersonIn(people: readonly Person[], id: string | undefined): boolean {
  return id != null && people.some((p) => p.id === id)
}

export function personName(people: readonly Person[], id: string | undefined): string {
  return people.find((p) => p.id === id)?.name ?? 'Someone'
}
