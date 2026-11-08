/**
 * The household's plan archive: where it came from, and whether it is here.
 *
 * The plans are private, so they are not in the app's code. A signed-in
 * household reads them from Supabase (`plan_archive`, members only), and the
 * last copy is kept on the device in IndexedDB so the archive is there offline
 * and on the next open before the network answers. Signing out forgets both.
 *
 * The data itself lives in src/data/archive.ts as live bindings; this store is
 * the bookkeeping around it, and its `version` is what the screens key on to
 * pick up a new archive.
 *
 * Like the household store it is handed its Supabase client rather than
 * importing one, so the stores and scripts that read the version do not drag
 * the client in with them.
 */
import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clearArchive, currentArchive, setArchive } from '../data/archive'
import {
  ArchiveError, archiveCounts, parseArchive, parseArchiveText,
  type ArchiveCounts, type PlanArchive,
} from '../data/archiveFormat'
import { clearCachedArchive, readCachedArchive, writeCachedArchive } from '../lib/archiveCache'

/**
 *   idle     nothing asked yet
 *   loading  asking the database, and nothing on the device to show meanwhile
 *   ready    an archive is in place (from the database, the device or a file)
 *   missing  asked, and the household has none uploaded
 *   error    asked, the database refused, and there is nothing on the device
 */
export type ArchiveStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface ArchiveResult {
  ok: boolean
  error?: string
}

interface ArchiveStore {
  status: ArchiveStatus
  /** Goes up every time the archive in place changes. The screens remount on it. */
  version: number
  counts: ArchiveCounts | null
  /** When the database last changed it. Null for a file loaded on this device only. */
  updatedAt: string | null
  householdId: string | null
  error: string | null
  /**
   * What the last upload came to, in words. Kept here rather than in the panel
   * that shows it, because a successful upload remounts every screen, the
   * panel included, and the confirmation would go with it.
   */
  notice: { tone: 'ok' | 'bad'; message: string } | null

  /** Puts the copy kept on this device in place, if it belongs to `householdId`. */
  restore: (householdId: string | null) => Promise<void>
  /** Asks the database for the household's archive, and takes it if it is newer. */
  load: (householdId: string) => Promise<void>
  /** Checks a file and makes it the household's archive (or this device's, on a local copy). */
  upload: (text: string, householdId: string | null) => Promise<ArchiveResult>
  /** Forgets the archive, in memory and on the device. */
  clear: () => Promise<void>
  setNotice: (notice: ArchiveStore['notice']) => void
}

let supabase: SupabaseClient | null = null
let configured = false

export function connectArchive(client: SupabaseClient | null, isConfigured: boolean): void {
  supabase = client
  configured = isConfigured
}

const EMPTY = {
  status: 'idle' as ArchiveStatus,
  counts: null,
  updatedAt: null,
  householdId: null,
  error: null,
  notice: null,
}

/** One request at a time per household, so a quick second sign-in event does not race the first. */
let loading: Promise<void> | null = null
/** Bumped by `clear`, so a load that was already on its way cannot put an archive back after sign-out. */
let epoch = 0

export const useArchive = create<ArchiveStore>()((set, get) => {
  function apply(archive: PlanArchive, householdId: string | null, updatedAt: string | null) {
    setArchive(archive)
    set({
      status: 'ready',
      version: get().version + 1,
      counts: archiveCounts(archive),
      updatedAt,
      householdId,
      error: null,
    })
  }

  function forget(status: ArchiveStatus, error: string | null = null) {
    const had = currentArchive() !== null
    clearArchive()
    set({ ...EMPTY, status, error, version: had ? get().version + 1 : get().version })
  }

  return {
    ...EMPTY,
    version: 0,

    restore: async (householdId) => {
      const at = epoch
      const cached = await readCachedArchive()
      // Signed out while this was reading: the copy is already being forgotten.
      if (!cached || at !== epoch) return
      // A copy for another household (somebody else signed in here last, and
      // the sign-out never ran) is not this person's to see.
      if (configured && cached.householdId !== householdId) {
        await clearCachedArchive()
        return
      }
      try {
        apply(parseArchive(cached.data), cached.householdId, cached.updatedAt)
      } catch {
        await clearCachedArchive()
      }
    },

    load: (householdId) => {
      if (loading) return loading
      const at = epoch
      const stale = () => at !== epoch
      loading = (async () => {
        const db = supabase
        if (!db) return
        const mine = get().householdId === householdId && currentArchive() !== null
        if (!mine) {
          // Somebody else's archive must not stay up while this one loads.
          if (currentArchive()) forget('loading')
          else set({ status: 'loading', error: null })
        }

        // Only the timestamp first: the archive is close to a megabyte, and on
        // most opens it has not changed since the copy on the device.
        const head = await db.from('plan_archive').select('updated_at').eq('household_id', householdId).maybeSingle()
        if (stale()) return
        if (head.error) {
          if (mine) set({ error: head.error.message })
          else set({ status: 'error', error: head.error.message })
          return
        }
        if (!head.data) {
          await clearCachedArchive()
          forget('missing')
          return
        }
        const updatedAt = head.data.updated_at as string
        if (mine && get().updatedAt === updatedAt) {
          set({ status: 'ready', error: null })
          return
        }

        const full = await db.from('plan_archive').select('data, updated_at').eq('household_id', householdId).maybeSingle()
        if (stale()) return
        if (full.error || !full.data) {
          const error = full.error?.message ?? 'The archive went away while it was loading.'
          if (mine) set({ error })
          else set({ status: 'error', error })
          return
        }
        let archive: PlanArchive
        try {
          archive = parseArchive(full.data.data)
        } catch (e) {
          set({ status: mine ? 'ready' : 'error', error: (e as Error).message })
          return
        }
        apply(archive, householdId, full.data.updated_at as string)
        if (!stale()) await writeCachedArchive({ householdId, updatedAt: full.data.updated_at as string, data: archive })
      })().finally(() => { loading = null })
      return loading
    },

    upload: async (text, householdId) => {
      let archive: PlanArchive
      try {
        archive = parseArchiveText(text)
      } catch (e) {
        return { ok: false, error: e instanceof ArchiveError ? e.message : 'That file could not be read.' }
      }

      if (!configured) {
        // A copy of the app with no database: the file is this device's
        // archive and nobody else's.
        apply(archive, null, null)
        await writeCachedArchive({ householdId: null, updatedAt: null, data: archive })
        return { ok: true }
      }

      const db = supabase
      if (!db || !householdId) return { ok: false, error: 'Sign in to a household first.' }
      const { data, error } = await db
        .from('plan_archive')
        .upsert({ household_id: householdId, data: archive }, { onConflict: 'household_id' })
        .select('updated_at')
        .single()
      if (error) return { ok: false, error: error.message }

      const updatedAt = (data?.updated_at as string | undefined) ?? new Date().toISOString()
      apply(archive, householdId, updatedAt)
      await writeCachedArchive({ householdId, updatedAt, data: archive })
      return { ok: true }
    },

    setNotice: (notice) => set({ notice }),

    clear: async () => {
      epoch++
      loading = null
      forget('idle')
      await clearCachedArchive()
    },
  }
})

/** The archive's version, for hooks that memoise over the recipe library. */
export function useArchiveVersion(): number {
  return useArchive((s) => s.version)
}
