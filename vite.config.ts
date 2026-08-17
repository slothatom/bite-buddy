import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the app from /bite-buddy/, but the dev server is the
  // root of its own origin — keeping the sub-path locally only means
  // http://localhost:5173/ 404s, which is a confusing first impression.
  //
  // `vite preview` reports command: 'serve' while serving build output, so it
  // has to keep the sub-path or the built asset URLs point nowhere.
  base: command === 'build' || isPreview ? '/bite-buddy/' : '/',
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
        start_url: '/bite-buddy/',
        scope: '/bite-buddy/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Fonts are the only third-party asset the app loads.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
}))
