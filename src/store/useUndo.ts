import { create } from 'zustand'

/**
 * One step back, for a short while.
 *
 * The app deletes things: a meal off a day, a whole day, a line off the
 * shopping list, the list itself. Most of that had no confirmation and none of
 * it had a way back, so a mis-tap on a phone lost work that only existed here.
 * Two ways to fix that. A confirmation on everything trains people to dismiss
 * confirmations, which is worse than none. This is the other one: the action
 * happens immediately, and for the next few seconds it can be taken back.
 *
 * A single slot rather than a stack, deliberately. A stack invites a mental
 * model the app cannot honour, because the state it would restore into has
 * moved on: undoing two deletions ago, after adding three meals in between,
 * either loses the three or restores into a day that no longer exists. One
 * step, expiring, is a promise that can be kept.
 *
 * `useUserStore`'s `notice` is not this. That records moments the app has
 * already shown once and carries no payload, so it cannot put anything back.
 */

/** How long an offer stands. Long enough to read the sentence and reach for it. */
export const UNDO_SECONDS = 8

export interface UndoOffer {
  /** New for every offer, so a re-offer of the same wording re-animates. */
  id: string
  /**
   * The screen it was offered on.
   *
   * An undo is about the thing you just did on the screen you were on, and it
   * travelled: removing a meal and then opening Settings put the offer over
   * the restore confirmation, which is the one card on that screen that has to
   * be read before it is answered. Off its own screen the offer is at best
   * noise and at worst in the way.
   */
  at: string
  /**
   * What happened, in the past tense and naming the thing: "Removed Cabbage
   * soup with wholemeal bread". "Item deleted" tells you nothing you did not
   * just watch happen, and cannot be checked against what you meant to do.
   */
  what: string
  /** Puts it back. Called at most once, and never after it expires. */
  restore: () => void
}

interface UndoStore {
  offer: UndoOffer | null
  /**
   * Makes the offer, replacing any offer already standing.
   *
   * Replacing rather than queueing: two deletions in quick succession means
   * the second one is what the hand is still on, and offering to undo the
   * first would put back something the person has already moved past.
   */
  offerUndo: (what: string, restore: () => void) => void
  /** Takes the offer. Runs the restore once and clears the slot. */
  takeUndo: () => void
  /** Lets it go, either by the timer or by being dismissed. */
  clearUndo: (id?: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined
let counter = 0

/**
 * Which screen this is, without a router.
 *
 * The store is not inside one and should not need to be. HashRouter puts the
 * route in the hash, so it is readable from the address directly, and in a
 * test environment with no window at all there is one screen and this is it.
 */
function routeNow(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.hash.replace(/^#/, '').split('?')[0] || '/'
}

export const useUndo = create<UndoStore>()((set, get) => ({
  offer: null,

  offerUndo: (what, restore) => {
    if (timer) clearTimeout(timer)
    counter += 1
    const id = `undo-${counter}`
    set({ offer: { id, what, restore, at: routeNow() } })
    timer = setTimeout(() => get().clearUndo(id), UNDO_SECONDS * 1000)
  },

  takeUndo: () => {
    const { offer } = get()
    if (!offer) return
    if (timer) clearTimeout(timer)
    timer = undefined
    // Cleared before the restore runs, so a restore that offers its own undo
    // is not immediately wiped out by this line.
    set({ offer: null })
    offer.restore()
  },

  clearUndo: (id) => {
    // An id that has been replaced means this is a stale timer firing over a
    // newer offer, which would take away a chance the person can still see.
    if (id && get().offer?.id !== id) return
    if (timer) clearTimeout(timer)
    timer = undefined
    set({ offer: null })
  },
}))

/**
 * Offers an undo, from anywhere, without a hook.
 *
 * The call sites are mostly inside event handlers that already have the store
 * they are deleting from, and threading a second hook through each of them
 * adds nothing.
 */
export function offerUndo(what: string, restore: () => void): void {
  useUndo.getState().offerUndo(what, restore)
}
