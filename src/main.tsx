import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bungee'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/appUpdate'

// Before the first render: a deploy that landed while the app was closed should
// be picked up on this open, not the one after it.
watchForUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
