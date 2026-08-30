import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useUndo, UNDO_SECONDS, offerUndo } from './useUndo'

describe('one step back, for a short while', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUndo.setState({ offer: null })
  })
  afterEach(() => {
    useUndo.getState().clearUndo()
    vi.useRealTimers()
  })

  it('offers what happened, in words that name the thing', () => {
    offerUndo('Removed Cabbage soup', () => {})
    expect(useUndo.getState().offer?.what).toBe('Removed Cabbage soup')
  })

  it('puts it back, once', () => {
    const restore = vi.fn()
    offerUndo('Removed a meal', restore)
    useUndo.getState().takeUndo()
    useUndo.getState().takeUndo()

    expect(restore).toHaveBeenCalledTimes(1)
    expect(useUndo.getState().offer).toBeNull()
  })

  it('stops offering after the window closes', () => {
    const restore = vi.fn()
    offerUndo('Cleared Thursday', restore)

    vi.advanceTimersByTime(UNDO_SECONDS * 1000 - 1)
    expect(useUndo.getState().offer).not.toBeNull()

    vi.advanceTimersByTime(1)
    expect(useUndo.getState().offer).toBeNull()
    expect(restore, 'expiring must not restore anything').not.toHaveBeenCalled()
  })

  it('replaces the standing offer rather than queueing behind it', () => {
    const first = vi.fn()
    const second = vi.fn()
    offerUndo('Removed the soup', first)
    offerUndo('Removed the bread', second)

    expect(useUndo.getState().offer?.what).toBe('Removed the bread')
    useUndo.getState().takeUndo()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does not let the first offer’s timer close the second one early', () => {
    offerUndo('Removed the soup', () => {})
    vi.advanceTimersByTime(UNDO_SECONDS * 1000 - 500)
    offerUndo('Removed the bread', () => {})

    // The first timer would have fired half a second from here.
    vi.advanceTimersByTime(1000)
    expect(useUndo.getState().offer?.what).toBe('Removed the bread')
  })

  it('lets a restore offer its own undo without wiping it out', () => {
    // Restoring a day is itself a change somebody might not have meant, so a
    // restore is allowed to leave an offer behind. Clearing the slot after
    // running the restore, rather than before, threw that away.
    offerUndo('Cleared Thursday', () => offerUndo('Put Thursday back', () => {}))
    useUndo.getState().takeUndo()

    expect(useUndo.getState().offer?.what).toBe('Put Thursday back')
  })

  it('remembers which screen it was offered on', () => {
    // Off its own screen the offer is noise, and on Settings it landed on top
    // of the one card that has to be read before it is answered.
    offerUndo('Removed the soup', () => {})
    expect(useUndo.getState().offer?.at).toBe('/')
  })

  it('ignores a dismissal aimed at an offer that has already gone', () => {
    offerUndo('Removed the soup', () => {})
    useUndo.getState().clearUndo('undo-does-not-exist')
    expect(useUndo.getState().offer).not.toBeNull()
  })
})
