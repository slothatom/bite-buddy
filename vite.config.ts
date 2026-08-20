import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bite Buddy',
        short_name: 'Bite Buddy',
        description: 'Plan your week. Eat well. Feel good. A bold, friendly offline meal planner.',
        theme_color: '#6D5BD0',
        background_color: '#FAF7F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The barcode library is 477 kB and useless offline anyway. Scanning a
        // product means looking it up over the network. Precaching it would put
        // it on every device that never opens the scanner.
        globIgnores: ['**/esm-*.js'],
        runtimeCaching: [
          {
            // Nutrition lookups are a convenience; a stale answer beats none,
            // but the app must still work with no network at all.
            urlPattern: /^https:\/\/(api\.nal\.usda\.gov|world\.openfoodfacts\.org)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nutrition-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
