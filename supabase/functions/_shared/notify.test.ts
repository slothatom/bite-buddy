import { describe, expect, it } from 'vitest'
import {
  dueSessions, cookNote, planNote, SETTLE_MINUTES,
  type CookSession, type PlanRow,
} from './notify'

/**
 * The half of a notification system that can be wrong on purpose.
 *
 * Encryption and delivery belong to a library and to Google. What is ours, and
 * what actually decides whether people keep this switched on, is which
 * notifications get sent at all.
 */

const NOW = new Date('2026-08-22T18:00:00Z')
const ME = 'member-arany'
const THEM = 'member-oli'

function session(over: Partial<CookSession> = {}): CookSession {
  return {
    id: 'cook-1', date: '2026-08-22', time: '18:15', label: 'Sunday batch',
    recipeIds: ['r1', 'r2'], completed: false,
    remindAt: '2026-08-22T18:00:00Z',
    ...over,
  }
}

function row(over: Partial<PlanRow> = {}): PlanRow {
  return {
    id: 'meal-1', day: '2026-08-25', slot: 'dinner',
    updated_at: '2026-08-22T17:30:00Z', updated_by: THEM, deleted_at: null,
    ...over,
  }
}

describe('reminding you to cook', () => {
  it('sends at the reminder time', () => {
    expect(dueSessions([session()], NOW)).toHaveLength(1)
  })

  it('says nothing before it', () => {
    expect(dueSessions([session({ remindAt: '2026-08-22T19:00:00Z' })], NOW)).toHaveLength(0)
  })

  it('gives up rather than reminding you about lunch at teatime', () => {
    // The job was down all morning. A reminder two hours late is not a
    // reminder, it is a puzzle.
    expect(dueSessions([session({ remindAt: '2026-08-22T15:00:00Z' })], NOW)).toHaveLength(0)
  })

  it('leaves a session you have already cooked alone', () => {
    expect(dueSessions([session({ completed: true })], NOW)).toHaveLength(0)
  })

  it('leaves one with no reminder set alone', () => {
    expect(dueSessions([session({ remindAt: undefined })], NOW)).toHaveLength(0)
  })

  it('counts the dishes, and copes when there are none', () => {
    expect(cookNote(session()).body).toContain('2 dishes')
    expect(cookNote(session({ recipeIds: [] })).body).not.toContain('dish')
  })
})

describe('telling you the week changed', () => {
  const OLD = '2026-08-22T12:00:00Z'

  it('says who, what and how many days', () => {
    const result = planNote(
      [row(), row({ id: 'meal-2', day: '2026-08-26' })],
      ME, OLD, NOW, new Map([[THEM, 'Oli']]),
    )

    expect(result?.note.title).toBe('Oli changed the week')
    expect(result?.note.body).toBe('2 meals planned across 2 days.')
  })

  it('never tells you about your own edits', () => {
    expect(planNote([row({ updated_by: ME })], ME, OLD, NOW)).toBeNull()
  })

  it('waits until they have stopped typing', () => {
    // An edit thirty seconds ago means they are still at it. Thirty
    // notifications while somebody plans a week is an uninstall.
    const justNow = new Date(NOW.getTime() - 30_000).toISOString()
    expect(planNote([row({ updated_at: justNow })], ME, OLD, NOW)).toBeNull()
  })

  it('holds the whole burst back while any of it is still warm', () => {
    const settled = new Date(NOW.getTime() - (SETTLE_MINUTES + 5) * 60_000).toISOString()
    const warm = new Date(NOW.getTime() - 60_000).toISOString()

    const result = planNote(
      [row({ updated_at: settled }), row({ id: 'meal-2', updated_at: warm })],
      ME, OLD, NOW,
    )

    // Not "1 meal planned" now and another line in ten minutes. One line.
    expect(result).toBeNull()
  })

  it('counts deletions separately, because they read differently', () => {
    const result = planNote(
      [row(), row({ id: 'meal-2', deleted_at: '2026-08-22T17:31:00Z' })],
      ME, OLD, NOW,
    )

    expect(result?.note.body).toContain('1 meal planned')
    expect(result?.note.body).toContain('1 taken off')
  })

  it('says nothing at all when nothing happened, which is most runs', () => {
    expect(planNote([], ME, OLD, NOW)).toBeNull()
  })

  it('never re-sends what it already sent', () => {
    const rows = [row()]
    const first = planNote(rows, ME, OLD, NOW)!

    expect(planNote(rows, ME, first.watermark, NOW)).toBeNull()
  })

  it('falls back to a name it can use when it has none', () => {
    expect(planNote([row()], ME, OLD, NOW)?.note.title).toBe('The other one of you changed the week')
  })
})
