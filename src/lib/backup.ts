/**
 * Backup and restore of everything you've entered.
 *
 * The app is local-first, which is a nice property right up until the browser
 * is the thing that fails. Three cases this exists for: storage blocked
 * outright (a private window, an embedded viewer with no origin of its own),
 * storage cleared by the browser or by you, and moving between two devices
 * that have no sync between them.
 *
 * State is read from the live stores rather than from localStorage, because
 * the case that matters most is the one where localStorage never had it.
 */
import { STORES } from '../store/registry'
import { SCHEMA_VERSION } from '../store/persist'

export interface Backup {
  app: 'bite-buddy'
  schema: number
  exportedAt: string
  stores: Record<string, unknown>
}

export function createBackup(): Backup {
  const stores: Record<string, unknown> = {}

  for (const store of STORES) {
    if (!store.name) continue
    // The JSON round-trip is what drops the actions, leaving exactly what
    // persistence would have written.
    stores[store.name] = JSON.parse(JSON.stringify(store.read())) as unknown
  }

  return {
    app: 'bite-buddy',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  }
}

export function backupFilename(now = new Date()): string {
  return `bite-buddy-backup-${now.toISOString().slice(0, 10)}.json`
}

export type RestoreResult =
  | { ok: true; restored: string[]; skipped: string[] }
  | { ok: false; error: string }

/**
 * Applies a backup to the running app.
 *
 * A refusal is always better than a partial restore under the wrong
 * assumptions, so the file is validated before anything is written: a backup
 * from a different schema is rejected outright rather than merged into a shape
 * it no longer matches.
 */
export function restoreBackup(text: string): RestoreResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste the whole backup file, including the outer braces." }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'That file does not look like a Bite Buddy backup.' }
  }
  const backup = parsed as Partial<Backup>

  if (backup.app !== 'bite-buddy') {
    return { ok: false, error: 'That file was not written by Bite Buddy.' }
  }
  const from = backup.schema
  if (typeof from !== 'number' || from > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That backup is from data version ${String(from ?? 'unknown')}; this app reads version ${SCHEMA_VERSION}. Restoring it would misread your data, so it has been left alone.`,
    }
  }
  if (typeof backup.stores !== 'object' || backup.stores === null) {
    return { ok: false, error: 'The backup has no data in it.' }
  }

  const restored: string[] = []
  const skipped: string[] = []

  for (const [key, value] of Object.entries(backup.stores)) {
    const store = STORES.find((s) => s.name === key)
    if (!store || typeof value !== 'object' || value === null) {
      skipped.push(key)
      continue
    }

    // An older backup goes through the same migration a stored copy would.
    // A store that cannot bring its own state forward says so by returning
    // undefined, and is skipped rather than restored into the wrong shape.
    const upgraded = from === SCHEMA_VERSION ? value : store.upgrade(value, from)
    if (typeof upgraded !== 'object' || upgraded === null) {
      skipped.push(key)
      continue
    }

    // setState merges over the actions, and persistence writes through on its
    // own — so this restores the running app and the saved copy together.
    store.write(upgraded)
    restored.push(key)
  }

  if (!restored.length) {
    return { ok: false, error: 'Nothing in that backup matched this version of the app.' }
  }
  return { ok: true, restored, skipped }
}
