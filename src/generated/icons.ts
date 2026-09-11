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
export const FAVICON = 'favicon.62cf5574.svg'

/** What iOS puts on the home screen, read once when the app is added. */
export const APPLE_TOUCH_ICON = 'icon-192.0b5c1d84.png'

/** What a notification is drawn with, which the service worker asks for. */
export const NOTIFICATION_ICON = 'icon-192.0b5c1d84.png'

/** The manifest's icon list. */
export const ICONS: AppIcon[] = [
  { src: 'icon-192.0b5c1d84.png', sizes: '192x192', type: 'image/png' },
  { src: 'icon-512.84bad40d.png', sizes: '512x512', type: 'image/png' },
  { src: 'icon-maskable-512.ae4a9c3e.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

/** iOS launch screens, one per device it knows about. */
export const SPLASHES: LaunchScreen[] = [
  { src: 'splash-750x1334.ca94fa16.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
  { src: 'splash-828x1792.b8a73c2a.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
  { src: 'splash-1170x2532.afeaeaa5.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1179x2556.7f9360c5.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1242x2688.b1ad85b6.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
  { src: 'splash-1290x2796.6c29b433.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
]
