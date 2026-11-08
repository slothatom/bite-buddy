import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { connectArchive, useArchive } from './useArchive'
import { ALL_RECIPES, SOURCE_PLANS, currentArchive, setArchive } from '../data'
import { DISHES } from '../data/dishes'
import { testArchive } from '../test/archive'

/**
 * The bookkeeping around the plan archive, against a database made of one row.
 *
 * There is no IndexedDB under Node, so the copy on the device is skipped here
 * exactly as it is in a browser that refuses it: everything still works, it
 * just downloads again next time.
 */

const archive = testArchive()
const small = { ...archive, sourcePlans: archive.sourcePlans.slice(0, 1) }

/** One household's row, and a count of how often the full archive was fetched. */
function database(row: { data: unknown; updated_at: string } | null, fail?: string) {
  const state = { row, downloads: 0, upserts: [] as unknown[] }
  const query = (columns: string) => ({
    eq: () => ({
      maybeSingle: async () => {
        if (fail) return { data: null, error: { message: fail } }
        if (columns.includes('data') && state.row) state.downloads++
        return { data: state.row, error: null }
      },
    }),
  })
  const client = {
    from: () => ({
      select: query,
      upsert: (value: { data: unknown }) => {
        state.upserts.push(value)
        state.row = { data: value.data, updated_at: '2026-11-08T10:00:00Z' }
        return { select: () => ({ single: async () => ({ data: { updated_at: state.row!.updated_at }, error: null }) }) }
      },
    }),
  }
  return { client: client as unknown as SupabaseClient, state }
}

beforeEach(async () => {
  connectArchive(null, false)
  await useArchive.getState().clear()
})

afterAll(() => {
  connectArchive(null, false)
  setArchive(archive)
})

describe('a copy of the app with no database', () => {
  it('takes a file as this device\'s archive, and the library follows', async () => {
    const before = useArchive.getState().version
    const result = await useArchive.getState().upload(JSON.stringify(small), null)
    expect(result.ok).toBe(true)
    expect(useArchive.getState().status).toBe('ready')
    expect(useArchive.getState().version).toBe(before + 1)
    expect(useArchive.getState().counts?.plans).toBe(1)
    expect(SOURCE_PLANS).toHaveLength(1)
  })

  it('refuses a file that is not an archive, and keeps what it had', async () => {
    await useArchive.getState().upload(JSON.stringify(small), null)
    const result = await useArchive.getState().upload('{"app":"bite-buddy"}', null)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not a plan archive/)
    expect(SOURCE_PLANS).toHaveLength(1)
  })

  it('forgets it completely when cleared', async () => {
    await useArchive.getState().upload(JSON.stringify(small), null)
    await useArchive.getState().clear()
    expect(currentArchive()).toBeNull()
    expect(ALL_RECIPES).toHaveLength(DISHES.length)
    expect(useArchive.getState().counts).toBeNull()
  })
})

describe('a household with a database', () => {
  it('downloads the household\'s archive', async () => {
    const { client, state } = database({ data: archive, updated_at: '2026-11-01T00:00:00Z' })
    connectArchive(client, true)
    await useArchive.getState().load('h1')
    expect(useArchive.getState().status).toBe('ready')
    expect(useArchive.getState().householdId).toBe('h1')
    expect(SOURCE_PLANS).toHaveLength(archive.sourcePlans.length)
    expect(state.downloads).toBe(1)
  })

  it('does not download it again when it has not changed', async () => {
    const { client, state } = database({ data: archive, updated_at: '2026-11-01T00:00:00Z' })
    connectArchive(client, true)
    await useArchive.getState().load('h1')
    const version = useArchive.getState().version
    await useArchive.getState().load('h1')
    expect(state.downloads).toBe(1)
    expect(useArchive.getState().version).toBe(version)
  })

  it('takes a newer one when there is one', async () => {
    const { client, state } = database({ data: small, updated_at: '2026-11-01T00:00:00Z' })
    connectArchive(client, true)
    await useArchive.getState().load('h1')
    state.row = { data: archive, updated_at: '2026-11-02T00:00:00Z' }
    await useArchive.getState().load('h1')
    expect(SOURCE_PLANS).toHaveLength(archive.sourcePlans.length)
    expect(useArchive.getState().updatedAt).toBe('2026-11-02T00:00:00Z')
  })

  it('says so when the household has none, and shows nothing of anybody else\'s', async () => {
    const { client } = database(null)
    connectArchive(client, true)
    setArchive(archive)
    await useArchive.getState().load('h2')
    expect(useArchive.getState().status).toBe('missing')
    expect(currentArchive()).toBeNull()
  })

  it('keeps the copy it has when the database cannot be reached', async () => {
    const first = database({ data: archive, updated_at: '2026-11-01T00:00:00Z' })
    connectArchive(first.client, true)
    await useArchive.getState().load('h1')
    connectArchive(database(null, 'Failed to fetch').client, true)
    await useArchive.getState().load('h1')
    expect(useArchive.getState().status).toBe('ready')
    expect(useArchive.getState().error).toBe('Failed to fetch')
    expect(SOURCE_PLANS).toHaveLength(archive.sourcePlans.length)
  })

  it('reports a refusal when it has nothing to fall back on', async () => {
    connectArchive(database(null, 'permission denied').client, true)
    await useArchive.getState().load('h1')
    expect(useArchive.getState().status).toBe('error')
    expect(useArchive.getState().error).toBe('permission denied')
  })

  it('uploads for the household, and uses what it uploaded', async () => {
    const { client, state } = database(null)
    connectArchive(client, true)
    const result = await useArchive.getState().upload(JSON.stringify(small), 'h1')
    expect(result.ok).toBe(true)
    expect(state.upserts).toHaveLength(1)
    expect(useArchive.getState().updatedAt).toBe('2026-11-08T10:00:00Z')
    expect(SOURCE_PLANS).toHaveLength(1)
  })

  it('will not upload without a household to upload to', async () => {
    connectArchive(database(null).client, true)
    const result = await useArchive.getState().upload(JSON.stringify(small), null)
    expect(result.ok).toBe(false)
  })

  it('does not put an archive back that arrives after sign-out', async () => {
    const { client } = database({ data: archive, updated_at: '2026-11-01T00:00:00Z' })
    connectArchive(client, true)
    const loading = useArchive.getState().load('h1')
    await useArchive.getState().clear()
    await loading
    expect(currentArchive()).toBeNull()
  })
})
