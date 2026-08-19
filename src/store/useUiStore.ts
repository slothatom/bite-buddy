import { create } from 'zustand'

/**
 * Transient UI intent, deliberately not persisted.
 *
 * The bottom bar's centre button has to trigger a creation flow that lives on
 * another screen. Rather than encoding that in the URL or drilling props
 * through the router, the bar raises an intent and the destination screen
 * consumes it on mount.
 */
interface UiStore {
  /** Set when the user taps the bottom bar's centre button. */
  quickAdd: boolean
  requestQuickAdd: () => void
  clearQuickAdd: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  quickAdd: false,
  requestQuickAdd: () => set({ quickAdd: true }),
  clearQuickAdd: () => set({ quickAdd: false }),
}))
