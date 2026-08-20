import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type {
  Theme,
  Achievement, AchievementId, Targets, TdeeProfile, UserProfile, WeekStart,
} from '../types'
import { DEFAULT_WEEK_START } from '../types'
import { FALLBACK_TARGETS } from '../lib/targets'

const XP_PER_LEVEL = 200

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_recipe',   name: 'First Recipe',   description: 'Add your first recipe',              emoji: '📝', xpReward: 50 },
  { id: 'five_recipes',   name: 'Recipe Hoarder', description: 'Add 5 recipes',                      emoji: '📚', xpReward: 100 },
  { id: 'first_plan',     name: 'Planner Pro',    description: 'Add your first meal to the planner', emoji: '📅', xpReward: 50 },
  { id: 'week_complete',  name: 'Full Week',      description: 'Plan meals for every day this week', emoji: '🗓️', xpReward: 150 },
  { id: 'grocery_master', name: 'Grocery Master', description: 'Generate your first grocery list',   emoji: '🛒', xpReward: 75 },
  { id: 'prep_master',    name: 'Prep Master',    description: 'Complete a full prep session',       emoji: '👩‍🍳', xpReward: 100 },
  { id: 'streak_3',       name: '3-Day Streak',   description: 'Log meals 3 days in a row',          emoji: '🔥', xpReward: 75 },
  { id: 'streak_7',       name: 'Week Warrior',   description: 'Log meals 7 days in a row',          emoji: '⚡', xpReward: 200 },
  { id: 'macro_goal',     name: 'Macro Tracker',  description: 'Hit your calorie goal for a day',    emoji: '🎯', xpReward: 100 },
  { id: 'weight_logged',  name: 'Body Tracker',   description: 'Log your first weight entry',        emoji: '⚖️', xpReward: 50 },
]

export interface XpToast { amount: number; label?: string }

interface UserStore {
  profile: UserProfile
  toast: XpToast | null

  setName: (name: string) => void
  setTargets: (targets: Targets) => void
  setTdee: (tdee: TdeeProfile) => void
  setWeekStart: (day: WeekStart) => void
  setFoodNameLanguage: (lang: UserProfile['foodNameLanguage']) => void
  setTheme: (theme: Theme) => void
  setShowGamification: (show: boolean) => void

  addXp: (amount: number, label?: string) => void
  clearToast: () => void
  unlockAchievement: (id: AchievementId) => boolean
  checkStreak: () => void
  xpProgress: () => { current: number; needed: number; progress: number }
  allAchievements: Achievement[]
}

const INITIAL_PROFILE: UserProfile = {
  name: 'Friend',
  xp: 0,
  level: 1,
  streak: 0,
  targets: FALLBACK_TARGETS,
  tdee: {},
  weightUnit: 'kg',
  weekStartsOn: DEFAULT_WEEK_START,
  foodNameLanguage: 'en',
  theme: 'system',
  // The planner is meant to feel calm; XP is opt-in from Settings.
  showGamification: false,
  achievements: [],
}

function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: INITIAL_PROFILE,
      toast: null,
      allAchievements: ALL_ACHIEVEMENTS,

      setName: (name) => set((s) => ({ profile: { ...s.profile, name } })),
      setTargets: (targets) => set((s) => ({ profile: { ...s.profile, targets } })),
      setTdee: (tdee) => set((s) => ({ profile: { ...s.profile, tdee } })),
      setWeekStart: (weekStartsOn) => set((s) => ({ profile: { ...s.profile, weekStartsOn } })),
      setFoodNameLanguage: (foodNameLanguage) => set((s) => ({ profile: { ...s.profile, foodNameLanguage } })),

      setTheme: (theme) => set((s) => ({ profile: { ...s.profile, theme } })),
      setShowGamification: (showGamification) => set((s) => ({ profile: { ...s.profile, showGamification } })),

      addXp: (amount, label) =>
        set((s) => {
          const xp = s.profile.xp + amount
          return {
            profile: { ...s.profile, xp, level: computeLevel(xp) },
            toast: s.profile.showGamification ? { amount, label } : null,
          }
        }),

      clearToast: () => set({ toast: null }),

      unlockAchievement: (id) => {
        const { profile } = get()
        if (profile.achievements.some((a) => a.id === id)) return false
        const def = ALL_ACHIEVEMENTS.find((a) => a.id === id)
        if (!def) return false
        set((s) => ({
          profile: {
            ...s.profile,
            achievements: [...s.profile.achievements, { ...def, unlockedAt: new Date().toISOString() }],
          },
        }))
        get().addXp(def.xpReward, def.name)
        return true
      },

      checkStreak: () =>
        set((s) => {
          const now = today()
          if (s.profile.lastActiveDate === now) return {}
          const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
          const streak = s.profile.lastActiveDate === yesterday ? s.profile.streak + 1 : 1
          return { profile: { ...s.profile, streak, lastActiveDate: now } }
        }),

      xpProgress: () => {
        const inLevel = get().profile.xp % XP_PER_LEVEL
        return { current: inLevel, needed: XP_PER_LEVEL, progress: inLevel / XP_PER_LEVEL }
      },
    }),
    {
      name: 'bite-buddy-user-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<{ profile: UserProfile }>(),
      migrate: (state, version) => {
        const carried = upgradeThrough<{ profile: UserProfile }>(SCHEMA_VERSION, {
          // v1 → v2: the profile shape is unchanged; theme simply defaults.
          1: (s) => s,
        })(state, version)
        if (!carried?.profile) return carried
        // The week used to default to Wednesday, following the dietician's own
        // plans. It is Monday now, and a stored 3 is that old default rather
        // than a deliberate choice — the setting is still there to change it.
        return carried.profile.weekStartsOn === 3
          ? { ...carried, profile: { ...carried.profile, weekStartsOn: DEFAULT_WEEK_START } }
          : carried
      },
      // Only the profile is worth keeping; toasts are transient.
      partialize: (s) => ({ profile: s.profile }),
    },
  ),
)
