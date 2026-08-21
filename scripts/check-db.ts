import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { RowSync } from '../src/lib/rows/engine.js'
import { ROW_TABLES } from '../src/lib/rows/tables.js'
import { useSyncState } from '../src/lib/rows/store.js'
import { useBodyStore } from '../src/store/useBodyStore.js'
import { useMealPlanStore } from '../src/store/useMealPlanStore.js'
import { useRecipeStore } from '../src/store/useRecipeStore.js'

/**
 * Runs the real schema, in a real Postgres, against the real sync code.
 *
 * Run: npx tsx scripts/check-db.ts
 *
 * The unit tests cover what wins when two copies disagree, against a database
 * made of a Map. What they cannot see is the seam: whether the columns the app
 * sends are the columns the tables have, and whether Postgres accepts what the
 * app produces. Both of the worst bugs in this area lived exactly there.
 *
 * One of them is worth writing down, because it is invisible from either side
 * on its own. A deletion is sent as `{ id, deleted_at }` and nothing else,
 * since by then the device no longer holds the thing. Postgres checks not-null
 * constraints on the proposed row before it looks for a conflicting one, so
 * with `data` and `day` marked not null, `insert ... on conflict do update`
 * failed outright, even though the row existed and the update would not have
 * touched those columns. Every deletion would have been refused forever, and
 * the only sign would have been an error nobody reads.
 *
 * PGlite is Postgres compiled to WebAssembly, so this is not a mock: the same
 * parser, the same constraints, the same row-level security machinery.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const ARANY = '11111111-1111-4111-8111-111111111111'
const OLI = '22222222-2222-4222-8222-222222222222'

const problems: string[] = []

function check(what: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${what}${detail ? `  (${detail})` : ''}`)
  if (!ok) problems.push(what)
}

/**
 * Can somebody actually join the household?
 *
 * Its own database, because it needs the real policies from schema.sql rather
 * than the permissive stand-in the rest of this file uses, and it needs to run
 * as an ordinary signed-in person rather than as the owner.
 *
 * This is here because of what it missed. Every policy in the app consults
 * `is_member()`, and membership is one row that the app writes at sign-in as an
 * upsert. Postgres runs an upsert as `insert ... on conflict do update`, which
 * requires the select policy to pass so it can look for the conflicting row.
 * The select policy was `is_member()`. So joining required already having
 * joined, the write was refused every time, nobody was ever a member, and every
 * read and write of the household's data was refused after that. The app could
 * only report that saving had stopped working.
 */
async function checkJoining() {
  console.log('\njoining the household')
  const fresh = await new PGlite()
  const schema = readFileSync(resolve(ROOT, 'supabase/schema.sql'), 'utf8')

  await fresh.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
  `)

  /**
   * Run as somebody who does not own `auth.users`.
   *
   * This is the situation in a real Supabase project, and it is what broke: a
   * trigger on that table is refused with "must be owner of relation users",
   * the SQL editor runs the file as one transaction, and so the refusal
   * abandoned every statement after it, including the policy that decides
   * whether anybody can join. The file has to survive that, because the person
   * running it sees a red message and no way to tell how much of it applied.
   */
  await fresh.exec(`
    create role authenticated;
    create role installer;
    grant create, usage on schema public to installer;
    grant usage on schema auth to installer;
    -- Enough to write the schema, and not enough to own auth.users, which is
    -- the whole point: a foreign key needs references, a backfill needs select,
    -- and a trigger needs ownership, which a real project does not grant.
    grant select, references on auth.users to installer;
    grant execute on function auth.uid() to installer;
  `)
  await fresh.exec('set role installer')
  await fresh.exec(schema)
  await fresh.exec('reset role')

  const trigger = await fresh.query<{ n: number }>(
    `select count(*)::int n from pg_trigger where tgname = 'add_member'`)
  check('the trigger on auth.users was refused, as it is in a real project',
    trigger.rows[0].n === 0)

  const policy = await fresh.query<{ q: string | null }>(
    `select qual q from pg_policies where tablename = 'members' and cmd = 'SELECT'`)
  check('and the file carried on to the policy that comes after it',
    (policy.rows[0]?.q ?? '').includes('uid'))

  await fresh.exec(`
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
    grant execute on function auth.uid() to authenticated;
  `)

  // Somebody who has an account and has never opened the app before.
  const NEWCOMER = '33333333-3333-4333-8333-333333333333'
  await fresh.query('insert into auth.users (id, email) values ($1, $2)', [NEWCOMER, 'new@example.com'])
  await fresh.query('delete from public.members where id = $1', [NEWCOMER])

  await fresh.query(`select set_config('request.jwt.claim.sub', $1, false)`, [NEWCOMER])
  await fresh.exec('set role authenticated')

  try {
    // Exactly the statement supabase-js sends for .upsert().
    await fresh.query(
      `insert into public.members (id, email, last_seen_at) values ($1, $2, now())
       on conflict (id) do update set email = excluded.email, last_seen_at = excluded.last_seen_at`,
      [NEWCOMER, 'new@example.com'],
    )
    check('a new account can add itself to the household', true)
  } catch (e) {
    check('a new account can add itself to the household', false, (e as Error).message)
  }

  const member = await fresh.query<{ yes: boolean }>('select public.is_member() as yes')
  check('and is then a member, which every other policy depends on', member.rows[0].yes === true)

  // The last way in: no policy involved, for when the policies are the problem.
  await fresh.exec('reset role')
  await fresh.query('delete from public.members where id = $1', [NEWCOMER])
  await fresh.exec('set role authenticated')
  try {
    await fresh.query('select public.join_household()')
    const joined = await fresh.query<{ yes: boolean }>('select public.is_member() as yes')
    check('join_household adds an account that the table itself would refuse',
      joined.rows[0].yes === true)
  } catch (e) {
    check('join_household adds an account that the table itself would refuse', false, (e as Error).message)
  }
  await fresh.exec('reset role')

  await fresh.close()
}

await checkJoining()

const db = await new PGlite()

/**
 * What Supabase provides and this does not: the auth schema, the membership
 * check that every policy consults, the realtime publication, and the old
 * document table the import at the end of rows.sql reads.
 */
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function public.is_member() returns boolean language sql stable as $$ select true $$;
  create publication supabase_realtime;
  create table if not exists public.app_state (
    key text primary key, data jsonb not null, schema integer not null default 3
  );
`)
await db.query('insert into auth.users (id) values ($1), ($2)', [ARANY, OLI])

