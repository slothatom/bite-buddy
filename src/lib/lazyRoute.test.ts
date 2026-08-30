import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { lazyRoute, shouldReload } from './lazyRoute'

/**
 * The commonest crash in this app is not a bug in a screen. It is a chunk that
 * no longer exists because a deploy landed under an open page, and the old
 * answer to it was a crash screen whose only working button deleted your data.
 */
describe('a screen that is no longer on the server', () => {
  const reload = vi.fn()
  let store: Record<string, string> = {}

  // Stubbed rather than run under jsdom: the suite is a node one, and what
  // this needs is two objects with three methods between them.
  const fakeStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }

  beforeEach(() => {
    store = {}
    reload.mockClear()
    vi.stubGlobal('sessionStorage', fakeStorage)
    vi.stubGlobal('window', { location: { reload } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads normally when the chunk is there', async () => {
    const load = lazyRoute(() => Promise.resolve('the screen'))
    await expect(load()).resolves.toBe('the screen')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads rather than throwing when the chunk has gone', async () => {
    const load = lazyRoute(() => Promise.reject(
      new Error('Failed to fetch dynamically imported module: /assets/Recipes-abc.js')))

    // Never settles, so React holds the Suspense fallback while the browser
    // navigates rather than flashing a crash screen on the way out.
    let settled = false
    void load().then(() => { settled = true }, () => { settled = true })
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
  })

  it('gives up rather than looping when the reload did not help', async () => {
    // A genuinely broken build would otherwise reload for ever, which is worse
    // than a crash screen because there is no way to read it.
    const fail = () => lazyRoute(() => Promise.reject(new Error('still missing')))()

    void fail().catch(() => {})
    await Promise.resolve()
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)

    await expect(fail()).rejects.toThrow('still missing')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('is willing again once the moment has passed', () => {
    // Twenty seconds later is a different problem, not the same loop.
    const now = Date.now()
    expect(shouldReload(now)).toBe(true)
    store['bite-buddy-chunk-reload'] = String(now)
    expect(shouldReload(now)).toBe(false)
    expect(shouldReload(now + 60_000)).toBe(true)
  })

  it('still recovers when the browser refuses storage', () => {
    // A private window blocks sessionStorage, and that is one of the
    // situations this app is explicitly built to survive.
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(shouldReload(Date.now())).toBe(true)
  })
})
