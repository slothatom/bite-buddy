import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { discardOlderThan, safeStorage, SCHEMA_VERSION } from './persist'
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
      migrate: discardOlderThan<CookStore>(SCHEMA_VERSION),
    }
  )
)
