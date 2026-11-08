import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import type { RowTable, SyncRow } from './types'
import { applyRemote, fingerprint, localChanges } from './diff'
import { useSyncState } from './store'

/**
 * Carrying rows between this device and the household's copy.
 *
 * The order matters and is the same every time: take what the server has,
 * merge it into what is here, then send whatever is still only here. Sending
 * first is how an empty phone empties a full one, and it is what happened.
 *
 * Nothing in this file decides what wins. That is all in diff.ts, where it can
 * be tested without a network, a clock or a database. This file is the part
 * that has to cope with those three things being unreliable.
 */

export interface EngineHooks {
  /** Called whenever rows have been written into the stores. */
  onApplied?: (table: string, count: number) => void
  /** Called with the server's own words when it refuses something. */
  onError?: (message: string) => void
  /** A table whose changes the server has just accepted. */
  onDelivered?: (table: string) => void
  /**
   * Rows both of you changed. This device's version is kept and sent (diff.ts
   * is local-first); these are the other person's versions, handed over so
   * they can be kept and restored rather than lost quietly.
   */
  onContested?: (table: string, rows: SyncRow[]) => void
  /**
   * A wholesale deletion this device refused to publish, and the two numbers
   * behind it, so the screen can ask whether it was meant rather than only
   * telling the person it was not.
   */
  onHeldBack?: (held: HeldDeletion) => void
}

export interface HeldDeletion {
  table: string
  deletions: number
  known: number
}

/**
 * How much of a table this device may delete in one go before it is treated as
 * a fault rather than an intention.
 *
 * Deleting things is normal. Deleting almost everything at once is what a
 * cleared browser looks like from in here: local state empty, the record of
 * what used to exist still present, and every missing row therefore a
 * deletion to be published. Doing that faithfully would take the other
 * person's copy down with it, which is the exact failure this rewrite exists
 * to prevent, arriving by a new route.
 *
 * A person deleting eight things by hand is asked for nothing; a device that
 * has apparently lost everything is stopped and asked.
 *
 * Asked, not refused outright: emptying a shopping list of twenty-one things
 * looks exactly like a wiped browser from in here, and it is a thing people do
 * on purpose every week. So the guard holds the deletions and says what it is
 * holding, and `allowDeletions` is the person answering. Nothing goes without
 * that answer, and the answer covers one table once.
 */
const MASS_DELETE_ROWS = 8
const MASS_DELETE_SHARE = 0.5

/**
 * A row from the database, in the shape the app produces.
 *
 * A `date` column can arrive as a Date rather than the plain day the app deals
 * in, depending on what is between here and Postgres. Left alone, the same row
 * compares differently depending on which side it came from, and the two
 * devices trade it back and forth for as long as they are both open.
 */
/**
 * Rows per request. Supabase answers at most 1,000 by default; asking for the
 * same keeps every full page full, which is how the loop knows to go on.
 */
export const PULL_PAGE = 1000

/**
 * How far behind the watermark each pull starts.
 *
 * `updated_at` is stamped with the time a transaction started, not the time it
 * committed. A slow write can therefore land with a stamp older than one this
 * device has already seen, and a strict "newer than" would never return it.
 * Re-reading the last minute catches it; rows already agreed are dropped
 * before they are applied, so the overlap costs a few rows and nothing else.
 */
export const LOOK_BEHIND_MS = 60_000

function lookBehind(watermark: string): string {
  const at = Date.parse(watermark)
  return Number.isNaN(at) ? watermark : new Date(at - LOOK_BEHIND_MS).toISOString()
}

/** PostgREST filter for "after this row" in (updated_at, id) order. */
function keyAfter(row: SyncRow): string {
  const at = JSON.stringify(row.updated_at ?? '')
  const id = JSON.stringify(row.id)
  return `updated_at.gt.${at},and(updated_at.eq.${at},id.gt.${id})`
}

/**
 * A live change that only repeats what this device already has: its own write
 * coming back, possibly before the push that sent it has been recorded.
 */
export function isEcho(row: SyncRow, mine: SyncRow | undefined): boolean {
  if (row.deleted_at) return !mine
  return mine !== undefined && fingerprint(mine) === fingerprint(row)
}

/** Whether a row from the server says anything this device does not know. */
function isNews(row: SyncRow, known: string | undefined, here: ReadonlySet<string>): boolean {
  if (row.deleted_at) return known !== undefined || here.has(row.id)
  return known !== fingerprint(row)
}

