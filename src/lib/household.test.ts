import { describe, it, expect } from 'vitest'
import {
  canChange, isNoInvite, memberName, membersToPeople, resolvePerson, roleAtLeast, toInvite, toMember,
  type HouseholdMember, type MemberRow,
} from './household'

/**
 * From database rows to the people on screen.
 *
 * The one property that matters most: a member's person key is the id their
 * rows already use, so the two people who were hardcoded before are still the
 * owners of everything they logged.
 */

const row = (over: Partial<MemberRow> = {}): MemberRow => ({
  household_id: 'h1',
  user_id: 'u1',
  role: 'admin',
  person_key: 'arany',
  display_name: 'Arany',
  email: 'arany@example.com',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})

const member = (over: Partial<HouseholdMember> = {}): HouseholdMember => ({
  userId: 'u1', role: 'editor', personKey: 'p', displayName: null, email: null, createdAt: '', ...over,
})

describe('toMember', () => {
  it('maps a row, keeping the person key as it is', () => {
    expect(toMember(row())).toEqual({
      userId: 'u1', role: 'admin', personKey: 'arany', displayName: 'Arany',
      email: 'arany@example.com', createdAt: '2026-08-01T00:00:00Z',
    })
  })

  it('refuses a row with a role this app does not know', () => {
    // Treating an unknown role as anything at all would be guessing about
    // permissions, and the screen would offer controls the database refuses.
    expect(toMember(row({ role: 'owner' }))).toBeNull()
    expect(toMember(row({ person_key: '' }))).toBeNull()
  })

  it('treats a blank name as no name', () => {
    expect(toMember(row({ display_name: '   ' }))?.displayName).toBeNull()
  })
})

describe('membersToPeople', () => {
  it('keys each person by their person key, so existing rows keep their owner', () => {
    const people = membersToPeople([
      toMember(row())!,
      toMember(row({ user_id: 'u2', person_key: 'oli', display_name: 'Oli', created_at: '2026-08-02T00:00:00Z' }))!,
    ])
    expect(people).toEqual([{ id: 'arany', name: 'Arany' }, { id: 'oli', name: 'Oli' }])
  })

  it('is oldest first whatever order the rows came in', () => {
    const people = membersToPeople([
      member({ userId: 'b', personKey: 'b', createdAt: '2026-08-02' }),
      member({ userId: 'a', personKey: 'a', createdAt: '2026-08-01' }),
    ])
    expect(people.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('memberName', () => {
  it('prefers the chosen name, then the email, then the key', () => {
    expect(memberName({ displayName: 'Ana', email: 'x@y.z', personKey: 'k' })).toBe('Ana')
    expect(memberName({ displayName: null, email: 'jane.doe@example.com', personKey: 'k' })).toBe('Jane')
    expect(memberName({ displayName: null, email: null, personKey: 'oli' })).toBe('Oli')
  })
})

describe('resolvePerson', () => {
  const people = [{ id: 'arany', name: 'Arany' }, { id: 'oli', name: 'Oli' }]

  it('keeps a choice that still names somebody', () => {
    expect(resolvePerson(people, 'oli', 'arany')).toBe('oli')
  })

  it('falls back to the signed-in person, then to whoever is first', () => {
    // A per-device choice outlives the person it named, and a fresh install
    // has none; neither should leave a screen showing nobody's history.
    expect(resolvePerson(people, 'gone', 'oli')).toBe('oli')
    expect(resolvePerson(people, '', undefined)).toBe('arany')
    expect(resolvePerson([], 'oli')).toBeUndefined()
  })
})

describe('roles', () => {
  it('ranks viewer below editor below admin', () => {
    expect(roleAtLeast('admin', 'editor')).toBe(true)
    expect(roleAtLeast('editor', 'editor')).toBe(true)
    expect(roleAtLeast('viewer', 'editor')).toBe(false)
    expect(roleAtLeast(null, 'viewer')).toBe(false)
  })

  it('offers admins every control except removing or demoting the last admin', () => {
    const solo = member({ userId: 'a', role: 'admin' })
    const editor = member({ userId: 'e', role: 'editor' })
    expect(canChange([solo, editor], solo, 'admin')).toEqual({ role: false, remove: false })
    expect(canChange([solo, editor], editor, 'admin')).toEqual({ role: true, remove: true })
    expect(canChange([solo, editor], editor, 'editor')).toEqual({ role: false, remove: false })

    const second = member({ userId: 'b', role: 'admin' })
    expect(canChange([solo, second], solo, 'admin')).toEqual({ role: true, remove: true })
  })
})

describe('invites', () => {
  it('maps a pending invite and refuses an unknown role', () => {
    expect(toInvite({ id: 'i1', email: 'a@b.c', role: 'viewer', created_at: 't' }))
      .toEqual({ id: 'i1', email: 'a@b.c', role: 'viewer', createdAt: 't' })
    expect(toInvite({ id: 'i1', email: 'a@b.c', role: 'boss', created_at: 't' })).toBeNull()
  })

  it('tells "nobody invited you" apart from a real failure', () => {
    expect(isNoInvite({ code: 'P0002' })).toBe(true)
    expect(isNoInvite({ code: '42501' })).toBe(false)
    expect(isNoInvite(null)).toBe(false)
  })
})
