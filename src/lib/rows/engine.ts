import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import type { RowTable, SyncRow } from './types'
import { applyRemote, localChanges } from './diff'
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
  onDelivered?: () => void
  /** Rows both of you changed. Theirs was kept; this is how yours is not lost quietly. */
  onContested?: (table: string, rows: SyncRow[]) => void
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
 * has apparently lost everything is stopped and says so.
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
function asAppRow(row: SyncRow): SyncRow {
  const day = row.day as unknown
  if (day instanceof Date) return { ...row, day: day.toISOString().slice(0, 10) }
  if (typeof day === 'string' && day.length > 10) return { ...row, day: day.slice(0, 10) }
  return row
}

export class RowSync {
  private stopped = false

  constructor(
    private readonly db: SupabaseClient,
    private readonly tables: RowTable[],
    private readonly userId: string,
    private readonly hooks: EngineHooks = {},
  ) {}

  stop(): void {
    this.stopped = true
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

    let query = this.db.from(table.table).select('*')
    if (snapshot.watermark) query = query.gt('updated_at', snapshot.watermark)

    const { data, error } = await query
    if (error) {
      this.hooks.onError?.(error.message)
      return false
    }
    if (this.stopped) return true

    const remote = ((data ?? []) as SyncRow[]).map(asAppRow)
    if (!remote.length) return true

    const local = table.read()
    const { rows, watermark, agreed, contested } = applyRemote(local, remote, snapshot, pending)

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
    if (deletions >= MASS_DELETE_ROWS && deletions >= known * MASS_DELETE_SHARE) {
      this.hooks.onError?.(
        `This device is about to remove ${deletions} of ${known} ${table.table} from the shared copy, `
        + 'which usually means its own storage was cleared rather than that you deleted them. '
        + 'Nothing has been sent. Open the app on the device that still has your data.',
      )
      return false
    }

    const { error } = await this.db.from(table.table).upsert(
      send.map((row) => ({ ...row, updated_by: this.userId })),
      { onConflict: 'id' },
    )

    if (error) {
      this.hooks.onError?.(error.message)
      return false
    }

    useSyncState.getState().remember(table.table, { ...next, watermark: snapshot.watermark })
    this.hooks.onDelivered?.()
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
   * Listens for the other phone.
   *
   * A row arriving is applied through exactly the same path as a pull, so
   * there is one set of rules about what wins rather than two that drift.
   * Rows this device wrote are ignored: applying your own echo is how two
   * open phones end up talking to each other forever.
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
            if (!raw?.id || raw.updated_by === this.userId || this.stopped) return
            const row = asAppRow(raw)

            const snapshot = useSyncState.getState().snapshotFor(table.table)
            const owed = localChanges(table.read(), snapshot, new Date().toISOString())
            const { rows, watermark, agreed, contested } = applyRemote(
              table.read(), [row], snapshot, new Set(owed.send.map((r) => r.id)),
            )
            table.apply(rows)
            if (contested.length) this.hooks.onContested?.(table.table, contested)
            useSyncState.getState().remember(table.table, { rows: agreed, watermark })
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
