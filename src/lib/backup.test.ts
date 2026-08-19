import { describe, it, expect, beforeEach } from 'vitest'
import { createBackup, restoreBackup, backupFilename } from './backup'
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
      'bite-buddy-body',
      'bite-buddy-cook',
      'bite-buddy-foods-v2',
      'bite-buddy-mealplan-v2',
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

describe('restoreBackup', () => {
  beforeEach(() => {
    useUserStore.getState().setName('Original')
    useBodyStore.setState({ weightEntries: [] })
  })

  it('round-trips real changes', () => {
    useUserStore.getState().setName('Ana')
    useBodyStore.getState().addWeightEntry({ id: '1', date: '2026-08-17', weight: 68.4, unit: 'kg' })
    const saved = JSON.stringify(createBackup())

    // Lose it all, the way clearing browser data would.
    useUserStore.getState().setName('Gone')
    useBodyStore.setState({ weightEntries: [] })

    const result = restoreBackup(saved)
    expect(result.ok).toBe(true)
    expect(useUserStore.getState().profile.name).toBe('Ana')
    expect(useBodyStore.getState().weightEntries).toHaveLength(1)
    expect(useBodyStore.getState().weightEntries[0].weight).toBe(68.4)
  })

  it('leaves the actions intact, so the app still works afterwards', () => {
    const result = restoreBackup(JSON.stringify(createBackup()))
    expect(result.ok).toBe(true)
    expect(() => useUserStore.getState().setName('Still callable')).not.toThrow()
    expect(useUserStore.getState().profile.name).toBe('Still callable')
  })

  it('refuses a backup from another schema rather than misreading it', () => {
    const backup = { ...createBackup(), schema: SCHEMA_VERSION + 1 }
    useUserStore.getState().setName('Untouched')

    const result = restoreBackup(JSON.stringify(backup))
    expect(result.ok).toBe(false)
    expect(useUserStore.getState().profile.name).toBe('Untouched')
  })

  it.each([
    ['not json at all', 'valid JSON'],
    ['{"app":"something-else","schema":1,"stores":{}}', 'not written by Bite Buddy'],
    ['{"app":"bite-buddy","schema":1}', 'no data in it'],
    ['{"app":"bite-buddy","schema":1,"stores":{"unknown-key":{}}}', 'matched this version'],
  ])('rejects %s', (input, expected) => {
    const result = restoreBackup(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(expected)
  })

  it('skips keys it does not recognise but restores the ones it does', () => {
    const backup = createBackup()
    backup.stores['bite-buddy-from-the-future'] = { something: true }

    const result = restoreBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.skipped).toEqual(['bite-buddy-from-the-future'])
      expect(result.restored).toHaveLength(6)
    }
  })
})
