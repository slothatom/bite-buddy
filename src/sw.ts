/// <reference lib="webworker" />

/**
 * The service worker, written by hand rather than generated.
 *
 * It used to be generated: `generateSW` produced the whole thing from the
 * config in vite.config.ts and nobody had to read a line of it. That stops
 * working the moment the app needs to receive a push, because a push arrives
 * at the worker and there is nowhere in a generated file to put the handler.
 *
 * So the caching below is the generated behaviour, transcribed. It has to
 * match: this file is now the only thing standing between you and an app that
 * does not open in a shop with no signal, and a mistake here is invisible until
 * somebody is standing in one.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

/** What the payload carries. Everything else about it is the sender's business. */
interface Note {
  title: string
  body: string
  tag: string
  path: string
}

// ─── The app itself ──────────────────────────────────────────────────────────

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

/**
 * Nutrition lookups are a convenience; a stale answer beats none, but the app
 * must still work with no network at all.
 */
registerRoute(
  ({ url }) => /^https:\/\/(api\.nal\.usda\.gov|world\.openfoodfacts\.org)\//.test(url.href),
  new NetworkFirst({
    cacheName: 'nutrition-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
)

/**
 * Take over immediately, which is what `registerType: 'autoUpdate'` did before.
 * `src/lib/appUpdate.ts` reloads the open page when that happens, so a deploy
 * lands the first time you look at the app rather than days later.
 */
self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })

// ─── Being told something ────────────────────────────────────────────────────

/**
 * A push arrives whether or not the app is open, which is the entire point.
 *
 * Android will show its own "This site has been updated in the background"
 * notice if a push arrives and nothing is displayed, so every path here has to
 * end in a notification, including the paths where the payload is missing or
 * unreadable. A silent failure would be louder than a real notification.
 */
self.addEventListener('push', (event) => {
  const note = read(event.data)
  event.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      // Same tag replaces rather than stacks: two changes to the week while
      // your phone was in your pocket is one line on the lock screen.
      tag: note.tag,
      data: { path: note.path },
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      // Nothing here is urgent enough to buzz twice for.
      renotify: false,
    } as NotificationOptions),
  )
})

function read(data: PushMessageData | null): Note {
  const fallback: Note = {
    title: 'Bite Buddy',
    body: 'Something changed.',
    tag: 'bite-buddy',
    path: '/',
  }
  if (!data) return fallback
  try {
    const parsed = data.json() as Partial<Note>
    return {
      title: parsed.title || fallback.title,
      body: parsed.body || fallback.body,
      tag: parsed.tag || fallback.tag,
      path: parsed.path || fallback.path,
    }
  } catch {
    return fallback
  }
}

/**
 * Tapping it should land you on the thing it was about.
 *
 * An app already open is focused and told where to go rather than opened
 * again, because a second window of a meal planner is nobody's idea of a
 * result.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data as { path?: string } | undefined)?.path ?? '/'

  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of open) {
      if ('focus' in client) {
        await client.focus()
        client.postMessage({ type: 'notification-click', path })
        return
      }
    }
    await self.clients.openWindow(path)
  })())
})
