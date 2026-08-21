import type { SyncRow, TableSnapshot } from './types'

/**
 * Working out what changed, in both directions.
 *
 * Everything here is pure. The engine around it deals with a network that
 * fails, a database that refuses, and a phone that gets closed mid-write; this
 * file deals only with the question those things keep getting wrong: given what
 * is on the device, what the server sent, and what we last agreed on, what
 * should be sent and what should be kept.
 */

/**
 * A stable fingerprint of a row.
 *
 * Three things have to be ignored, or the same row fingerprints differently
 * depending on where it came from, and then two phones push it at each other
 * for as long as they are both open, each convinced the other's copy is a
 * change: when and by whom the server stamped it, the order Postgres happens to
 * return the keys in, and the difference between a field the app left out and a
 * column the database returned as null.
 */
/**
 * What the snapshot records for a row this device has deleted.
 *
 * A fixed marker rather than the tombstone's own fingerprint, which carries the
 * time of the deletion and so differs on every pass. Using that meant the
 * tombstone never matched what was remembered, and the deletion was sent again
 * on every single sync, forever.
 */
export const DELETED = '\u0000deleted'

export function fingerprint(row: SyncRow): string {
  const { updated_at: _at, updated_by: _by, ...rest } = row
  return stable(rest)
}

function stable(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    // A field the app leaves out and a column the database returns as null are
    // the same absence. Treating them as different is what makes two phones
    // push the same row at each other for as long as they are both open.
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
}

export interface LocalChanges {
  /** Rows to write to the server: new, edited, or newly deleted. */
  send: SyncRow[]
  /** The snapshot to keep once those have been accepted. */
  next: TableSnapshot
}

/**
 * What this device has that the server does not know about.
 *
 * A row missing from `current` that the snapshot remembers is a deletion, and
 * it is sent as a tombstone rather than simply forgotten. That is the whole
 * reason this rewrite happened: under the old document model, deleting
 * something on one phone and having the other phone put it back was not a bug
 * that could be fixed, it was what the shape of the data meant.
 */
export function localChanges(
  current: SyncRow[],
  snapshot: TableSnapshot,
  deletedAt: string,
): LocalChanges {
  const send: SyncRow[] = []
  const rows: Record<string, string> = {}
  const seen = new Set<string>()

  for (const row of current) {
    seen.add(row.id)
    const print = fingerprint(row)
    rows[row.id] = print
    if (snapshot.rows[row.id] !== print) send.push(row)
  }

  for (const [id, print] of Object.entries(snapshot.rows)) {
    if (seen.has(id)) continue
    rows[id] = DELETED
    // Already agreed to be gone: there is nothing left to tell anyone.
    if (print === DELETED) continue
    send.push({ id, deleted_at: deletedAt })
  }

  return { send, next: { rows, watermark: snapshot.watermark } }
}

/**
 * The rows to keep, given what arrived from the server.
 *
 * The rule is per row, and it is local-first: a row this device has changed
 * since the two copies last agreed stays, whatever the server says about it.
 * Anything else takes the server's version, including its deletions.
 *
 * This is the part the document model could not do. Merging two documents can
 * only take one whole or union both, so an edit here and an edit there meant
 * losing one of them entirely. Now they only contend if they are about the same
 * row, which for two people sharing a kitchen is almost never.
 *
 * `pending` names rows this device is about to send and has not yet: edits and,
 * importantly, deletions. Without it a pull hands back the very row you just
 * deleted, because as far as the agreed snapshot is concerned that row is still
 * supposed to exist, and the deletion is undone in front of the person who made
 * it a second earlier.
 */
export function applyRemote(
  local: SyncRow[],
  remote: SyncRow[],
  snapshot: TableSnapshot,
  pending: ReadonlySet<string> = new Set(),
): { rows: SyncRow[]; watermark?: string; agreed: Record<string, string>; contested: SyncRow[] } {
  const byId = new Map<string, SyncRow>()
  for (const row of local) byId.set(row.id, row)

  // Starts from what was already agreed rather than from what ends up on
  // screen. A row this device holds and has never delivered is not agreed, and
  // recording it as though it were means it is never sent.
  const agreed: Record<string, string> = { ...snapshot.rows }
  const contested: SyncRow[] = []
  let watermark = snapshot.watermark

  for (const row of remote) {
    if (row.updated_at && (!watermark || row.updated_at > watermark)) watermark = row.updated_at

    const mine = byId.get(row.id)
    const known = snapshot.rows[row.id]

    // Both sides moved since they last agreed. One version has to go, and it is
    // theirs, but silently is the wrong way to do it: an edit that disappears
    // with nothing said is how you stop trusting an app. Reported instead.
    const movedHere = known !== undefined
      && (mine ? fingerprint(mine) !== known : known !== DELETED)
    const movedThere = known !== undefined && fingerprint(row) !== known
    if (movedHere && movedThere) contested.push(row)

    if (pending.has(row.id)) continue

    // Changed here and not yet delivered: this device wins until it has had a
    // chance to say so. Somebody is looking at this screen.
    if (mine && known !== undefined && known !== DELETED && fingerprint(mine) !== known) continue

    // Deleted here and not yet delivered. Their copy still has it, and taking
    // it back would undo the deletion.
    if (!mine && known === DELETED && !row.deleted_at) continue

    if (row.deleted_at) {
      byId.delete(row.id)
      // Both copies agree it is gone, so there is nothing left to remember: an
      // id in neither the state nor the snapshot produces no tombstone.
      delete agreed[row.id]
    } else {
      byId.set(row.id, row)
      agreed[row.id] = fingerprint(row)
    }
  }

  return { rows: [...byId.values()], watermark, agreed, contested }
}

/** The snapshot describing exactly these rows, at this watermark. */
export function snapshotOf(rows: SyncRow[], watermark?: string): TableSnapshot {
  return {
    rows: Object.fromEntries(rows.map((r) => [r.id, fingerprint(r)])),
    watermark,
  }
}
