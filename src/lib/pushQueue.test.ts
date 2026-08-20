import { describe, it, expect, vi } from 'vitest'
import { PushQueue, type PushQueueState } from './pushQueue'

/**
 * The queue's whole job is what happens when delivery fails, so that is what
 * these exercise. Time is injected rather than waited on — a test that sleeps
 * for a 60-second backoff is a test nobody runs.
 */

/** Drives the queue with a controllable clock. */
function harness(push: (key: string) => Promise<void>, opts = {}) {
  const timers: Array<{ fn: () => void; ms: number }> = []
  const states: PushQueueState[] = []

  const queue = new PushQueue({
    push,
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1 },
    cancel: (h) => { timers[h as number] = { fn: () => {}, ms: 0 } },
    onChange: (s) => states.push(s),
    ...opts,
  })

  return {
    queue,
    states,
    /** Fires the most recently scheduled callback. */
    async tick() {
      const next = timers[timers.length - 1]
      timers.length = 0
      next?.fn()
      await Promise.resolve()
      await Promise.resolve()
    },
    lastDelay: () => timers[timers.length - 1]?.ms,
  }
}

describe('PushQueue', () => {
  it('coalesces a burst of edits into one push', async () => {
    const push = vi.fn().mockResolvedValue(undefined)
    const h = harness(push)

    h.queue.mark('meals')
    h.queue.mark('meals')
    h.queue.mark('meals')
    await h.tick()

    expect(push).toHaveBeenCalledTimes(1)
    expect(h.queue.state.pending).toEqual([])
  })

  it('pushes each changed store once', async () => {
    const push = vi.fn().mockResolvedValue(undefined)
    const h = harness(push)

    h.queue.mark('meals')
    h.queue.mark('foods')
    await h.tick()

    expect(push.mock.calls.map((c) => c[0]).sort()).toEqual(['foods', 'meals'])
  })

  it('keeps a failed change pending instead of dropping it', async () => {
    const push = vi.fn().mockRejectedValue(new Error('offline'))
    const h = harness(push)

    h.queue.mark('meals')
    await h.tick()

    // The original bug: this used to report an error and forget the change.
    expect(h.queue.state.pending).toEqual(['meals'])
    expect(h.queue.state.failures).toBe(1)
  })

  it('retries a failure, and stops retrying once it lands', async () => {
    const push = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    const h = harness(push)

    h.queue.mark('meals')
    await h.tick()
    expect(h.queue.state.pending).toEqual(['meals'])

    await h.tick()
    expect(push).toHaveBeenCalledTimes(2)
    expect(h.queue.state.pending).toEqual([])
    expect(h.queue.state.failures).toBe(0)
  })

  it('backs off further on each consecutive failure, up to a ceiling', async () => {
    const push = vi.fn().mockRejectedValue(new Error('offline'))
    const h = harness(push, { backoffMs: 1_000, maxBackoffMs: 4_000 })

    h.queue.mark('meals')
    await h.tick()
    expect(h.lastDelay()).toBe(1_000)

    await h.tick()
    expect(h.lastDelay()).toBe(2_000)

    await h.tick()
    expect(h.lastDelay()).toBe(4_000)

    await h.tick()
    expect(h.lastDelay()).toBe(4_000)
  })

  it('flush sends immediately rather than waiting out the backoff', async () => {
    const push = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const h = harness(push)

    h.queue.mark('meals')
    await h.tick()
    expect(h.queue.state.pending).toEqual(['meals'])

    // What coming back online does.
    await h.queue.flush()
    expect(h.queue.state.pending).toEqual([])
  })

  it('does not clear an edit made while its push was in flight', async () => {
    let release: () => void = () => {}
    const inFlight = new Promise<void>((r) => { release = r })
    const push = vi.fn().mockReturnValue(inFlight)
    const h = harness(push)

    h.queue.mark('meals')
    await h.tick()

    // The user changes the same store again before the server answers.
    h.queue.mark('meals')
    release()
    await Promise.resolve()
    await Promise.resolve()

    // Clearing it here would lose the second edit: the push that succeeded did
    // not contain it.
    expect(h.queue.state.pending).toEqual(['meals'])
  })

  it('reports what is still unsaved', async () => {
    const push = vi.fn().mockRejectedValue(new Error('offline'))
    const h = harness(push)

    h.queue.mark('meals')
    h.queue.mark('body')
    await h.tick()

    expect(h.queue.state.pending.sort()).toEqual(['body', 'meals'])
    expect(h.states.at(-1)?.sending).toBe(false)
  })

  it('stops cleanly', async () => {
    const push = vi.fn().mockResolvedValue(undefined)
    const h = harness(push)

    h.queue.mark('meals')
    h.queue.stop()
    await h.tick()

    expect(push).not.toHaveBeenCalled()
  })
})
