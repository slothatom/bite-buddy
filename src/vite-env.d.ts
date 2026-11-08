/// <reference types="vite/client" />

/** Stamped in at build time, see the `define` block in vite.config.ts. */
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

/**
 * A plan archive built into the bundle, for the end-to-end tests only.
 *
 * Exists only when the build is run with `VITE_E2E_ARCHIVE=1`, which
 * playwright.config.ts does and nothing else should. See vite.config.ts.
 */
declare module 'virtual:e2e-archive' {
  const archive: unknown
  export default archive
}