/**
 * The household column is the server's business: every row this device sees
 * is already its own household's (row-level security sees to that), and the
 * app's rows never carry it. Left in, it would make every row from the server
 * fingerprint differently from the same row read locally.
 */
export function asAppRow(raw: SyncRow): SyncRow {
  const { household_id: _household, ...row } = raw
  const day = row.day as unknown
  if (day instanceof Date) return { ...row, day: day.toISOString().slice(0, 10) }
  if (typeof day === 'string' && day.length > 10) return { ...row, day: day.slice(0, 10) }
  return row
}

/**
 * The key every write is matched on. A row's id is only unique within its
 * household: two households both have a 'profile' settings row.
 */
export const CONFLICT_KEY = 'household_id,id'

export class RowSync {
  private stopped = false
  /** Tables whose wholesale deletion has been agreed to, spent on the next push. */
  private readonly allowed = new Set<string>()

  constructor(
    private readonly db: SupabaseClient,
    private readonly tables: RowTable[],
    private readonly userId: string,
    private readonly hooks: EngineHooks = {},
    /**
     * The household every write goes to. Optional only because the database
     * fills it in from the session when it is missing; the app always knows
     * it before it starts syncing, and says so.
     */
    private readonly householdId?: string,
  ) {}

  stop(): void {
    this.stopped = true
  }

  /**
   * "Yes, I deleted those."
   *
   * Consumed by the next push of that table and not remembered afterwards, so
   * agreeing to empty a shopping list today cannot quietly wave through a lost
   * browser tomorrow.
   */
  allowDeletions(table: string): void {
    this.allowed.add(table)
  }

  /**
   * Everything the server has learned since this device last looked.
   *
   * The watermark is what makes this cheap: after the first run it asks for
   * what changed rather than for everything, so a phone opening in a shop reads
   * three rows instead of a year of them.
   */
  async pull(table: RowTable, pending: ReadonlySet<string> = new Set()): Promise<boolean> {
    const snapshot = useSyncState.getState().snapshotFor(table.table)
    const since = snapshot.watermark ? lookBehind(snapshot.watermark) : undefined

    // Every page, in a fixed order, until the server has nothing more. The
    // server answers at most PULL_PAGE rows a time and says nothing about the
    // rest; the watermark then jumps past them and they are never asked for
    // again. Paged by key (the last row's updated_at and id), not by offset: an
    // offset shifts when a row changes mid-pull, and the row that slides across
    // the page boundary is skipped.
    const fetched: SyncRow[] = []
    let after: SyncRow | undefined
    for (;;) {
      let query = this.db.from(table.table).select('*')
      if (since) query = query.gte('updated_at', since)
      if (after) query = query.or(keyAfter(after))
      const { data, error } = await query
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PULL_PAGE)
      if (error) {
        this.hooks.onError?.(error.message)
        return false
      }
      if (this.stopped) return true

      const page = (data ?? []) as SyncRow[]
      fetched.push(...page)
      if (page.length < PULL_PAGE) break
      const last = page[page.length - 1]
      // A cursor that did not move would ask for the same page forever.
      if (after && last.id === after.id && String(last.updated_at) === String(after.updated_at)) break
      after = last
    }

    // The look-behind re-reads rows this device already has; only news counts.
    const local = table.read()
    const here = new Set(local.map((row) => row.id))
    // One row per id, the latest: pages can overlap at their edges.
    const latest = new Map<string, SyncRow>()
    for (const row of fetched) latest.set(row.id, row)
    const remote = [...latest.values()].map(asAppRow).filter((row) => isNews(row, snapshot.rows[row.id], here))

    // Advanced over everything read, news or not. Otherwise a device that only
    // ever reads back its own writes never moves its watermark, and each pull
    // re-reads more of them.
    let watermark = snapshot.watermark
    for (const row of fetched) {
      if (row.updated_at && (!watermark || row.updated_at > watermark)) watermark = row.updated_at
    }

    if (!remote.length) {
      if (watermark !== snapshot.watermark) {
        useSyncState.getState().remember(table.table, { ...snapshot, watermark })
      }
      return true
    }

    const { rows, agreed, contested } = applyRemote(local, remote, snapshot, pending)

