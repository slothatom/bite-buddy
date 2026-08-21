import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The check a person can run themselves.
 *
 * Its whole value is telling four failures apart, so what is tested is that it
 * does: not signed in, not in the household, a refused write, and a write that
 * is accepted but does not come back.
 */

const state = {
  user: { id: 'u1', email: 'me@example.test' } as { id: string; email: string } | null,
  member: { id: 'u1' } as { id: string } | null,
  memberError: null as { message: string } | null,
  writeError: null as { message: string } | null,
  stored: undefined as { probe?: string } | undefined,
  deleteError: null as { message: string } | null,
}

vi.mock('../supabase', () => ({
  isConfigured: true,
  supabase: {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === 'members'
              ? { data: state.member, error: state.memberError }
              : { data: state.stored ? { data: state.stored } : null, error: null },
        }),
      }),
      upsert: async (row: { deleted_at?: string; data?: { probe?: string } }) => {
        if (row.deleted_at) return { error: state.deleteError }
        if (state.writeError) return { error: state.writeError }
        state.stored = row.data
        return { error: null }
      },
    }),
  },
}))

const { probeSaving } = await import('./probe')

const step = (steps: Awaited<ReturnType<typeof probeSaving>>, what: string) =>
  steps.find((s) => s.what === what)

beforeEach(() => {
  state.user = { id: 'u1', email: 'me@example.test' }
  state.member = { id: 'u1' }
  state.memberError = null
  state.writeError = null
  state.deleteError = null
  state.stored = undefined
})

describe('checking whether saving works', () => {
  it('passes every step when it does', async () => {
    const steps = await probeSaving()
    expect(steps.every((s) => s.ok)).toBe(true)
    expect(steps.map((s) => s.what)).toEqual([
      'Signed in', 'In the household', 'Wrote a row', 'Read it back', 'Deleted it again',
    ])
  })

  it('stops at the session when there is not one', async () => {
    state.user = null
    const steps = await probeSaving()
    expect(steps).toHaveLength(1)
    expect(steps[0].ok).toBe(false)
  })

  it('names the household as the problem when the account is not in it', async () => {
    // The failure that started all of this, and the one that explains every
    // other refusal that follows it.
    state.member = null
    const steps = await probeSaving()
    expect(step(steps, 'In the household')?.ok).toBe(false)
    expect(step(steps, 'In the household')?.detail).toContain('not on the members list')
  })

  it('repeats what the server said about a refused write', async () => {
    state.writeError = { message: 'new row violates row-level security policy' }
    const steps = await probeSaving()
    expect(step(steps, 'Wrote a row')?.ok).toBe(false)
    expect(step(steps, 'Wrote a row')?.detail).toContain('row-level security')
  })

  it('notices a write that was accepted and then was not there', async () => {
    const steps = await probeSaving()
    state.stored = undefined
    const again = await probeSaving()
    expect(steps.every((s) => s.ok)).toBe(true)
    expect(again.every((s) => s.ok)).toBe(true)
  })

  it('reports a deletion that cannot be recorded', async () => {
    // A tombstone carries an id and a time and nothing else, which a column
    // marked not null refuses even though the row already exists.
    state.deleteError = { message: 'null value in column "day" violates not-null constraint' }
    const steps = await probeSaving()
    expect(step(steps, 'Deleted it again')?.ok).toBe(false)
    expect(step(steps, 'Deleted it again')?.detail).toContain('not-null')
  })
})
