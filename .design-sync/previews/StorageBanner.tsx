import { useEffect } from 'react'
import { MobileNav, StorageBanner } from 'bite-buddy'

/**
 * How this cell gets a failure to show.
 *
 * The banner reads a module-level flag that only a real failed write can set,
 * and that flag lives inside the shipped bundle: importing the persistence
 * layer here would compile a second copy of it that `StorageBanner` has never
 * heard of. So the failure is made rather than faked. `setItem` is taught to
 * throw the exception the browser would throw, a component from the bundle is
 * pressed so that a store writes, and the guard reports the failure to the
 * banner the same way it would on a phone in private browsing.
 *
 * `MobileNav` is the button that does the pressing: its Meal button raises a
 * quick-add intent, which is a persisted store, which is a write. It is kept
 * out of the picture because it is the trigger, not the subject.
 */
function AFailedWrite({ quota }: { quota: boolean }) {
  useEffect(() => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function () {
      throw quota
        ? new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        : new DOMException('The operation is insecure.', 'SecurityError')
    }
    const id = setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Add a meal"]')?.click()
      Storage.prototype.setItem = write
    }, 0)
    return () => { clearTimeout(id); Storage.prototype.setItem = write }
  }, [quota])

  return (
    <div style={{ display: 'none' }}>
      <MobileNav />
    </div>
  )
}

/** The screen underneath, so the banner is over something rather than alone. */
function Screen() {
  return (
    <div style={{ paddingTop: 56, width: 560 }}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1.5">
        Wednesday 15 May
      </p>
      <div className="card p-4">
        <p className="text-sm text-ink-900">Lunch</p>
        <p className="text-xs text-ink-500 mt-0.5">Ciorba de legume 300 g, paine integrala 25 g. 640 kcal</p>
      </div>
      <div className="card p-4 mt-3">
        <p className="text-sm text-ink-900">Dinner</p>
        <p className="text-xs text-ink-500 mt-0.5">Telemea de capra 60 g, rosii, ardei. 380 kcal</p>
      </div>
    </div>
  )
}

/**
 * Storage is full.
 *
 * The one message that names a fix, because there is one: get the data out and
 * make room. Everything above the fold keeps working and looking right, which
 * is exactly why this has to be said out loud.
 */
export function StorageIsFull() {
  return (
    <div style={{ height: 300 }}>
      <StorageBanner />
      <AFailedWrite quota />
      <Screen />
    </div>
  )
}

/**
 * Storage is refused outright, which is private browsing and locked-down
 * webviews. The app runs, and nothing survives closing the tab.
 */
export function StorageIsBlocked() {
  return (
    <div style={{ height: 300 }}>
      <StorageBanner />
      <AFailedWrite quota={false} />
      <Screen />
    </div>
  )
}
