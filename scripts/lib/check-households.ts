import { PGlite } from '@electric-sql/pglite'
import { migrate, type Migration, type MigrationDb } from './migrations.js'

/**
 * Households, against the real migrations, as real signed-in people.
 *
 * Everything here runs as the `authenticated` role with `auth.uid()` set to
 * one account at a time, so what is checked is what row-level security
 * actually allows, not what the owner of the database can do.
 *
 * Two starting points, because production has one and a new project the
 * other: a database already holding a year of one household's rows, migrated
 * in place; and an empty one.
 */

export type Check = (what: string, ok: boolean, detail?: string) => void

export const ARANY = '11111111-1111-4111-8111-111111111111'
export const OLI = '22222222-2222-4222-8222-222222222222'
const STRANGER = '33333333-3333-4333-8333-333333333333'
const GUEST = '44444444-4444-4444-8444-444444444444'
const LATECOMER = '55555555-5555-4555-8555-555555555555'
const IMPOSTOR = '66666666-6666-4666-8666-666666666666'

const ROW_TABLES = [
  'plan_meals', 'grocery_items', 'recipes', 'foods', 'weights', 'measurements',
  'workouts', 'steps', 'sleep', 'portions', 'pantry', 'cook_sessions', 'settings',
]

/** What Supabase provides around the migrations: auth, roles, realtime and storage. */
export async function supabaseProject(): Promise<PGlite> {
  const db = await new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (id uuid primary key, bucket_id text);
    alter table storage.objects enable row level security;
    create role authenticated;
    create role anon;
  `)
  return db
}

export const asMigrationDb = (db: PGlite): MigrationDb => ({
  query: async (sql, params) => db.query(sql, params) as never,
  exec: (sql) => db.exec(sql),
})

/** What Supabase grants a signed-in caller on every table; RLS decides the rest. */
export async function grantLikeSupabase(db: PGlite) {
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on function auth.uid() to authenticated;
  `)
}

/** Runs `fn` as one signed-in account, exactly as PostgREST would. */
export async function as<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId])
  await db.exec('set role authenticated')
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

async function count(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query<{ n: number }>(sql, params)).rows[0].n
}

async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function addAccount(db: PGlite, id: string, email: string) {
  await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [id, email])
}

/**
 * The live database, before and after.
 *
 * Built with every migration up to the households one, filled the way
 * production is (two people on the guest list, a year of rows using the old
 * hardcoded person ids, plus the kinds of leftovers a real database has), and
 * only then migrated.
 */
