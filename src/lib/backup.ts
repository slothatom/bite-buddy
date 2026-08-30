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
import { STORES, type PersistedStore } from '../store/registry'
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

/**
 * What a store's state looks like, one level down.
 *
 * Enough to tell a real payload from junk without hand-writing nine schemas
 * that would then have to be kept in step with nine stores. A `plan` that is a
 * string, or a `profile` that is an array, is caught here; a `plan` holding
 * days with the wrong fields inside them is not, and the store's own migration
 * is the thing that is supposed to catch that.
 */
type Kind = 'array' | 'object' | 'string' | 'number' | 'boolean' | 'empty'

function kindOf(value: unknown): Kind {
  if (value === null || value === undefined) return 'empty'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  return t === 'object' || t === 'function' ? 'object' : (t as Kind)
}

function shapeOf(value: object): Map<string, Kind> {
  return new Map(Object.entries(value).map(([k, v]) => [k, kindOf(v)]))
}

/**
 * Says whether a payload could be this store's state.
 *
 * Missing keys are fine: a backup taken before a field existed legitimately
 * lacks it, and `setState` merges over the store's own defaults. An unknown
 * key is not fine, and neither is a key of the wrong kind. Both mean the file
 * is describing a shape this build does not have, and writing it would leave
 * the app holding state no code expects.
 */
function fits(store: PersistedStore, value: object): string | null {
  if (Array.isArray(value)) return `${store.label} is not the right shape`

  const live = store.read()
  if (typeof live !== 'object' || live === null) return null
  const expected = shapeOf(live)
  const got = shapeOf(value)

  for (const [key, kind] of got) {
    const want = expected.get(key)
    if (want === undefined) return `${store.label} has a "${key}" this version does not know about`
    // Either side empty means an optional field, present in one and not the
    // other. That is a normal difference between two builds, not a bad file.
    if (kind === 'empty' || want === 'empty') continue
    if (kind !== want) return `${store.label} has a "${key}" that is ${kind} where it should be ${want}`
  }
  return null
}

/** One store's payload, checked and upgraded, waiting to be written. */
interface Prepared {
  store: PersistedStore
  state: object
}

export interface RestorePlan {
  /** When the backup was taken, as written in the file. */
  exportedAt: string | undefined
  /** Everything that will be replaced, in the words the panel shows. */
  replacing: string[]
  /** Names in the file this build has no store for. Reported, not fatal. */
  unknown: string[]
  prepared: Prepared[]
}

export type Inspection =
  | { ok: true; plan: RestorePlan }
  | { ok: false; error: string }

/**
 * Reads a backup and works out exactly what restoring it would do, writing
 * nothing.
 *
 * Split out from applying it for two reasons. A person is entitled to know
 * what is about to be replaced before it is replaced, rather than being told
 * afterwards. And validating every store before writing any of them is the
 * only way a restore can be all-or-nothing: the loop that checked each payload
 * as it wrote it could stop halfway through a bad file and leave the app
 * holding half of one backup and half of another, with no way back to either.
 */
export function inspectBackup(text: string): Inspection {
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

  const prepared: Prepared[] = []
  const unknown: string[] = []

  for (const [key, value] of Object.entries(backup.stores)) {
    const store = STORES.find((s) => s.name === key)
    if (!store) {
      unknown.push(key)
      continue
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: `The backup's copy of ${store.label} is not readable, so nothing has been changed.` }
    }

    // An older backup goes through the same migration a stored copy would. A
    // store that cannot bring its own state forward says so by returning
    // undefined, and that is a refusal for the whole file rather than one
    // section quietly going missing.
    const upgraded = from === SCHEMA_VERSION ? value : store.upgrade(value, from)
    if (typeof upgraded !== 'object' || upgraded === null) {
      return { ok: false, error: `The backup's copy of ${store.label} cannot be brought forward to this version, so nothing has been changed.` }
    }

    const wrong = fits(store, upgraded)
    if (wrong) return { ok: false, error: `${wrong}, so nothing has been changed.` }

    prepared.push({ store, state: upgraded })
  }

  if (!prepared.length) {
    return { ok: false, error: 'Nothing in that backup matched this version of the app.' }
  }

  return {
    ok: true,
    plan: {
      exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : undefined,
      replacing: prepared.map((p) => p.store.label),
      unknown,
      prepared,
    },
  }
}

/**
 * Writes an inspected backup, and hands back the copy it replaced.
 *
 * The snapshot is taken here rather than left to the caller, so there is no
 * path through this that replaces everything without first having somewhere to
 * go back to.
 */
export function applyBackup(plan: RestorePlan): Backup {
  const snapshot = createBackup()

  // setState merges over the actions, and persistence writes through on its
  // own, so this restores the running app and the saved copy together.
  for (const { store, state } of plan.prepared) store.write(state)

  return snapshot
}
