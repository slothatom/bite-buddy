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
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useRecipeStore } from '../store/useRecipeStore'
import { useFoodStore } from '../store/useFoodStore'
import { useBodyStore } from '../store/useBodyStore'
import { useCookStore } from '../store/useCookStore'
import { SCHEMA_VERSION } from '../store/persist'

/**
 * The stores hold different shapes, so they are reduced to the two operations
 * this module needs before being put in one list — otherwise every call site
 * is fighting a union of six incompatible `setState` signatures.
 */
interface PersistedStore {
  name: string | undefined
  read: () => unknown
  write: (state: object) => void
}

function persisted<T extends object>(store: {
  getState: () => T
  setState: (partial: Partial<T>) => void
  persist: { getOptions: () => { name?: string; partialize?: (state: T) => unknown } }
}): PersistedStore {
  const { name, partialize } = store.persist.getOptions()
  return {
    name,
    read: () => (partialize ? partialize(store.getState()) : store.getState()),
    write: (state) => store.setState(state as Partial<T>),
  }
}

/**
 * Every persisted store. Each one is keyed in the file by its own persist
 * name, so a backup stays readable if the set of stores changes: a key with
 * nowhere to go is skipped rather than failing the whole restore.
 */
const STORES: PersistedStore[] = [
  persisted(useMealPlanStore), persisted(useUserStore), persisted(useRecipeStore),
  persisted(useFoodStore), persisted(useBodyStore), persisted(useCookStore),
]

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
  if (backup.schema !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That backup is from data version ${String(backup.schema ?? 'unknown')}; this app reads version ${SCHEMA_VERSION}. Restoring it would misread your data, so it has been left alone.`,
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
    // setState merges over the actions, and persistence writes through on its
    // own — so this restores the running app and the saved copy together.
    store.write(value)
    restored.push(key)
  }

  if (!restored.length) {
    return { ok: false, error: 'Nothing in that backup matched this version of the app.' }
  }
  return { ok: true, restored, skipped }
}
