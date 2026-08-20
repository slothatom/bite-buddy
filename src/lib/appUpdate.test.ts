import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isUpgrade, watchForUpdates } from './appUpdate'

/**
 * The reload is the only thing in the app that can make it impossible to open,
 * so the guard around it is worth pinning down.
 */

describe('deciding whether a worker taking over is an update', () => {
  it('is an update when something was already serving the page', () => {
    expect(isUpgrade(true)).toBe(true)
  })

  it('is not an update on a device seeing the app for the first time', () => {
    expect(isUpgrade(false)).toBe(false)
  })
})

describe('watching for a new version', () => {
  const reload = vi.fn()
  let listeners: Array<() => void> = []

  function installServiceWorker(controller: object | null) {
    listeners = []
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller,
        ready: Promise.resolve({ update: vi.fn() }),
        addEventListener: (event: string, fn: () => void) => {
          if (event === 'controllerchange') listeners.push(fn)
        },
      },
    })
    vi.stubGlobal('window', { location: { reload } })
    vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' })
  }

  beforeEach(() => reload.mockClear())
  afterEach(() => vi.unstubAllGlobals())

  it('reloads once when a new worker takes over a running app', () => {
    installServiceWorker({})
    watchForUpdates()

    for (const fire of listeners) fire()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload on a first install', () => {
    // Nothing was serving the page, so this is the app arriving, not changing.
    installServiceWorker(null)
    watchForUpdates()

    for (const fire of listeners) fire()
    expect(reload).not.toHaveBeenCalled()
  })

  it('never reloads twice, however many times it is told to', () => {
    // A reload loop would leave the app unopenable, with no way in to fix it.
    installServiceWorker({})
    watchForUpdates()

    for (let i = 0; i < 5; i++) for (const fire of listeners) fire()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing at all where there is no service worker', () => {
    vi.stubGlobal('navigator', {})
    expect(() => watchForUpdates()).not.toThrow()
    expect(reload).not.toHaveBeenCalled()
  })
})
