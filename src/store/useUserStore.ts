import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { Moment, Targets, TdeeProfile, UserProfile, WeekStart } from '../types'
import { type MomentKind, noticeMoments, type MomentContext } from '../lib/moments'
import { DEFAULT_WEEK_START } from '../types'
import { FALLBACK_TARGETS } from '../lib/targets'

interface UserStore {
  profile: UserProfile

  setName: (name: string) => void
  setTargets: (targets: Targets) => void
  setTdee: (tdee: TdeeProfile) => void
  setWeekStart: (day: WeekStart) => void
  setFoodNameLanguage: (lang: UserProfile['foodNameLanguage']) => void

  /** Records anything newly true. Already-noticed moments are left alone. */
  notice: (context: MomentContext) => void
  /** The oldest moment you have not seen yet, if there is one. */
  unseenMoment: () => Moment | null
  markMomentSeen: (kind: MomentKind) => void
}

const INITIAL_PROFILE: UserProfile = {
  name: 'Friend',
  targets: FALLBACK_TARGETS,
  tdee: {},
  weightUnit: 'kg',
  weekStartsOn: DEFAULT_WEEK_START,
  foodNameLanguage: 'en',
  moments: [],
}

/**
 * Stamps the profile as changed.
 *
 * The profile is one object, so the two devices cannot both keep their version
 * of it the way the logs can: something has to win. The stamp is what decides,
 * and without it the merge has nothing to go on and always keeps whichever copy
 * is local, so a target set on one phone never reaches the other.
 */
function stamped(profile: UserProfile): UserProfile {
  return { ...profile, updatedAt: new Date().toISOString() }
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: INITIAL_PROFILE,

      setName: (name) => set((s) => ({ profile: stamped({ ...s.profile, name }) })),
      setTargets: (targets) => set((s) => ({ profile: stamped({ ...s.profile, targets }) })),
      setTdee: (tdee) => set((s) => ({ profile: stamped({ ...s.profile, tdee }) })),
      setWeekStart: (weekStartsOn) => set((s) => ({ profile: stamped({ ...s.profile, weekStartsOn }) })),
      setFoodNameLanguage: (foodNameLanguage) =>
        set((s) => ({ profile: stamped({ ...s.profile, foodNameLanguage }) })),

      notice: (context) =>
        set((s) => {
          const already = new Set(s.profile.moments.map((m) => m.kind))
          const fresh = noticeMoments(context).filter((kind) => !already.has(kind))
          if (!fresh.length) return {}

          const at = new Date().toISOString()
          return {
            profile: stamped({
              ...s.profile,
              moments: [...s.profile.moments, ...fresh.map((kind) => ({ kind, at, seen: false }))],
            }),
          }
        }),

      // Oldest first, so a burst of them is shown in the order they happened
      // rather than newest-wins.
      unseenMoment: () => get().profile.moments.find((m) => !m.seen) ?? null,

      markMomentSeen: (kind) =>
        set((s) => ({
          profile: stamped({
            ...s.profile,
            moments: s.profile.moments.map((m) => (m.kind === kind ? { ...m, seen: true } : m)),
          }),
        })),
    }),
    {
      name: 'bite-buddy-user-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<{ profile: UserProfile }>(),
      migrate: (state, version) => {
        const carried = upgradeThrough<{ profile: UserProfile }>(SCHEMA_VERSION, {
          // v1 → v2: the profile shape is unchanged.
          1: (s) => s,
          // v2 → v3: XP, levels, streaks and achievements are gone. Their
          // values are dropped rather than translated, there is nothing in a
          // point total worth carrying into a thing that does not count.
          2: (s) => {
            const profile = { ...(s.profile as Record<string, unknown>) }
            for (const dead of ['xp', 'level', 'streak', 'lastActiveDate', 'showGamification', 'achievements']) {
              delete profile[dead]
            }
            return { ...s, profile: { ...profile, moments: [] } }
          },
        })(state, version)
        if (!carried?.profile) return carried
        // The week used to default to Wednesday, following the dietician's own
        // plans. It is Monday now, and a stored 3 is that old default rather
        // than a deliberate choice, the setting is still there to change it.
        return carried.profile.weekStartsOn === 3
          ? { ...carried, profile: { ...carried.profile, weekStartsOn: DEFAULT_WEEK_START } }
          : carried
      },
      // Only the profile is worth keeping; toasts are transient.
      partialize: (s) => ({ profile: s.profile }),
    },
  ),
)