// One old document per store, so the import has something to bring across.
await db.query(
  `insert into public.app_state (key, data) values ('bite-buddy-mealplan-v2', $1::jsonb), ('bite-buddy-body', $2::jsonb)`,
  [
    JSON.stringify({
      plan: [{ date: '2026-08-01', meals: [{ id: 'old-1', slot: 'lunch', entries: [] }] }],
      groceryItems: [],
    }),
    JSON.stringify({
      weightEntries: [{ id: 'old-w', date: '2026-08-01', weight: 70, unit: 'kg', memberId: 'arany' }],
      measurements: [],
    }),
  ],
)

const sql = readFileSync(resolve(ROOT, 'supabase/rows.sql'), 'utf8')

console.log('\nthe schema')
try {
  await db.exec(sql)
  check('rows.sql runs', true)
} catch (e) {
  check('rows.sql runs', false, (e as Error).message)
  process.exit(1)
}

// Pasting it twice is the most likely thing anybody does to this file.
await db.exec(sql)
check('running it twice changes nothing',
  (await db.query<{ n: number }>('select count(*)::int n from plan_meals')).rows[0].n === 1)

const TABLES = [
  'plan_meals', 'grocery_items', 'recipes', 'foods', 'weights', 'measurements',
  'workouts', 'steps', 'sleep', 'portions', 'pantry', 'cook_sessions', 'settings',
]

for (const table of TABLES) {
  const rls = await db.query<{ on: boolean }>(
    'select relrowsecurity as on from pg_class where relname = $1', [table])
  const policies = await db.query<{ n: number }>(
    'select count(*)::int n from pg_policies where tablename = $1', [table])
  const ok = rls.rows[0]?.on === true && policies.rows[0].n >= 3
  if (!ok) check(`${table} is protected`, false, `rls=${rls.rows[0]?.on} policies=${policies.rows[0].n}`)
}
check('every table has row-level security and its three policies',
  !problems.some((p) => p.endsWith('is protected')))

console.log('\nbringing the old documents across')
check('a planned meal became a row',
  (await db.query<{ n: number }>(`select count(*)::int n from plan_meals where id = 'old-1'`)).rows[0].n === 1)
check('a weight became a row',
  (await db.query<{ n: number }>(`select count(*)::int n from weights where id = 'old-w'`)).rows[0].n === 1)

