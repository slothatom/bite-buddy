/**
 * The artwork's real filenames, written by `npm run icons`.
 *
 * Do not edit. Every name carries a hash of the file's own contents, so a
 * changed picture is a changed address and nothing that caches by URL, from a
 * home screen to a service worker, can go on drawing the previous one.
 *
 * `npm run icons:check` fails the build if these names and `public/` have
 * drifted apart in either direction.
 */
export interface AppIcon {
  src: string
  sizes: string
  type: string
  purpose?: string
}

export interface LaunchScreen {
  src: string
  media: string
}

/** The tab icon, as vector. */
export const FAVICON = 'favicon.56e1741c.svg'

/** What iOS puts on the home screen, read once when the app is added. */
export const APPLE_TOUCH_ICON = 'icon-192.14f2cfc8.png'

/** What a notification is drawn with, which the service worker asks for. */
export const NOTIFICATION_ICON = 'icon-192.14f2cfc8.png'

/** The manifest's icon list. */
export const ICONS: AppIcon[] = [
  { src: 'icon-192.14f2cfc8.png', sizes: '192x192', type: 'image/png' },
  { src: 'icon-512.f8f8870b.png', sizes: '512x512', type: 'image/png' },
  { src: 'icon-maskable-512.4f2c8ca2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

/** iOS launch screens, one per device it knows about. */
export const SPLASHES: LaunchScreen[] = [
  { src: 'splash-750x1334.c2ff914c.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
  { src: 'splash-828x1792.e0388cd6.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
  { src: 'splash-1170x2532.77d50b1a.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1179x2556.39d6638c.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1242x2688.82b3c6d9.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1290x2796.50ea4cb4.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
]
