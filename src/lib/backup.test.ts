import { describe, it, expect, beforeEach } from 'vitest'
import { applyBackup, createBackup, inspectBackup, backupFilename } from './backup'
import { useUserStore } from '../store/useUserStore'
import { useBodyStore } from '../store/useBodyStore'
import { SCHEMA_VERSION } from '../store/persist'

/**
 * A backup is the only copy of your data that outlives the browser, so the
 * failure that matters is a restore that half-works: it looks successful and
 * quietly leaves the app holding a mixture of old and new state.
 */

describe('createBackup', () => {
  it('captures every persisted store', () => {
    const backup = createBackup()
    expect(backup.app).toBe('bite-buddy')
    expect(backup.schema).toBe(SCHEMA_VERSION)
    expect(Object.keys(backup.stores).sort()).toEqual([
      'bite-buddy-activity',
      'bite-buddy-body',
      'bite-buddy-cook',
      'bite-buddy-foods-v2',
      'bite-buddy-mealplan-v2',
      'bite-buddy-pantry',
      'bite-buddy-portions',
      'bite-buddy-recipes-v2',
      'bite-buddy-user-v2',
    ])
  })

  it('honours each store\'s partialize', () => {
    // The user store persists only the profile; its actions must not appear.
    const user = createBackup().stores['bite-buddy-user-v2'] as Record<string, unknown>
    expect(Object.keys(user)).toEqual(['profile'])
  })

  it('is JSON-serialisable, with no functions left in it', () => {
    const text = JSON.stringify(createBackup())
    expect(text).not.toContain('function')
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('names the file by date', () => {
    expect(backupFilename(new Date('2026-08-17T09:30:00Z'))).toBe('bite-buddy-backup-2026-08-17.json')
  })
})

describe('bringing one back', () => {
  beforeEach(() => {
    useUserStore.getState().setName('Original')
    useBodyStore.setState({ weightEntries: [] })
  })

  /** Reading and applying in one go, which is what a confirmed restore is. */
  function restore(text: string) {
    const read = inspectBackup(text)
    if (read.ok) applyBackup(read.plan)
    return read
  }

  it('round-trips real changes', () => {
    useUserStore.getState().setName('Ana')
    useBodyStore.getState().addWeightEntry({ id: '1', date: '2026-08-17', weight: 68.4, unit: 'kg' })
    const saved = JSON.stringify(createBackup())

    // Lose it all, the way clearing browser data would.
    useUserStore.getState().setName('Gone')
    useBodyStore.setState({ weightEntries: [] })

    expect(restore(saved).ok).toBe(true)
    expect(useUserStore.getState().profile.name).toBe('Ana')
    expect(useBodyStore.getState().weightEntries).toHaveLength(1)
    expect(useBodyStore.getState().weightEntries[0].weight).toBe(68.4)
  })

  it('leaves the actions intact, so the app still works afterwards', () => {
    expect(restore(JSON.stringify(createBackup())).ok).toBe(true)
    expect(() => useUserStore.getState().setName('Still callable')).not.toThrow()
    expect(useUserStore.getState().profile.name).toBe('Still callable')
  })

  it('restores a backup from an older version by migrating it', () => {
    // Your existing backups have to keep working across a schema change, or
    // the safety net disappears exactly when a version bump makes it matter.
    const backup = {
      app: 'bite-buddy',
      schema: SCHEMA_VERSION - 1,
      exportedAt: new Date().toISOString(),
      stores: {
        'bite-buddy-mealplan-v2': { plan: [{ date: '2026-08-20', meals: [] }], groceryItems: [] },
        'bite-buddy-body': { weightEntries: [{ id: '9', date: '2026-08-20', weight: 70, unit: 'kg' }] },
      },
    }

    expect(restore(JSON.stringify(backup)).ok).toBe(true)
    expect(useBodyStore.getState().weightEntries).toHaveLength(1)
  })

  it('refuses a backup from a newer version rather than misreading it', () => {
    const backup = { ...createBackup(), schema: SCHEMA_VERSION + 1 }
    useUserStore.getState().setName('Untouched')

    expect(restore(JSON.stringify(backup)).ok).toBe(false)
    expect(useUserStore.getState().profile.name).toBe('Untouched')
  })

  it.each([
    ['not json at all', 'valid JSON'],
    ['{"app":"something-else","schema":1,"stores":{}}', 'not written by Bite Buddy'],
    ['{"app":"bite-buddy","schema":1}', 'no data in it'],
    ['{"app":"bite-buddy","schema":1,"stores":{"unknown-key":{}}}', 'matched this version'],
  ])('rejects %s', (input, expected) => {
    const result = inspectBackup(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(expected)
  })

  it('leaves a name it does not recognise out, and says so', () => {
    const backup = createBackup()
    backup.stores['bite-buddy-from-the-future'] = { something: true }

    const read = inspectBackup(JSON.stringify(backup))
    expect(read.ok).toBe(true)
    if (read.ok) {
      expect(read.plan.unknown).toEqual(['bite-buddy-from-the-future'])
      expect(read.plan.replacing).toHaveLength(9)
    }
  })

  it('says what it is about to replace, in words, before touching anything', () => {
    useUserStore.getState().setName('Untouched')
    const read = inspectBackup(JSON.stringify(createBackup()))

    expect(read.ok).toBe(true)
    if (read.ok) {
      expect(read.plan.replacing).toContain('your profile and targets')
      expect(read.plan.exportedAt).toBeTruthy()
    }
    // Reading it is not doing it.
    expect(useUserStore.getState().profile.name).toBe('Untouched')
  })
})

/**
 * The failure that matters is a restore that half-works: it looks successful
 * and quietly leaves the app holding a mixture of old and new state. Three
 * valid sections and seven junk ones must leave everything alone.
 */
describe('a restore cannot half-succeed', () => {
  beforeEach(() => {
    useUserStore.getState().setName('Original')
    useBodyStore.setState({ weightEntries: [] })
  })

  it('refuses the whole file when one section is the wrong shape', () => {
    const backup = createBackup()
    backup.stores['bite-buddy-body'] = { weightEntries: 'not a list at all' }

    const read = inspectBackup(JSON.stringify(backup))
    expect(read.ok).toBe(false)
    if (!read.ok) {
      expect(read.error).toContain('your weights and measurements')
      expect(read.error).toContain('nothing has been changed')
    }
    expect(useUserStore.getState().profile.name).toBe('Original')
  })

  it('refuses a section carrying a key this version knows nothing about', () => {
    const backup = createBackup()
    backup.stores['bite-buddy-user-v2'] = { profile: {}, secretlyFromAnotherApp: [] }

    const read = inspectBackup(JSON.stringify(backup))
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.error).toContain('secretlyFromAnotherApp')
  })

  it('writes nothing at all when a later section is bad', () => {
    // The old loop wrote as it validated, so a good user store went in and a
    // bad body store then stopped the run, leaving the app half restored.
    useUserStore.getState().setName('Before')
    const backup = createBackup()
    backup.stores['bite-buddy-user-v2'] = { profile: { name: 'After' } }
    backup.stores['bite-buddy-portions'] = { portions: 42 }

    const read = inspectBackup(JSON.stringify(backup))
    expect(read.ok).toBe(false)
    expect(useUserStore.getState().profile.name).toBe('Before')
  })

  it('accepts a section missing a field this version added', () => {
    // An honest old backup, not a bad one. The store merges over its defaults.
    const backup = createBackup()
    backup.stores['bite-buddy-body'] = {}

    expect(inspectBackup(JSON.stringify(backup)).ok).toBe(true)
  })

  it('hands back the copy it replaced, so the restore can be undone', () => {
    useUserStore.getState().setName('Before the restore')
    const other = JSON.parse(JSON.stringify(createBackup())) as ReturnType<typeof createBackup>
    ;(other.stores['bite-buddy-user-v2'] as { profile: { name: string } }).profile.name = 'From the file'

    const read = inspectBackup(JSON.stringify(other))
    expect(read.ok).toBe(true)
    if (!read.ok) return

    const snapshot = applyBackup(read.plan)
    expect(useUserStore.getState().profile.name).toBe('From the file')

    const back = inspectBackup(JSON.stringify(snapshot))
    expect(back.ok).toBe(true)
    if (back.ok) applyBackup(back.plan)
    expect(useUserStore.getState().profile.name).toBe('Before the restore')
  })
})
