/**
 * Loading a screen that may no longer exist on the server.
 *
 * The app is split per screen and served by a service worker, and those two
 * facts together have one bad interaction. After a deploy, the page in front
 * of you is still the HTML from the previous build, and that HTML names its
 * chunks by content hash. GitHub Pages replaces the whole tree on publish, so
 * the moment the new build lands the old hashes are gone. Tap a screen you had
 * not opened yet and the import 404s.
 *
 * The worker already does everything usually prescribed for this: it takes
 * over on activate, claims open pages, clears outdated precache entries, and
 * `appUpdate.ts` reloads the page when the new worker takes control. None of
 * that closes the window between the page loading and the new worker being
 * ready, and that window is exactly when somebody opens the app and taps
 * something.
 *
 * So the failure is caught where it happens. A chunk that will not load is not
 * a bug in the screen, it is this document being out of date, and the fix for
 * an out-of-date document is to fetch a new one. Reload once, and only once,
 * so a genuinely broken build cannot put the app in a reload loop.
 */

/** How long a reload counts as "just tried this", in ms. */
const RECENTLY = 20_000

const MARKER = 'bite-buddy-chunk-reload'

/**
 * Whether we have already tried a reload for this, very recently.
 *
 * Session storage rather than a module variable, because the thing being
 * guarded against is a loop *across* reloads. Wrapped, because a browser
 * refusing storage is one of the situations this app is built to survive, and
 * failing to read the guard must not stop the recovery.
 */
function reloadedJustNow(now: number): boolean {
  try {
    const at = Number(sessionStorage.getItem(MARKER) ?? 0)
    return Number.isFinite(at) && now - at < RECENTLY
  } catch {
    // No storage means no guard. One reload is still better than a dead screen,
    // and without storage there is no loop to worry about either: the marker
    // that would have caused one cannot be written.
    return false
  }
}

function markReload(now: number): void {
  try {
    sessionStorage.setItem(MARKER, String(now))
  } catch {
    // Nothing to do. See above.
  }
}

/** Exported for the test: the decision, without the reload. */
export function shouldReload(now: number): boolean {
  return !reloadedJustNow(now)
}

/**
 * Wraps a dynamic import so a missing chunk reloads instead of crashing.
 *
 * On the reload path it returns a promise that never settles. React keeps
 * showing the Suspense fallback while the browser navigates, which is a blank
 * screen for a fraction of a second rather than a crash screen the user has to
 * read and act on.
 */
export function lazyRoute<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load().catch((error: unknown) => {
    const now = Date.now()
    if (typeof window === 'undefined' || !shouldReload(now)) throw error

    markReload(now)
    window.location.reload()
    return new Promise<T>(() => {})
  })
}
