import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, AchievementId, Achievement } from '../types'

const XP_PER_LEVEL = 200

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_recipe',   name: 'First Recipe',      description: 'Add your first recipe',             emoji: '📝', xpReward: 50 },
  { id: 'five_recipes',   name: 'Recipe Hoarder',    description: 'Add 5 recipes',                     emoji: '📚', xpReward: 100 },
  { id: 'first_plan',     name: 'Planner Pro',       description: 'Add your first meal to the planner',emoji: '📅', xpReward: 50 },
  { id: 'week_complete',  name: 'Full Week',         description: 'Plan meals for every day this week', emoji: '🗓️', xpReward: 150 },
  { id: 'grocery_master', name: 'Grocery Master',    description: 'Generate your first grocery list',   emoji: '🛒', xpReward: 75 },
  { id: 'prep_master',    name: 'Prep Master',       description: 'Complete a full prep session',       emoji: '👨‍🍳', xpReward: 100 },
  { id: 'streak_3',       name: '3-Day Streak',      description: 'Log meals 3 days in a row',          emoji: '🔥', xpReward: 75 },
  { id: 'streak_7',       name: 'Week Warrior',      description: 'Log meals 7 days in a row',          emoji: '⚡', xpReward: 200 },
  { id: 'macro_goal',     name: 'Macro Tracker',     description: 'Hit your macro goal for a day',      emoji: '🎯', xpReward: 100 },
  { id: 'weight_logged',  name: 'Body Tracker',      description: 'Log your first weight entry',         emoji: '⚖️', xpReward: 50 },
]

function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

function xpForNextLevel(xp: number): { current: number; needed: number; progress: number } {
  const inLevel = xp % XP_PER_LEVEL
  return { current: inLevel, needed: XP_PER_LEVEL, progress: inLevel / XP_PER_LEVEL }
}

export interface XpToast { amount: number; label?: string }

interface UserStore {
  profile: UserProfile
  toast: XpToast | null
  setName: (name: string) => void
  setMacroTargets: (targets: UserProfile['macroTargets']) => void
  addXp: (amount: number, label?: string) => void
  clearToast: () => void
  unlockAchievement: (id: AchievementId) => boolean
  checkStreak: () => void
  xpProgress: () => { current: number; needed: number; progress: number }
  allAchievements: Achievement[]
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: {
        name: 'Prep Warrior',
        xp: 0,
        level: 1,
        streak: 0,
        macroTargets: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
        weightUnit: 'kg' as const,
        achievements: [],
      },

      toast: null,
      allAchievements: ALL_ACHIEVEMENTS,

      setName: (name) =>
        set((s) => ({ profile: { ...s.profile, name } })),

      setMacroTargets: (targets) =>
        set((s) => ({ profile: { ...s.profile, macroTargets: targets } })),

      addXp: (amount, label) =>
        set((s) => {
          const newXp = s.profile.xp + amount
          return {
            profile: { ...s.profile, xp: newXp, level: computeLevel(newXp) },
            toast: { amount, label },
          }
        }),

      clearToast: () => set({ toast: null }),

      unlockAchievement: (id) => {
        const { profile, addXp } = get()
        const already = profile.achievements.some((a) => a.id === id)
        if (already) return false
        const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === id)
        if (!achievement) return false
        set((s) => ({
          profile: {
            ...s.profile,
            achievements: [
              ...s.profile.achievements,
              { ...achievement, unlockedAt: new Date().toISOString() },
            ],
          },
        }))
        addXp(achievement.xpReward, achievement.name)
        return true
      },

      checkStreak: () => {
        const today = new Date().toISOString().split('T')[0]
        const { profile, unlockAchievement } = get()
        const last = profile.lastActiveDate

        if (last === today) return

        let newStreak = 1
        if (last) {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          if (last === yesterday.toISOString().split('T')[0]) {
            newStreak = profile.streak + 1
          }
        }

        set((s) => ({
          profile: {
            ...s.profile,
            streak: newStreak,
            lastActiveDate: today,
          },
        }))

        if (newStreak >= 3) unlockAchievement('streak_3')
        if (newStreak >= 7) unlockAchievement('streak_7')
      },

      xpProgress: () => xpForNextLevel(get().profile.xp),
    }),
    {
      name: 'bite-buddy-user',
      partialize: (s) => ({ profile: s.profile }), // don't persist toast
    }
  )
)

export { XP_PER_LEVEL, computeLevel }