    table.apply(rows)
    if (contested.length) this.hooks.onContested?.(table.table, contested)
    // Only what came from the server counts as agreed. Recording everything
    // now on screen would include rows this device has never delivered, and
    // those would then never be sent.
    useSyncState.getState().remember(table.table, { rows: agreed, watermark })
    this.hooks.onApplied?.(table.table, remote.length)
    return true
  }

  /**
   * Whatever this device holds that the server has not been told about.
   *
   * The snapshot is only updated once the write has been accepted. A refused
   * write leaves the rows looking changed, so the next attempt sends them
   * again, which is the behaviour you want from something that is allowed to
   * fail.
   */
  async push(table: RowTable): Promise<boolean> {
    const snapshot = useSyncState.getState().snapshotFor(table.table)
    const { send, next } = localChanges(table.read(), snapshot, new Date().toISOString())
    if (!send.length) return true

    const deletions = send.filter((row) => row.deleted_at).length
    const known = Object.keys(snapshot.rows).length
    const wholesale = deletions >= MASS_DELETE_ROWS && deletions >= known * MASS_DELETE_SHARE

    if (wholesale && !this.allowed.has(table.table)) {
      // Reported rather than worded here. This file knows table names and
      // nothing about how to say them to a person, and "21 of 21
      // grocery_items" is what happens when it tries.
      this.hooks.onHeldBack?.({ table: table.table, deletions, known })
      return false
    }
    this.allowed.delete(table.table)

    const { error } = await this.db.from(table.table).upsert(
      send.map((row) => ({
        ...row,
        updated_by: this.userId,
        ...(this.householdId ? { household_id: this.householdId } : {}),
      })),
      { onConflict: CONFLICT_KEY },
    )

    if (error) {
      this.hooks.onError?.(error.message)
      return false
    }

    useSyncState.getState().remember(table.table, { ...next, watermark: snapshot.watermark })
    this.hooks.onDelivered?.(table.table)
    return true
  }

  /**
   * One full round for every table, in the order that cannot lose anything.
   *
   * What this device owes the server is worked out before the pull rather than
   * after it, so the pull knows which rows not to touch. Otherwise a deletion
   * made a second ago is handed straight back by the server's copy, which still
   * has it, and undone before there was any chance to send it.
   */
  async round(): Promise<boolean> {
    let ok = true
    for (const table of this.tables) {
      if (this.stopped) return ok

      const snapshot = useSyncState.getState().snapshotFor(table.table)
      const owed = localChanges(table.read(), snapshot, new Date().toISOString())
      const pending = new Set(owed.send.map((row) => row.id))

      if (!(await this.pull(table, pending))) { ok = false; continue }
      if (this.stopped) return ok
      if (!(await this.push(table))) ok = false
    }
    return ok
  }

  /**
   * Listens for the other phone, and for your own other devices.
   *
   * A row arriving is applied through exactly the same path as a pull, so
   * there is one set of rules about what wins rather than two that drift.
   *
   * Echoes of this device's own writes are skipped by content, not by author.
   * Filtering on `updated_by` also dropped every change made by the same
   * account on a second device, so a laptop never saw the phone's edits until
   * its next full round. A row identical to what this device already holds,
   * or a deletion of something it no longer has, is an echo whoever wrote it;
   * anything else is news, even from yourself.
   */
  watch(): () => void {
    const channels = this.tables.map((table) =>
      this.db
        .channel(`rows:${table.table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table.table },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const raw = payload.new as SyncRow & { updated_by?: string }
            if (!raw?.id || this.stopped) return
            const row = asAppRow(raw)

            const snapshot = useSyncState.getState().snapshotFor(table.table)
            const mine = table.read().find((r) => r.id === row.id)
            if (isEcho(row, mine)) return
            if (!isNews(row, snapshot.rows[row.id], new Set(mine ? [mine.id] : []))) return
            const owed = localChanges(table.read(), snapshot, new Date().toISOString())
            const { rows, agreed, contested } = applyRemote(
              table.read(), [row], snapshot, new Set(owed.send.map((r) => r.id)),
            )
            table.apply(rows)
            if (contested.length) this.hooks.onContested?.(table.table, contested)
            // The watermark is left where the last pull put it. A live change
            // says nothing about the rows written while this device was not
            // listening, and moving the watermark past them would mean they
            // are never asked for.
            useSyncState.getState().remember(table.table, { rows: agreed, watermark: snapshot.watermark })
            this.hooks.onApplied?.(table.table, 1)
          },
        )
        .subscribe(),
    )

    return () => {
      for (const channel of channels) void this.db.removeChannel(channel)
    }
  }
}