/** Just enough of the Supabase client to run the real engine over real SQL. */
function client() {
  return {
    from: (table: string) => ({
      select: () => {
        const run = async (where = '', params: unknown[] = []) => {
          try {
            const r = await db.query(`select * from public.${table} ${where}`, params)
            return { data: r.rows, error: null }
          } catch (e) { return { data: null, error: { message: (e as Error).message } } }
        }
        return Object.assign(run(), {
          gt: (col: string, value: string) => run(`where ${col} > $1`, [value]),
        })
      },
      upsert: async (rows: Record<string, unknown>[]) => {
        try {
          for (const row of rows) {
            const cols = Object.keys(row).filter((c) => row[c] !== undefined)
            const values = cols.map((c) => {
              const v = row[c]
              return typeof v === 'object' && v !== null ? JSON.stringify(v) : v
            })
            await db.query(
              `insert into public.${table} (${cols.map((c) => `"${c}"`).join(',')})
               values (${cols.map((_, i) => `$${i + 1}`).join(',')})
               on conflict (id) do update set ${cols.filter((c) => c !== 'id')
                 .map((c) => `"${c}" = excluded."${c}"`).join(',')}`,
              values,
            )
          }
          return { error: null }
        } catch (e) { return { error: { message: (e as Error).message } } }
      },
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }
}

function refused(who: string) {
  return (message: string) => problems.push(`${who} was refused: ${message}`)
}

const meal = { id: 'm1', slot: 'lunch' as const, entries: [{ kind: 'food' as const, foodId: 'f1', grams: 120 }] }
const aranyWeight = { id: 'w1', date: '2026-08-19', weight: 72.4, unit: 'kg' as const, memberId: 'arany' }
const oliWeight = { id: 'w2', date: '2026-08-20', weight: 61, unit: 'kg' as const, memberId: 'oli' }

function beArany() {
  useBodyStore.setState({ weightEntries: [aranyWeight], measurements: [] })
  useMealPlanStore.setState({ plan: [{ date: '2026-08-20', meals: [meal] }], groceryItems: [] })
  useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [], mergedInto: {} })
}

console.log('\none phone')
beArany()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arany = new RowSync(client() as any, ROW_TABLES, ARANY, { onError: refused('Arany') })
await arany.round()

check('a weight is saved',
  (await db.query<{ n: number }>(`select count(*)::int n from weights where id = 'w1'`)).rows[0].n === 1)
check('a planned meal is saved',
  (await db.query<{ n: number }>(`select count(*)::int n from plan_meals where id = 'm1'`)).rows[0].n === 1)

const stamp = async () =>
  String((await db.query<{ t: string }>('select max(updated_at) t from weights')).rows[0].t)
const before = await stamp()
await arany.round()
check('a round with nothing new writes nothing', before === await stamp())

const aranyKnows = JSON.parse(JSON.stringify(useSyncState.getState().tables)) as unknown

console.log('\nthe other phone')
useSyncState.setState({ tables: {} })
useBodyStore.setState({ weightEntries: [], measurements: [] })
useMealPlanStore.setState({ plan: [], groceryItems: [] })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oli = new RowSync(client() as any, ROW_TABLES, OLI, { onError: refused('Oli') })
await oli.round()

check('receives the weight', useBodyStore.getState().weightEntries.some((w) => w.id === 'w1'))
check('receives the week', useMealPlanStore.getState().plan.length > 0)

// Nothing changed here, so nothing should be written back. Two phones that
// answer each other's rows never stop talking.
const quiet = await stamp()
await oli.round()
check('does not answer a row it has only just received', quiet === await stamp())

useBodyStore.setState({ weightEntries: [...useBodyStore.getState().weightEntries, oliWeight] })
await oli.round()
check('both peoples weights are kept',
  (await db.query<{ n: number }>('select count(*)::int n from weights where deleted_at is null')).rows[0].n === 3)

useMealPlanStore.setState({ plan: [] })
await oli.round()
check('a deletion is recorded rather than forgotten',
  (await db.query<{ d: boolean }>(`select deleted_at is not null d from plan_meals where id = 'm1'`)).rows[0]?.d === true)

console.log('\nback on the first phone')
useSyncState.setState({ tables: aranyKnows as never })
beArany()
await arany.round()

check('picks up the other weight', useBodyStore.getState().weightEntries.length === 2,
  useBodyStore.getState().weightEntries.map((w) => w.id).join(', '))
check('applies the deletion', useMealPlanStore.getState().plan.flatMap((d) => d.meals).length === 0)

await arany.round()
check('and the deleted meal does not come back',
  useMealPlanStore.getState().plan.flatMap((d) => d.meals).length === 0)

console.log(
  problems.length
    ? `\n${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`
    : '\nSaving works: both directions, both people, deletions included.',
)
process.exit(problems.length ? 1 : 0)
