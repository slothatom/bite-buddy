/**
 * Picking up a new version of the app.
 *
 * The service worker serves the app from the device, which is what makes it
 * work in a shop with no signal, and it is also why a deploy could land
 * without you ever seeing it. The registration the build injects does one
 * thing: it registers the worker. So after a deploy the sequence was
 *
 *   1. you open the app, the old files are served from the cache, instantly;
 *   2. the new worker downloads in the background and takes over;
 *   3. the page you are looking at is still running the old JavaScript.
 *
 * You had to close it and come back before anything changed, and an installed
 * app on a phone is resumed rather than reloaded, so "come back" could mean
 * days. From the outside that is indistinguishable from the deploy having
 * failed.
 *
 * `controllerchange` fires the moment the new worker takes over this page.
 * Reloading there closes the gap: the first time you open the app after a
 * deploy, it blinks once and you are on the new version.
 */

/**
 * Whether a worker taking over means a new version, or just the first install.
 *
 * On a device that has never run this app there is no controller yet, and the
 * first worker claiming the page is not an update, reloading there would be a
 * reload on every first visit, and a reload loop if anything went wrong.
 */
export function isUpgrade(hadController: boolean): boolean {
  return hadController
}

/** How often to ask whether a new version has been published, in ms. */
const CHECK_EVERY = 60 * 60 * 1000

export function watchForUpdates(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Guarded twice: once on it being a real upgrade, once on not already
    // reloading. A reload loop here would make the app impossible to open.
    if (!isUpgrade(hadController) || reloading) return
    reloading = true
    window.location.reload()
  })

  // The worker only looks for a new version when the page loads. An app left
  // open on a kitchen counter never would, so ask on a timer and whenever it
  // comes back to the foreground.
  navigator.serviceWorker.ready.then((registration) => {
    const check = () => { void registration.update() }
    setInterval(check, CHECK_EVERY)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }).catch(() => {
    // No worker on this device, nothing to keep up to date.
  })
}
