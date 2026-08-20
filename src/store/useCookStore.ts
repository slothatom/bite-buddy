import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { CookSession } from '../types'

interface CookStore {
  sessions: CookSession[]
  addSession: (s: CookSession) => void
  toggleComplete: (id: string) => void
  removeSession: (id: string) => void
  upcomingSessions: () => CookSession[]
}

export const useCookStore = create<CookStore>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (s) =>
        set((st) => ({
          sessions: [...st.sessions, s].sort((a, b) =>
            `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
          ),
        })),

      toggleComplete: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, completed: !sess.completed } : sess
          ),
        })),

      removeSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),

      upcomingSessions: () => {
        const today = new Date().toISOString().split('T')[0]
        return get().sessions.filter((s) => s.date >= today && !s.completed)
      },
    }),
    {
      name: 'bite-buddy-cook',
      version: SCHEMA_VERSION,
      storage: safeStorage<CookStore>(),
      migrate: upgradeThrough<CookStore>(SCHEMA_VERSION, {
        // v1 → v2: this store's shape did not change. Only the meal plan gained
        // a field, and discarding everything else over that would cost the user
        // their foods, recipes and logs for nothing.
        1: (state) => state,
      }),
    }
  )
)
