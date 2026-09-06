import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { otherTabWrote } from './registry'
import { usePantryStore } from './usePantryStore'

/**
 * A minimal localStorage, because these tests run in node.
 *
 * The subject is what an event from another tab means, not the plumbing that
 * receives it, so the DOM is not needed. Storage is, because re-reading it is
 * the whole behaviour.
 */
function stubStorage() {
  const held = new Map<string, string>()
  const storage = {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => { held.set(k, v) },
    removeItem: (k: string) => { held.delete(k) },
    clear: () => held.clear(),
    key: (i: number) => [...held.keys()][i] ?? null,
    get length() { return held.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  return held
}

describe('a write from another tab', () => {
  let held: Map<string, string>
  beforeEach(() => { held = stubStorage() })
  afterEach(() => { Reflect.deleteProperty(globalThis, 'localStorage') })

  const pantry = (foodId: string) => JSON.stringify({
    version: 3, state: { items: [{ foodId, staple: true, updatedAt: '2026-09-06T10:00:00Z' }] },
  })

  it('is read, rather than quietly overwritten later', () => {
    // Every store writes its whole slice on every change and nothing was
    // listening, so two tabs each held their own copy from whenever they
    // loaded, and the next to touch anything wrote its stale slice over the
    // other's work. A tab left open since the morning flattened an afternoon.
    usePantryStore.setState({ items: [] })
    held.set('bite-buddy-pantry', pantry('olive-oil'))

    otherTabWrote('bite-buddy-pantry')

    expect(usePantryStore.getState().items.map((i) => i.foodId)).toEqual(['olive-oil'])
  })

  it('leaves this tab alone when the key belongs to something else', () => {
    usePantryStore.setState({ items: [{ foodId: 'salt', updatedAt: '' }] })
    held.set('bite-buddy-pantry', pantry('olive-oil'))

    otherTabWrote('some-other-app')

    expect(usePantryStore.getState().items.map((i) => i.foodId)).toEqual(['salt'])
  })

  it('re-reads everything when storage is cleared outright', () => {
    // A null key is the whole of storage going, which is a thing a person can
    // do from browser settings with the app open in front of them.
    usePantryStore.setState({ items: [{ foodId: 'salt', updatedAt: '' }] })
    held.set('bite-buddy-pantry', pantry('olive-oil'))

    otherTabWrote(null)

    expect(usePantryStore.getState().items.map((i) => i.foodId)).toEqual(['olive-oil'])
  })
})
