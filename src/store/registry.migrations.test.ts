import { describe, it, expect } from 'vitest'
import { STORES } from './registry'
import { SCHEMA_VERSION } from './persist'

/**
 * Every store can carry state forward from every version it has ever written.
 *
 * `upgradeThrough` walks one step per version and a missing step returns
 * undefined, which the restore path reads as "this cannot be brought forward"
 * and refuses the whole backup over. So one store forgetting a step does not
 * break that store: it makes every older backup unreadable, for everything.
 *
 * That is exactly what happened on the version that merged the two snack
 * slots. Eight stores were given the new step and the ninth, whose chain is
 * shaped differently, was missed, and an e2e test caught it by restoring a
 * file one version old.
 */
describe('the upgrade chain', () => {
  for (const store of STORES) {
    it(`carries ${store.label} forward from every older version`, () => {
      for (let from = 1; from < SCHEMA_VERSION; from += 1) {
        const carried = store.upgrade(store.read() as object, from)
        expect(carried, `no step from version ${from}`).toBeTruthy()
      }
    })
  }
})