export async function checkHouseholds(migrations: Migration[], check: Check): Promise<PGlite> {
  console.log('\nhouseholds: migrating a database that already holds a household')
  const index = migrations.findIndex((m) => m.name.endsWith('_households'))
  check('there is a households migration', index > 0)
  const before = migrations.slice(0, index)

  const db = await supabaseProject()
  await migrate(asMigrationDb(db), before, { log: () => {} })
  await grantLikeSupabase(db)
  // As in production, where Supabase refuses triggers on auth.users: nothing
  // stops an account being created, and access is decided by the database.
  await db.exec(`
    drop trigger if exists enforce_allowed_email on auth.users;
    drop trigger if exists add_member on auth.users;
  `)

  // The two people, as production has them: on the guest list, signed in.
  // Emails deliberately not equal to the person ids, and only one of them has
  // set a name, so both ways of matching a person to their old id are used:
  // by name for Arany, and for Oli by being the one left over.
  await db.query(`insert into public.allowed_emails (email) values ('arany.mak@example.com'), ('o.l@example.com')`)
  await addAccount(db, ARANY, 'arany.mak@example.com')
  await addAccount(db, OLI, 'o.l@example.com')
  await db.query(`insert into public.members (id, email, display_name, created_at) values
    ($1, 'arany.mak@example.com', 'Arany', '2026-01-01'),
    ($2, 'o.l@example.com', null, '2026-01-02')`, [ARANY, OLI])
  // Somebody who signed up and was then taken off the guest list: a members
  // row without access. They must not be given a household by the backfill.
  await addAccount(db, STRANGER, 'gone@example.com')
  await db.query(`insert into public.members (id, email) values ($1, 'gone@example.com')`, [STRANGER])

  await db.exec(`
    insert into public.weights (id, member_id, day, data) values
      ('w-a', 'arany', '2026-08-01', '{"id":"w-a","memberId":"arany","weight":70}'),
      ('w-o', 'oli', '2026-08-01', '{"id":"w-o","memberId":"oli","weight":60}'),
      ('w-old', 'a3f0c9de-0000-4000-8000-000000000000', '2026-01-01', '{"id":"w-old"}');
    insert into public.settings (id, data) values ('profile', '{"name":"Us"}');
    insert into public.plan_meals (id, day, slot, data) values ('m1', '2026-08-02', 'lunch', '{"id":"m1"}');
    insert into public.recipes (id, hidden) values ('shipped-1', true);
    insert into public.reminder_log (session_id, sent_to) values ('s1', '{arany.mak@example.com}');
  `)
  const rowsBefore = await count(db, `select (
    ${ROW_TABLES.map((t) => `(select count(*) from public.${t})`).join(' + ')})::int n`)

  const result = await migrate(asMigrationDb(db), migrations, { log: () => {} })
    .then((r) => r.applied.join(','), (e: Error) => `refused: ${e.message}`)
  check('the households migration applies on top of live data', result === migrations[index].name, result)
  await grantLikeSupabase(db)

  // ─── the backfill ──────────────────────────────────────────────────────────
  const households = await db.query<{ id: string; is_default: boolean }>('select id, is_default from public.households')
  check('exactly one household is created, the default one',
    households.rows.length === 1 && households.rows[0].is_default)
  const home = households.rows[0]?.id

  const rowsAfter = await count(db, `select (
    ${ROW_TABLES.map((t) => `(select count(*) from public.${t} where household_id = $1)`).join(' + ')})::int n`, [home])
  check('every existing row is backfilled into it, none lost', rowsAfter === rowsBefore && rowsBefore > 0,
    `${rowsAfter}/${rowsBefore}`)

  const pks = await db.query<{ t: string; cols: string }>(`
    select c.conrelid::regclass::text t, string_agg(a.attname, ',' order by a.attname) cols
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'p' and c.conrelid::regclass::text = any ($1)
    group by 1`, [ROW_TABLES.map((t) => `${t}`)])
  check('every row table is keyed by (household_id, id)',
    pks.rows.length === ROW_TABLES.length && pks.rows.every((r) => r.cols === 'household_id,id'),
    pks.rows.filter((r) => r.cols !== 'household_id,id').map((r) => `${r.t}:${r.cols}`).join(' '))

  const people = await db.query<{ user_id: string; role: string; person_key: string }>(
    'select user_id, role, person_key from public.household_members order by created_at, person_key')
  const byUser = new Map(people.rows.map((r) => [r.user_id, r]))
  check('both existing people are in it, as admins',
    byUser.get(ARANY)?.role === 'admin' && byUser.get(OLI)?.role === 'admin')
  check('and keep the person ids their rows already use',
    byUser.get(ARANY)?.person_key === 'arany' && byUser.get(OLI)?.person_key === 'oli',
    people.rows.map((r) => r.person_key).join(', '))
  check('somebody already taken off the guest list is not let back in', !byUser.has(STRANGER))

  // ─── the two existing people ───────────────────────────────────────────────
  const aranyReads = await as(db, ARANY, () => count(db, 'select count(*)::int n from public.weights'))
  check('Arany still reads every weight, both people\'s', aranyReads === 3, String(aranyReads))
  const oliWrites = await as(db, OLI, () => refused(() => db.query(
    `insert into public.weights (id, member_id, day, data) values ('w-o2', 'oli', '2026-08-03', '{}')
     on conflict (household_id, id) do update set data = excluded.data`)))
  check('Oli can still write', oliWrites === null, oliWrites ?? '')
  const stamped = await count(db, `select count(*)::int n from public.weights where id = 'w-o2' and household_id = $1`, [home])
  check('and the new row lands in the household without the app naming it', stamped === 1)

  // Running it again is the most likely thing anybody does to a SQL file.
  const again = await refused(() => db.exec(migrations[index].sql))
  const stillOne = await count(db, 'select count(*)::int n from public.households')
  const stillTwo = await count(db, 'select count(*)::int n from public.household_members')
  check('running the migration again changes nothing', again === null && stillOne === 1 && stillTwo === 2,
    again ?? `${stillOne} households, ${stillTwo} members`)

  // ─── an outsider ───────────────────────────────────────────────────────────
  console.log('\nhouseholds: who gets in')
  const strangerRead = await as(db, STRANGER, async () => {
    const tables = await Promise.all([...ROW_TABLES, 'households', 'household_members', 'household_invites', 'reminder_log']
      .map((t) => count(db, `select count(*)::int n from public.${t}`)))
    return tables.reduce((a, b) => a + b, 0)
  })
  check('an account with no invite reads nothing at all', strangerRead === 0, String(strangerRead))
  const strangerMembers = await as(db, STRANGER, () => count(db, 'select count(*)::int n from public.members'))
  check('and sees no one else\'s member row', strangerMembers === 1, String(strangerMembers))
  const strangerWrite = await as(db, STRANGER, () => refused(() => db.query(
    `insert into public.settings (id, data, household_id) values ('profile', '{}', $1)
     on conflict (household_id, id) do update set data = excluded.data`, [home])))
  check('and cannot write into the household', strangerWrite !== null)
  const strangerJoin = await as(db, STRANGER, () => refused(() => db.query('select public.accept_invite()')))
  check('nor join it without an invite', strangerJoin?.includes('No invitation') === true, strangerJoin ?? 'let in')
  const legacyJoin = await as(db, STRANGER, () => refused(() => db.query('select public.join_household()')))
  check('nor through the old join_household', legacyJoin !== null)
  const backdoor = await as(db, STRANGER, () => refused(() => db.query('select public.join_as($1, $2)', [home, 'admin'])))
  check('nor by calling the internal join directly', backdoor !== null)

  // ─── an invite ─────────────────────────────────────────────────────────────
  await addAccount(db, GUEST, 'guest@example.com')
  await addAccount(db, IMPOSTOR, 'not-guest@example.com')
  const invited = await as(db, ARANY, () => refused(() =>
    db.query(`select public.invite_member('Guest@Example.com', 'viewer')`)))
  check('an admin can invite by email', invited === null, invited ?? '')

  const impostor = await as(db, IMPOSTOR, () => refused(() => db.query('select public.accept_invite()')))
  check('an invite admits only its own address', impostor !== null)
  const impostorSees = await as(db, IMPOSTOR, () => count(db, 'select count(*)::int n from public.household_invites'))
  check('and nobody else can even see it', impostorSees === 0)

  const guestSees = await as(db, GUEST, () => count(db, 'select count(*)::int n from public.households'))
  check('the invitee can see the name of the household inviting them', guestSees === 1)
  const joined = await as(db, GUEST, () => db.query<{ h: string }>('select public.accept_invite() h'))
  const guestRole = await db.query<{ role: string; person_key: string }>(
    'select role, person_key from public.household_members where user_id = $1', [GUEST])
  check('the invitee joins that household with that role',
    joined.rows[0]?.h === home && guestRole.rows[0]?.role === 'viewer', JSON.stringify(guestRole.rows[0]))
  const accepted = await count(db, `select count(*)::int n from public.household_invites where accepted_at is not null`)
  check('and the invite is used up', accepted === 1)

  // ─── a viewer ──────────────────────────────────────────────────────────────
  const viewerReads = await as(db, GUEST, () => count(db, 'select count(*)::int n from public.weights'))
  check('a viewer reads the household', viewerReads === 4, String(viewerReads))
  const viewerInsert = await as(db, GUEST, () => refused(() => db.query(
    `insert into public.grocery_items (id, data) values ('g1', '{}')`)))
  check('a viewer cannot add a row', viewerInsert !== null)
  const viewerUpdate = await as(db, GUEST, async () => {
    await db.query(`update public.weights set data = '{"hacked":true}' where id = 'w-a'`)
    return count(db, `select count(*)::int n from public.weights where data ? 'hacked'`)
  })
  check('nor change one', viewerUpdate === 0)
  const viewerInvite = await as(db, GUEST, () => refused(() =>
    db.query(`select public.invite_member('friend@example.com', 'admin')`)))
  check('nor invite anybody', viewerInvite !== null)

  // ─── roles ─────────────────────────────────────────────────────────────────
  const promoted = await as(db, ARANY, () => refused(() => db.query('select public.set_member_role($1, $2)', [GUEST, 'editor'])))
  const nowEditor = await as(db, GUEST, () => refused(() => db.query(
    `insert into public.grocery_items (id, data) values ('g1', '{}')`)))
  check('an admin can make a viewer an editor, who can then write', promoted === null && nowEditor === null,
    promoted ?? nowEditor ?? '')
  const selfPromote = await as(db, GUEST, () => refused(() => db.query('select public.set_member_role($1, $2)', [GUEST, 'admin'])))
  check('an editor cannot make themselves admin', selfPromote !== null)
  await as(db, ARANY, () => db.query('select public.set_member_role($1, $2)', [OLI, 'editor']))
  const lastAdmin = await as(db, ARANY, () => refused(() => db.query('select public.set_member_role($1, $2)', [ARANY, 'viewer'])))
  check('the last admin cannot step down and leave nobody in charge', lastAdmin !== null)
  await as(db, ARANY, () => db.query('select public.set_member_role($1, $2)', [OLI, 'admin']))
  const removed = await as(db, ARANY, async () => {
    await db.query('select public.remove_member($1)', [GUEST])
    return count(db, 'select count(*)::int n from public.household_members where user_id = $1', [GUEST])
  })
  const removedReads = await as(db, GUEST, () => count(db, 'select count(*)::int n from public.weights'))
  check('an admin can remove someone, who then reads nothing', removed === 0 && removedReads === 0)

  // ─── the legacy guest list ─────────────────────────────────────────────────
  await db.query(`insert into public.allowed_emails (email) values ('late@example.com')`)
  await addAccount(db, LATECOMER, 'late@example.com')
  const late = await as(db, LATECOMER, () => db.query<{ h: string }>('select public.accept_invite() h'))
  const lateRole = await db.query<{ role: string }>('select role from public.household_members where user_id = $1', [LATECOMER])
  check('an address on the old guest list, with no invite, joins the original household',
    late.rows[0]?.h === home && lateRole.rows[0]?.role === 'editor', JSON.stringify(lateRole.rows[0]))

  // ─── a second household ────────────────────────────────────────────────────
  console.log('\nhouseholds: two of them')
  const created = await as(db, STRANGER, () => db.query<{ h: string }>(`select public.create_household('Elsewhere') h`))
  const other = created.rows[0]?.h
  const otherRole = await db.query<{ role: string }>('select role from public.household_members where user_id = $1', [STRANGER])
  check('an account with no household can start one, as its admin',
    Boolean(other) && other !== home && otherRole.rows[0]?.role === 'admin')
  const second = await as(db, STRANGER, () => refused(() => db.query(`select public.create_household('Another')`)))
  check('but only one', second !== null)

  const sameId = await as(db, STRANGER, () => refused(() => db.query(
    `insert into public.settings (id, data) values ('profile', '{"name":"Them"}')
     on conflict (household_id, id) do update set data = excluded.data`)))
  check('both households can have a row with the same id', sameId === null, sameId ?? '')

  const aSeesB = await as(db, ARANY, () => count(db, `select count(*)::int n from public.settings where data->>'name' = 'Them'`))
  const bSeesA = await as(db, STRANGER, () => count(db, `select count(*)::int n from public.weights`))
  const bSeesAMembers = await as(db, STRANGER, () => count(db, `select count(*)::int n from public.household_members`))
  check('household A cannot read household B', aSeesB === 0)
  check('household B cannot read household A, rows or people', bSeesA === 0 && bSeesAMembers === 1)

  const crossWrite = await as(db, STRANGER, () => refused(() => db.query(
    `insert into public.settings (id, data, household_id) values ('profile', '{"name":"pwned"}', $1)
     on conflict (household_id, id) do update set data = excluded.data`, [home])))
  const untouched = await count(db, `select count(*)::int n from public.settings where household_id = $1 and data->>'name' = 'Us'`, [home])
  check('nor write into it by naming it', crossWrite !== null && untouched === 1)
  await as(db, ARANY, () => db.query(
    `update public.settings set household_id = $1 where id = 'profile'`, [other]).catch(() => null))
  const moved = await count(db, `select count(*)::int n from public.settings where household_id = $1`, [other])
  check('nor can a row be moved out of a household into another', moved === 1, String(moved))
  const crossInvite = await as(db, STRANGER, () => count(db, `select count(*)::int n from public.household_invites`))
  check('and invites stay with their own household', crossInvite === 0)

  return db
}

