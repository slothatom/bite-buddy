import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Versioned migrations, applied once each, in order.
 *
 * Ported from rebelMerch's `scripts/migrate.mjs`. Until this existed the SQL was
 * pasted into the Supabase editor by hand, and nobody could say which version
 * the live database was on, or whether the last paste had half applied.
 *
 * Each migration is a folder, `supabase/migrations/<timestamp>_<name>/migration.sql`,
 * and the journal records its SHA-256. The runner refuses, rather than guesses,
 * when:
 *   - a migration that has already run was edited since (write a new one),
 *   - the database has a migration this checkout does not (an older checkout
 *     is deploying over a newer one),
 *   - a previous run started a migration and never finished it.
 *
 * The journal lives in its own schema, not `public`. Supabase serves every
 * table in `public` over its API, and a journal there would be readable, and
 * without row-level security writable, by anyone holding the anon key.
 */

export const JOURNAL_SCHEMA = 'bite_migrations'
const LOCK_KEY = 24_871_108

/** What the runner needs from a database: pg.Client and PGlite both fit. */
export interface MigrationDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  /** Several statements at once, no parameters. */
  exec(sql: string): Promise<unknown>
}

export interface Migration {
  name: string
  sql: string
  checksum: string
}

export function readMigrations(dir: string): Migration[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8')
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') }
    })
}

interface JournalRow {
  name: string
  checksum: string
  finished_at: string | null
}

export interface MigrateResult {
  applied: string[]
  pending: string[]
  total: number
}

/**
 * Applies every migration the database has not seen.
 *
 * With `dryRun` it checks the journal against the files and reports what would
 * run, changing nothing beyond creating the empty journal.
 */
export async function migrate(
  db: MigrationDb,
  migrations: Migration[],
  { dryRun = false, log = console.log }: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<MigrateResult> {
  // Two deploys at once would otherwise both see a migration as pending.
  await db.query('select pg_advisory_lock($1)', [LOCK_KEY])
  try {
    await db.exec(`
      create schema if not exists ${JOURNAL_SCHEMA};
      revoke all on schema ${JOURNAL_SCHEMA} from public;
      create table if not exists ${JOURNAL_SCHEMA}.journal (
        name        text primary key,
        checksum    text not null,
        started_at  timestamptz not null default now(),
        finished_at timestamptz
      );
    `)

    const journal = (await db.query<JournalRow>(
      `select name, checksum, finished_at from ${JOURNAL_SCHEMA}.journal`,
    )).rows
    const names = new Set(migrations.map((m) => m.name))

    const unfinished = journal.filter((row) => !row.finished_at)
    if (unfinished.length) {
      throw new Error(`A migration started and never finished: ${unfinished.map((r) => r.name).join(', ')}. ` +
        `Check the database by hand, then delete its journal row to retry.`)
    }
    const unknown = journal.filter((row) => !names.has(row.name))
    if (unknown.length) {
      throw new Error(`The database has migrations this checkout does not: ${unknown.map((r) => r.name).join(', ')}. ` +
        `Deploy from a newer commit.`)
    }

    const pending: Migration[] = []
    for (const migration of migrations) {
      const seen = journal.find((row) => row.name === migration.name)
      if (seen && seen.checksum !== migration.checksum) {
        throw new Error(`${migration.name} was edited after it was applied. ` +
          `Put the change in a new migration instead.`)
      }
      if (!seen) pending.push(migration)
    }

    if (dryRun) {
      for (const m of pending) log(`Would apply: ${m.name}`)
      log(`${migrations.length - pending.length} of ${migrations.length} migrations already applied.`)
      return { applied: [], pending: pending.map((m) => m.name), total: migrations.length }
    }

    const applied: string[] = []
    for (const migration of pending) {
      // One transaction each: a failure leaves no half-applied migration and no
      // journal row, so the next run tries it again from the top.
      await db.exec('begin')
      try {
        await db.exec(migration.sql)
        await db.query(
          `insert into ${JOURNAL_SCHEMA}.journal (name, checksum, finished_at) values ($1, $2, now())`,
          [migration.name, migration.checksum],
        )
        await db.exec('commit')
      } catch (e) {
        await db.exec('rollback')
        throw new Error(`${migration.name} failed and was rolled back: ${(e as Error).message}`, { cause: e })
      }
      applied.push(migration.name)
      log(`Applied: ${migration.name}`)
    }

    log(`Schema ready: ${migrations.length} migrations, ${applied.length} applied now.`)
    return { applied, pending: [], total: migrations.length }
  } finally {
    await db.query('select pg_advisory_unlock($1)', [LOCK_KEY])
  }
}
