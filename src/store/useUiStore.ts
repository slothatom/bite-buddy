import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from './persist'
import type { PersonId } from '../lib/people'

/**
 * Transient UI intent, deliberately not persisted.
 *
 * The bottom bar's centre button has to trigger a creation flow that lives on
 * another screen. Rather than encoding that in the URL or drilling props
 * through the router, the bar raises an intent and the destination screen
 * consumes it on mount.
 */
interface UiStore {
  /**
   * The day the centre button meant, or null when it has not been pressed.
   *
   * It used to be a bare boolean, and the Planner filled in the day from
   * whichever one it happened to have selected. Pressed from Progress, where
   * the Planner is not even mounted, that selection fell back to the first day
   * of the window: "Add to Snack 1, Monday 17 August", on a Saturday the 29th.
   *
   * Carrying the date makes the button mean what it looks like it means,
   * today, from wherever it is pressed.
   */
  quickAdd: string | null
  requestQuickAdd: (date: string) => void
  clearQuickAdd: () => void
  /**
   * Whose target the screens compare food against.
   *
   * Per device and deliberately not synced, unlike almost everything else
   * here. Two people, two phones: this is a fact about who is holding one, not
   * about the household, and putting it in the profile would mean switching to
   * Oli's target on your phone switched yours on theirs.
   */
  viewingAs: PersonId
  setViewingAs: (who: PersonId) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      quickAdd: null,
      requestQuickAdd: (date) => set({ quickAdd: date }),
      clearQuickAdd: () => set({ quickAdd: null }),

      viewingAs: 'arany',
      setViewingAs: (who) => set({ viewingAs: who }),
    }),
    {
      name: 'bite-buddy-ui-v1',
      storage: safeStorage<UiStore>(),
      // The intent from the centre button is about this second and must not
      // survive a reload; who you are is about this device and should.
      partialize: (state) => ({ viewingAs: state.viewingAs }) as UiStore,
    },
  ),
)
