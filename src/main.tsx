import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bungee'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'
import { applyTheme } from './lib/theme'
import { useUserStore } from './store/useUserStore'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
