import { describe, it, expect } from 'vitest'
import type { CookSession } from '../types'
import { dueReminders, reminderAt, sessionStart } from './cookReminder'

const session = (over: Partial<CookSession> = {}): CookSession => ({
  id: 's1', date: '2026-08-20', time: '18:00', recipeIds: [], label: 'Batch cook',
  completed: false, ...over,
})

describe('working out when to send it', () => {
  it('is a quarter of an hour before the session', () => {
    const now = new Date('2026-08-20T10:00:00')
    const at = reminderAt('2026-08-20', '18:00', now)
    expect(at).toBe(new Date('2026-08-20T17:45:00').toISOString())
  })

  it('says nothing for a session that has already been', () => {
    // Correcting last Tuesday's entry should not send an email about it.
    const now = new Date('2026-08-20T19:00:00')
    expect(reminderAt('2026-08-20', '18:00', now)).toBeUndefined()
  })

  it('refuses a time it cannot read', () => {
    expect(reminderAt('nonsense', 'nonsense')).toBeUndefined()
  })
})

describe('which sessions are due', () => {
  const remindAt = new Date('2026-08-20T17:45:00').toISOString()

  it('picks one whose moment has arrived', () => {
    const found = dueReminders([session({ remindAt })], new Date('2026-08-20T17:46:00'))
    expect(found).toHaveLength(1)
  })

  it('leaves one whose moment has not', () => {
    expect(dueReminders([session({ remindAt })], new Date('2026-08-20T17:30:00'))).toEqual([])
  })

  it('does not send a flurry after a job has been down all day', () => {
    // The session started an hour ago. An email now is noise about something
    // that either happened or did not.
    expect(dueReminders([session({ remindAt })], new Date('2026-08-20T19:00:00'))).toEqual([])
  })

  it('skips a session already marked done, and one with no reminder set', () => {
    const now = new Date('2026-08-20T17:46:00')
    expect(dueReminders([session({ remindAt, completed: true })], now)).toEqual([])
    expect(dueReminders([session()], now)).toEqual([])
  })
})

describe('the session start itself', () => {
  it('is read in the timezone of whoever typed it', () => {
    const start = sessionStart('2026-08-20', '18:00')
    expect(start.getHours()).toBe(18)
  })
})
