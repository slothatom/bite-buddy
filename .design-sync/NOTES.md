# design-sync notes for bite-buddy

Repo-specific things a future sync should know. Read this before touching
`.design-sync/config.json`.

## What this repo is

Bite Buddy is an **application**, not a published component library. There is
no `dist/` of components, no package entry, no declaration tree, and
`node_modules/bite-buddy` does not exist because npm will not self-install.
Three committed pieces stand in for what a real design-system package would
ship, and all three are named in `buildCmd`:

- **`.design-sync/entry.tsx`** is the export list, written by hand. It is
  passed to the converter as `--entry`, which also makes the repo root the
  package directory. Two components would be misnamed without it: `Mascot.tsx`
  exports `Zig`, and `Chart.tsx` exports `DayChart`. Adding a component means
  adding it here **and** to `componentSrcMap`.
- **`.design-sync/build-types.mjs`** runs `tsc --emitDeclarationOnly` over that
  entry. Without it every component's `.d.ts` in the design system reads
  `[key: string]: unknown`, which is what the design agent is handed as the
  API contract, so it would be coding against nothing. tsc reports three
  `import.meta.env` errors and emits anyway; the script says so and carries on.
- **`.design-sync/prepare-css.mjs`** stages the compiled stylesheet.
  `src/index.css` is Tailwind v4 source and opens with `@import 'tailwindcss'`,
  so shipping it would ship an unresolvable import and no utility classes at
  all. Vite's compiled output carries a content hash in its filename, so it is
  copied to a stable path with its woff2 files beside it: the compiled CSS
  refers to them relatively, and without them every design would render in a
  fallback font.

`package.json` carries a `types` field pointing at the generated tree. That is
the only change design-sync makes to a file outside `.design-sync/`.

## Fixed along the way

- **`stripDiacritics` in `src/lib/units.ts` used raw combining marks inside a
  regex character class.** A regex literal is parsed before anything runs, so
  served anywhere that does not declare utf-8 the range came out reversed and
  the whole bundle failed to parse: `window.BiteBuddy` was never assigned. The
  app's own page declares utf-8; a bundle of these components handed to
  something else cannot assume that. Now written as `\u` escapes.
- **Playwright version.** This container caches chromium build 1194, and the
  repo's own `@playwright/test` 1.62.1 wants 1234. `playwright@1.56.0` is
  installed into `.ds-sync/` for the render check, and every validate and
  capture run needs `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

## Previews

- Three components need a router: `MobileNav`, `Sidebar` and `UndoBar`. Rather
  than wrap each preview, `PreviewShell` in `entry.tsx` puts a `MemoryRouter`
  around every card, wired as `cfg.provider` and excluded from the component
  list with a null `componentSrcMap` entry.
- The eight overlays (`AddFoodModal`, `AddEntryModal`, `FoodEditor`,
  `RecipeEditor`, `FillGaps`, `WeekTemplates`, `WhenPicker`, `BarcodeScanner`)
  are set to `cardMode: single` at 1100x820 so the open state renders inside
  its card instead of escaping it.
- `MacroBar`'s `unit` defaults to `'g'`, so a calorie figure passed through it
  comes out labelled "1800g". Calories get the ring, not a bar.
