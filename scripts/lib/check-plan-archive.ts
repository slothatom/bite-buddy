import { migrate, type Migration } from './migrations.js'
import { as, asMigrationDb, grantLikeSupabase, supabaseProject, type Check } from './check-households.js'
import type { PGlite } from '@electric-sql/pglite'

/**
 * The plan archive: the dietician's plans, one row per household.
 *
 * They are private medical correspondence, which is the whole reason they
 * moved out of the public bundle and into this table, so every way of reading
 * and writing them is checked as the person who would be doing it.
 */

const ADMIN = 'a1111111-1111-4111-8111-111111111111'
const EDITOR = 'a2222222-2222-4222-8222-222222222222'
const VIEWER = 'a3333333-3333-4333-8333-333333333333'
const OUTSIDER = 'a4444444-4444-4444-8444-444444444444'
const NEIGHBOUR = 'a5555555-5555-4555-8555-555555555555'

async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function count(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query<{ n: number }>(sql, params)).rows[0].n
}

export async function checkPlanArchive(migrations: Migration[], check: Check) {
  console.log('\nthe plan archive')
  const db = await supabaseProject()
  await migrate(asMigrationDb(db), migrations, { log: () => {} })
  await grantLikeSupabase(db)
  // As in production, where Supabase refuses triggers on auth.users: anybody
  // can have an account, and what they can read is decided by the policies.
  await db.exec(`
    drop trigger if exists enforce_allowed_email on auth.users;
    drop trigger if exists add_member on auth.users;
  `)

  for (const [id, email] of [
    [ADMIN, 'admin@example.com'], [EDITOR, 'editor@example.com'], [VIEWER, 'viewer@example.com'],
    [OUTSIDER, 'outsider@example.com'], [NEIGHBOUR, 'neighbour@example.com'],
  ]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
  }

  const home = (await as(db, ADMIN, () =>
    db.query<{ h: string }>(`select public.create_household('Home') h`))).rows[0].h
  await as(db, ADMIN, () => db.query(`select public.invite_member('editor@example.com', 'editor')`))
  await as(db, ADMIN, () => db.query(`select public.invite_member('viewer@example.com', 'viewer')`))
  await as(db, EDITOR, () => db.query('select public.accept_invite()'))
  await as(db, VIEWER, () => db.query('select public.accept_invite()'))
  const away = (await as(db, NEIGHBOUR, () =>
    db.query<{ h: string }>(`select public.create_household('Next door') h`))).rows[0].h

  const archive = (marker: number) => JSON.stringify({ version: 1, sourcePlans: [], marker })
  const upsert = (who: string, household: string, marker: number) => as(db, who, () => refused(() => db.query(
    `insert into public.plan_archive (household_id, data) values ($1, $2::jsonb)
     on conflict (household_id) do update set data = excluded.data`, [household, archive(marker)])))
  const readAs = (who: string) => as(db, who, async () => (await db.query<{ household_id: string; marker: number }>(
    `select household_id, (data->>'marker')::int marker from public.plan_archive`)).rows)
  const markerAtHome = async () =>
    (await db.query<{ m: number }>(`select (data->>'marker')::int m from public.plan_archive where household_id = $1`, [home]))
      .rows[0]?.m

  // ─── the admin ─────────────────────────────────────────────────────────────
  const adminWrites = await upsert(ADMIN, home, 1)
  check('an admin can upload the household\'s archive', adminWrites === null, adminWrites ?? '')
  const stamp = await db.query<{ by: string | null }>(
    'select updated_by by from public.plan_archive where household_id = $1', [home])
  check('and the database records who did', stamp.rows[0]?.by === ADMIN)
  const replaced = await upsert(ADMIN, home, 2)
  check('and can replace it with a newer one', replaced === null && await markerAtHome() === 2, replaced ?? '')
  const adminReads = await readAs(ADMIN)
  check('and read it back', adminReads.length === 1 && adminReads[0].marker === 2)

  // ─── everyone else in the household ────────────────────────────────────────
  for (const [who, id] of [['an editor', EDITOR], ['a viewer', VIEWER]] as const) {
    const rows = await readAs(id)
    check(`${who} can read it`, rows.length === 1 && rows[0].marker === 2, JSON.stringify(rows))
    const insert = await upsert(id, home, 9)
    check(`${who} cannot upload one`, insert !== null)
    await as(db, id, async () => {
      await db.query(`update public.plan_archive set data = $1::jsonb`, [archive(9)])
      await db.query('delete from public.plan_archive')
    })
    check(`${who} cannot change it or delete it`, await markerAtHome() === 2)
  }

  // ─── outside the household ─────────────────────────────────────────────────
  const outsider = await readAs(OUTSIDER)
  check('an account in no household reads nothing', outsider.length === 0, JSON.stringify(outsider))
  check('and cannot write one into the household by naming it', await upsert(OUTSIDER, home, 9) !== null)

  const neighbour = await readAs(NEIGHBOUR)
  check('a member of another household reads nothing of this one', neighbour.length === 0, JSON.stringify(neighbour))
  check('nor writes into it, even as an admin of their own', await upsert(NEIGHBOUR, home, 9) !== null
    && await markerAtHome() === 2)
  const own = await upsert(NEIGHBOUR, away, 7)
  const ownRead = await readAs(NEIGHBOUR)
  check('but keeps an archive of their own, which is all they see',
    own === null && ownRead.length === 1 && ownRead[0].household_id === away, JSON.stringify(ownRead))
  const homeRead = await readAs(VIEWER)
  check('and the first household still sees only its own', homeRead.length === 1 && homeRead[0].marker === 2)

  await as(db, NEIGHBOUR, () => refused(() => db.query(`update public.plan_archive set household_id = $1`, [home])))
  check('nor can an archive be moved into another household',
    await count(db, 'select count(*)::int n from public.plan_archive where household_id = $1', [away]) === 1)

  await db.exec('set role anon')
  const anon = await refused(() => db.query('select * from public.plan_archive'))
  await db.exec('reset role')
  check('and a signed-out visitor is refused outright', anon !== null)

  await db.close()
}
