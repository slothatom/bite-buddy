/**
 * The queue of local changes waiting to reach the server.
 *
 * This exists because of a specific hole in the first version of sync: a push
 * that failed was announced as an error and then forgotten. Go offline, change
 * a meal, close the tab, and unless you happened to change something else
 * later, that edit never left the device. Nothing retried it.
 *
 * So changes are now *marked* rather than pushed directly, and the queue owns
 * getting them there: coalescing bursts, retrying with backoff, and holding on
 * to anything it could not deliver. It reports what is still pending so the app
 * can say so rather than implying everything is saved.
 *
 * Kept free of Supabase and of real timers so it can be tested properly, the
 * failure modes here are all about time and retries, which are miserable to
 * exercise through a network client.
 */

export interface PushQueueOptions {
  /** Deliver one key. Rejecting means "not delivered"; it will be retried. */
  push: (key: string) => Promise<void>
  /** Coalescing window for a burst of edits. */
  debounceMs?: number
  /** First retry delay after a failure; doubles up to maxBackoffMs. */
  backoffMs?: number
  maxBackoffMs?: number
  /** Injected so tests can drive time without waiting for it. */
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
  onChange?: (state: PushQueueState) => void
}

export interface PushQueueState {
  /** Keys with changes that have not been accepted by the server yet. */
  pending: string[]
  /** True while a push is in flight. */
  sending: boolean
  /** Consecutive failures; zero once anything succeeds. */
  failures: number
}

export class PushQueue {
  private readonly opts: Required<Omit<PushQueueOptions, 'onChange'>> & Pick<PushQueueOptions, 'onChange'>
  /**
   * Key → revision. The revision increments on every mark, so a push that
   * succeeds can tell whether the key changed again while it was in flight and
   * leave it pending if so. Without it, a slow push silently swallows any edit
   * made during it.
   */
  private dirty = new Map<string, number>()
  private revision = 0
  private timer: unknown = null
  private sending = false
  private failures = 0
  private stopped = false

  constructor(options: PushQueueOptions) {
    this.opts = {
      debounceMs: 800,
      backoffMs: 2_000,
      maxBackoffMs: 60_000,
      schedule: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...options,
    }
  }

  get state(): PushQueueState {
    return { pending: [...this.dirty.keys()], sending: this.sending, failures: this.failures }
  }

  /** Records that a key has local changes to deliver. */
  mark(key: string): void {
    if (this.stopped) return
    this.dirty.set(key, ++this.revision)
    this.announce()
    this.arm(this.opts.debounceMs)
  }

  /**
   * Attempts every pending key now, ignoring the debounce.
   *
   * Call when something suggests the network is back, coming online, the tab
   * becoming visible again, rather than waiting out the backoff.
   */
  async flush(): Promise<void> {
    if (this.stopped || this.sending || !this.dirty.size) return
    this.disarm()

    this.sending = true
    this.announce()

    const attempting = [...this.dirty.entries()]
    let failed = false

    for (const [key, revision] of attempting) {
      // Checked before the push as well as after it. Only checking after meant
      // that stopping mid-flush still sent one more document, which after a
      // sign-out is a write from a session that is over.
      if (this.stopped) return
      try {
        await this.opts.push(key)
        // Only clear it if nothing changed while the push was in flight, the
        // request that just succeeded did not contain a later edit.
        if (this.dirty.get(key) === revision) this.dirty.delete(key)
      } catch {
        failed = true
      }
      if (this.stopped) return
    }

    this.sending = false
    this.failures = failed ? this.failures + 1 : 0
    this.announce()

    // Anything left is a delivery that failed, so come back for it.
    if (this.dirty.size) this.arm(this.backoff())
  }

  stop(): void {
    this.stopped = true
    this.disarm()
  }

  /** The delay before the next retry, doubling per consecutive failure. */
  private backoff(): number {
    const grown = this.opts.backoffMs * 2 ** Math.max(0, this.failures - 1)
    return Math.min(grown, this.opts.maxBackoffMs)
  }

  private arm(ms: number) {
    this.disarm()
    this.timer = this.opts.schedule(() => {
      this.timer = null
      void this.flush()
    }, ms)
  }

  private disarm() {
    if (this.timer !== null) {
      this.opts.cancel(this.timer)
      this.timer = null
    }
  }

  private announce() {
    this.opts.onChange?.(this.state)
  }
}
