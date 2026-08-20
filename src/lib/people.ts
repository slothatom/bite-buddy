/**
 * The two people this app is for.
 *
 * Weight, measurements, sleep and exercise are personal, so every one of those
 * rows has to say whose it is. The obvious identifier is the signed-in account
 * id, and it was the wrong one: it only exists once you have signed in, it is
 * different on each device until then, and it left the screen showing a single
 * unnamed history to whoever happened to be holding the phone.
 *
 * These ids are fixed and shared instead. Both phones agree on them, they work
 * signed out, and both people are on screen whether or not either has signed
 * in, which is what a household of two actually looks like.
 *
 * Names are here rather than in a store because they do not change. If a third
 * person ever eats here, this is the list to add them to.
 */
export type PersonId = 'arany' | 'oli'

export interface Person {
  id: PersonId
  name: string
}

export const PEOPLE: readonly Person[] = [
  { id: 'arany', name: 'Arany' },
  { id: 'oli', name: 'Oli' },
]

const IDS = new Set<string>(PEOPLE.map((p) => p.id))

/**
 * Whether a stored id still means somebody.
 *
 * Entries logged before this existed carry either nothing or an account id
 * from whichever session wrote them. Neither names a person any more, so both
 * count as unclaimed and the screen offers them back rather than hiding them.
 */
export function isPersonId(id: string | undefined): id is PersonId {
  return id != null && IDS.has(id)
}

export function personName(id: string | undefined): string {
  return PEOPLE.find((p) => p.id === id)?.name ?? 'Someone'
}
