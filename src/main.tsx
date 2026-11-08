import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bungee'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'
import { applyTheme } from './lib/theme'
import { useUserStore } from './store/useUserStore'
import { useHousehold } from './store/useHousehold'
import { useArchive } from './store/useArchive'
import { isConfigured } from './lib/supabase'
import { parseArchive } from './data/archiveFormat'

// Before the first render: a deploy that landed while the app was closed should
// be picked up on this open, not the one after it.
watchForUpdates()

/*
 * Also before the first render, and for a plainer reason: React applies the
 * theme in an effect, which runs after the browser has already painted. That
 * is one frame of a cream-coloured app for somebody who chose dark, on every
 * single launch. The store rehydrates from local storage synchronously, so the
 * answer is available here, ahead of the paint.
 */
applyTheme(useUserStore.getState().profile.theme)

/**
 * The plan archive kept on this device, in place before the first render.
 *
 * Otherwise every open would paint an app with no plans in it and then redraw
 * it a moment later, which on the Plan history screen reads as the archive
 * vanishing and coming back. Reading IndexedDB takes a few milliseconds; the
 * timeout is for the browser that never answers, so it cannot hold the app.
 *
 * The end-to-end build has no database and no upload to make, so it carries
 * a made-up archive of its own (see playwright.config.ts). The condition is a
 * build-time constant, so in every other build the import is dead code and
 * the file is not in the bundle at all; scripts/check-bundle.ts makes sure.
 */
async function restoreArchive() {
  await useArchive.getState().restore(useHousehold.getState().household?.id ?? null)
  if (import.meta.env.VITE_E2E_ARCHIVE && !isConfigured && useArchive.getState().status === 'idle') {
    const { default: bundled } = await import('virtual:e2e-archive')
    await useArchive.getState().upload(JSON.stringify(parseArchive(bundled)), null)
  }
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void Promise.race([
  restoreArchive().catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).then(render)
