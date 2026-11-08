/**
 * Applies pending migrations to the household's Supabase database.
 *
 *   SUPABASE_DB_URL=postgres://... npm run db:migrate            apply
 *   SUPABASE_DB_URL=postgres://... npm run db:migrate -- --dry-run   report only
 *
 * The URL is the database's own connection string (Project Settings, Database,
 * "Session pooler" or direct), not the API URL. The transaction pooler on port
 * 6543 will not do: the runner holds an advisory lock for the whole run, and
 * that pooler hands each statement to a different connection.
 *
 * Run by the deploy workflow before the site is published, so the database is
 * never behind the code that talks to it.
 */
import { resolve } from 'node:path'
import pg from 'pg'
import { migrate, readMigrations } from './lib/migrations'
import { parseDbUrl } from './lib/db-url'

const raw = process.env.SUPABASE_DB_URL
if (!raw) {
  console.error('SUPABASE_DB_URL is not set. It is the Postgres connection string from')
  console.error('Supabase: Connect, Direct, Session pooler.')
  process.exit(1)
}

const parsed = parseDbUrl(raw)
for (const note of parsed.notes) console.log(`SUPABASE_DB_URL: ${note}`)
if (!parsed.url) {
  for (const problem of parsed.problems) console.error(`SUPABASE_DB_URL: ${problem}`)
  console.error('Fix the secret under Settings, Secrets and variables, Actions, then re-run this job.')
  process.exit(1)
}
const url = parsed.url

const dryRun = process.argv.includes('--dry-run')
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 10_000,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query("set statement_timeout = '120s'")
  await migrate(
    { query: async (sql, params) => (await client.query(sql, params)) as never, exec: (sql) => client.query(sql) },
    readMigrations(resolve(import.meta.dirname, '../supabase/migrations')),
    { dryRun },
  )
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await client.end()
}