/** The other starting point: a project with nothing in it yet. */
export async function checkEmptyProject(migrations: Migration[], check: Check) {
  console.log('\nhouseholds: a new, empty project')
  const db = await supabaseProject()
  const result = await migrate(asMigrationDb(db), migrations, { log: () => {} })
    .then((r) => r.applied.length, (e: Error) => e.message)
  check('every migration applies to an empty database', result === migrations.length, String(result))
  await grantLikeSupabase(db)

  check('and no household is invented when there is nobody to put in it',
    await count(db, 'select count(*)::int n from public.households') === 0)
  const nullable = await count(db, `select count(*)::int n from information_schema.columns
    where table_schema = 'public' and column_name = 'household_id' and is_nullable = 'NO'
      and table_name = any ($1)`, [ROW_TABLES])
  check('every row table still gets its household column', nullable === ROW_TABLES.length, String(nullable))

  // The first person on the guest list to arrive creates the original
  // household and runs it; the second joins it.
  await db.query(`insert into public.allowed_emails (email) values ('first@example.com'), ('second@example.com')`)
  await addAccount(db, ARANY, 'first@example.com')
  await addAccount(db, OLI, 'second@example.com')
  await as(db, ARANY, () => db.query('select public.join_household()'))
  await as(db, OLI, () => db.query('select public.accept_invite()'))
  const roles = await db.query<{ role: string; is_default: boolean }>(`
    select m.role, h.is_default from public.household_members m join public.households h on h.id = m.household_id
    order by m.created_at, m.role`)
  check('the first guest-list account starts the household as admin, the next joins it',
    roles.rows.length === 2 && roles.rows.every((r) => r.is_default)
    && roles.rows.map((r) => r.role).sort().join() === 'admin,editor',
    JSON.stringify(roles.rows))
  // Where the signup gate does exist, it now admits an invited address too.
  await as(db, ARANY, () => db.query(`select public.invite_member('invited@example.com', 'editor')`))
  const uninvited = await refused(() => addAccount(db, STRANGER, 'nobody@example.com'))
  const invitedSignup = await refused(() => addAccount(db, GUEST, 'invited@example.com'))
  check('where the signup gate exists, it admits an invited address and nobody else',
    uninvited !== null && invitedSignup === null, invitedSignup ?? (uninvited ? '' : 'a stranger signed up'))
  await db.close()
}
