import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { APPLE_TOUCH_ICON, FAVICON, ICONS, SPLASHES } from './src/generated/icons.ts'

/**
 * Puts the artwork's links into the page, from the one place that knows their
 * names.
 *
 * These used to be typed into index.html by hand, from a block this repo's
 * icon script printed for somebody to paste. That was survivable while the
 * files were called `icon-192.png` forever; it is not survivable now that the
 * name carries a hash, because a stale paste is a page pointing at artwork
 * that no longer exists. So nobody pastes anything.
 */
function artworkLinks(): Plugin {
  return {
    name: 'bite-buddy-artwork-links',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: FAVICON }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: APPLE_TOUCH_ICON }, injectTo: 'head' },
      ...SPLASHES.map(({ src, media }) => ({
        tag: 'link',
        attrs: { rel: 'apple-touch-startup-image', href: src, media },
        injectTo: 'head' as const,
      })),
    ],
  }
}

export default defineConfig({
  // Relative, so the built app runs from wherever it is put (a local server,
  // a folder on a phone, a USB stick) without being told its own address.
  base: './',

  // Stamped into the bundle so the running app can say which build it is. Without
  // this, "did the deploy land?" is unanswerable from the device it landed on.
  define: {
    __BUILD_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    artworkLinks(),
    VitePWA({
      // Hand written rather than generated, because a push arrives at the
      // worker and a generated file has nowhere to put the handler. The
      // caching it used to generate is transcribed in src/sw.ts, which is now
      // the only thing standing between the app and a shop with no signal.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [FAVICON],
      manifest: {
        name: 'Bite Buddy',
        short_name: 'Bite Buddy',
        description: 'Plan your week. Eat well. Feel good. A bold, friendly offline meal planner.',
        theme_color: '#14B8A6',
        background_color: '#FAF7F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        // Named by `npm run icons`, each with a hash of its own contents, so a
        // redrawn mascot arrives at an address no phone has seen before. The
        // maskable one is its own file, inset to the safe zone: this used to
        // offer the full-bleed icon for both, and a phone that draws round
        // icons cut the mascot's ears off.
        icons: ICONS,
      },
      // What to precache. The runtime caching that used to live beside this
      // now lives in src/sw.ts, because injectManifest builds the worker from
      // that file and only the file list comes from here.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The barcode library is 477 kB and useless offline anyway. Scanning a
        // product means looking it up over the network. Precaching it would put
        // it on every device that never opens the scanner.
        //
        // The launch screens are the same argument: six of them, 244 kB, and a
        // phone matches exactly one. iOS reads it from the ordinary HTTP cache
        // when the app is opened from the home screen, so precaching all six
        // put a quarter of a megabyte of pictures of other people's phones on
        // every device.
        globIgnores: ['**/esm-*.js', '**/splash-*.png'],
      },
    }),
  ],
})
