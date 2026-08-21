/**
 * One row, as both the database and the app understand it.
 *
 * The database column names are used verbatim rather than being translated at
 * the boundary. There are ten tables and a translation layer for each is ten
 * more places for a typo to become a silently missing field, which is the exact
 * class of bug this rewrite exists to remove.
 */
export interface SyncRow {
  id: string
  /** The entity itself. Null on a row that carries only flags. */
  data?: unknown
  /** Set when the thing was deleted. A deletion is a fact, not an absence. */
  deleted_at?: string | null
  day?: string
  member_id?: string | null
  slot?: string
  hidden?: boolean
  favourite?: boolean
  merged_into?: string | null
  updated_at?: string
  updated_by?: string | null
}

/**
 * How one table maps to and from the stores the app already has.
 *
 * `read` turns local state into rows. `apply` takes the full set of rows for
 * that table and rebuilds local state from it. Neither knows anything about the
 * network, which is what makes both testable without one.
 */
export interface RowTable {
  /** The database table, and the key the engine tracks it under. */
  table: string
  read: () => SyncRow[]
  apply: (rows: SyncRow[]) => void
}

/**
 * What the engine remembers about a table between runs.
 *
 * The fingerprints are what make a deletion detectable. Local state says what
 * exists now; without a record of what existed last time, a row that has gone
 * is indistinguishable from a row that was never there, and the app cannot tell
 * the server that you deleted something. It is persisted for the same reason:
 * a deletion made offline has to survive being closed.
 */
export interface TableSnapshot {
  /** id to fingerprint, for every row this device has sent or received. */
  rows: Record<string, string>
  /** The newest `updated_at` seen from the server, so a pull asks for less. */
  watermark?: string
}

export type SyncSnapshotByTable = Record<string, TableSnapshot>
