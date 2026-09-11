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

## What the previews had to work around

Every card in this design system is hand-authored, and four of the things that
cost a debugging cycle are structural rather than per-component. A future run
should read these before writing a single preview.

- **A preview cannot reach the app's stores.** The preview compiler sends an
  import that resolves to an exported component's module to the bundle global,
  and bundles everything else from source, so
  `import { useUndo } from '../../src/store/useUndo'` compiles a **second copy**
  of the store. Calling `setState` on it does nothing to the component in the
  bundle, which reads the bundle's copy. Verified: it renders a blank card.
  Two ways in are used instead. Seed `localStorage` and call `location.reload()`
  once, because the persisted stores read storage during `_ds_bundle.js`, which
  runs before any preview line; the capture step does not mind the reload.
  Or drive a component that is already in the bundle: the undo offer is made by
  clicking a hidden `WeekTemplates`' Forget button, and the storage failure by
  making `setItem` throw and clicking `MobileNav`'s Add a meal.
  If a later run wants this to be ordinary rather than clever, export the
  stores from `entry.tsx` and the import rule redirects to them.
- **`position: fixed` resolves against the cell, not the window**, because the
  cell wrapper carries a `transform` and so becomes the containing block. A
  cell whose only child is fixed measures 0px tall and the overlay comes out
  flat. Every banner, bar and sheet here sits inside a plain sized `<div>`, and
  a `cardMode: single` override does not remove that need.
- **The capture clock is fixed at 2024-05-15.** Anything derived from `today()`
  is anchored there: `WhenPicker`'s window is 2024-05-06 to 2024-06-09,
  `FillGaps` drops earlier dates, and `AddEntryModal` only reads as a record
  when its date is on or before that day. Those three carry May 2024 fixtures;
  everything else uses the app's own September 2026.
- **`ALL_RECIPES` and `FOODS` ship in code**, so an empty store still returns
  the whole library and `FillGaps` proposes real dishes with no fixture at all.

## Known render warns, all triaged

- `Zig` before its preview existed was flagged `[RENDER_THIN]`: an SVG mascot
  with no text in it. Authored now, so the flag should not return.
- `TrendsTab`'s two cells are both its empty state at two widths. That is not a
  variants-identical failure: it is the only state reachable, see above.
- `UndoBar` has no resting card. Its resting state is `null` by design and
  would photograph blank, so both cells show a standing offer.

## Component notes worth keeping

- `CalorieRing` has no status prop: the level falls out of `value / target`
  through `targetStatus`. Below about 116px the centre figure crowds the
  stroke, because it is a fixed 28px whatever the `size`.
- `StatusPill` takes the whole label as one string; the ring joins
  `label · deltaLabel` itself.
- `TierBadge` daily and weekly share a surface colour, separated only by the
  symbol and the word. Keep a cell where those two sit together.
- `EmptyState`'s `emoji` replaces the mascot entirely, so no cell can show
  both an emoji and a mood.
- `ChipRow`'s expanded state is internal, so a card can only show the collapsed
  row and its toggle. Callers sort the active chip into the first `initial`
  themselves; the component does not.
- `Photo` renders nothing at all without the two Supabase environment
  variables: `photoUrl` resolves null in a microtask and the component returns
  null. Its cards show a recipe card and a shelf closing up around the gap,
  which is what the shipped library actually looks like. The card is about the
  environment the previews run in, not about the project: the `recipe-photos`
  bucket does exist and `photos.sql` has been run, contrary to a note that
  stood here through several sessions.
- `BarcodeScanner` lands in its camera-denied branch, which is the same branch
  a refused permission produces, so the card is the real thing.
- `AddFoodModal` with `initialTab="lookup"` and a non-empty `initialName` fires
  a live USDA and Open Food Facts request on mount, which is not deterministic
  under a network-idle capture. Its lookup cell passes no name.
- `FoodEditor` and `RecipeEditor` are two screens long and the parts worth
  grading are below the fold, so their previews scroll the panel's own scroller
  on mount.
- `DayChart` returns null on an all-null series, so an empty series is not a
  shippable cell; a gappy one is the honest version of that axis.

## Two generated declarations that are wrong

Both are harmless to the render, because esbuild does not type check, but they
are what the design agent is handed as the contract.

- `DayChart.smoothed` is typed `number[]`. The source is `(number | null)[]`
  and `smooth()` really does return nulls.
- `RecipeEditor.recipe` is typed `Recipe`, losing the `| null` that means
  "write a new one".

Fix either with a `dtsPropsFor` entry when it starts to matter.

## Conventions header drift, found 11 September 2026

`conventions.md` was validated against a fresh build this run. Three names in it
do not verify. The file is hand-owned, so nothing was rewritten; these are the
proposed edits.

- **`teal` is named as a state colour and does not exist.** The header lists
  "`coral`, `mustard`, `leaf` and `teal` for state". There is no
  `--color-teal-*` in `@theme`, and `src/index.css:65` says the green was
  deliberately named `leaf` **rather than** `teal`, "because a token called teal
  holding a green would be confusing". A design agent writing `text-teal-600`
  gets Tailwind's own default teal, not a brand colour. Proposed: drop `teal`
  from that sentence.
- **"twenty-one component utilities" is off by one.** `src/index.css` defines
  exactly 22 `@utility` rules and the header's own table lists all 22. The table
  is right; the sentence above it is wrong. Proposed: say twenty-two.
- **The ramp sentence promises more than the stylesheet ships.** `@theme`
  defines `bite`, `coral`, `leaf` and `mustard` at 50 to 900, but Tailwind v4
  only compiles the utilities the app actually uses, so the shipped
  `_ds_bundle.css` carries about forty-five of them. `bg-bite-900`,
  `bg-bite-600` and `text-coral-900` are all defined as tokens and all resolve
  to nothing in the CSS a design receives. This is the one that fails silently.
  Proposed: say that the ramps exist as `var(--color-*)` tokens, and that the
  utility classes which ship are the subset the app uses - so an unused step
  needs `style={{color: 'var(--color-bite-900)'}}` rather than a utility class.

## The mascot redraw, 11 September 2026

Bandit was redrawn from a turquoise figure to a grey raccoon with turquoise
accents, in `src/components/brand/Mascot.tsx` and again in `face()` in
`scripts/make-icons.ts`. Both drawings are hand-maintained and must be changed
together or the app and the home screen drift apart.

- **He read as a panda twice before he read as a raccoon.** The fix was not
  outline but arrangement: isolated dark patches on uniform grey fur are a
  panda at any shape. A raccoon is one dark band crossing a *pale* face, so the
  head carries a `fur-100` field with a single continuous band over it. A broad
  white forehead blaze pushed him back towards badger and had to be narrowed to
  a wedge.
- **`--color-fur-*` does not invert.** Every other colour in `index.css` has a
  dark-mode value; these three deliberately do not, because the mask has to
  stay darker than the face in both themes. The silhouette is carried by the
  grey body rather than by an outline, which is what lets the outline stay dark
  on a dark ground.
- **The icon literals are a copy of the tokens.** `FUR_PALE`, `FUR` and
  `FUR_DARK` in `make-icons.ts` duplicate `--color-fur-*` by hand, because that
  file renders outside the document where a variable means nothing. Change one,
  change the other.

## A grade trap this run walked into

`package-capture.mjs` carries grades forward from the preview's render hash,
which is computed from the preview HTML. Changing a **component** changes the
bundle, not the HTML, so every card showing the mascot kept a grade earned by
the old artwork and the tool reported "carried forward" as if nothing had
happened. Deleting `<Name>.grade.json` does not help; nor does deleting its
`<Name>.json` sidecar.

`--force` is the only thing that re-captures. After any change to component
art, re-grade the components that render it:

```sh
node .ds-sync/package-capture.mjs --out ./ds-bundle --force \
  --components Zig,Wordmark,EmptyState,ErrorBoundary,MobileNav,Sidebar,TrendsTab,FillGaps
```

That list is every component that draws Bandit, directly or through
`EmptyState`. Keep it up to date when a new card starts showing him.

## Re-sync risks

- **The mascot is drawn twice**, in `Mascot.tsx` and in `make-icons.ts`, with
  the fur colours written as tokens in one and as literals in the other. There
  is no check that the two drawings still agree; only a person looking at them
  will notice if they diverge.
- **Nothing has ever been uploaded.** `DesignSync` needs an authorisation this
  session could not obtain, so there is no project, no `projectId` in the
  config, and no `_ds_sync.json` anchor anywhere but on disk. The next run with
  authorisation creates the project and uploads everything; it will re-verify
  from scratch, which is correct rather than a failure.
- **`entry.tsx` and `componentSrcMap` are hand-maintained.** A component added
  to `src/components/` appears in neither until somebody adds it, and nothing
  fails to tell you.
- **The previews are tied to component internals**, not just to props: the
  storage keys and their shapes, `WeekTemplates`' Forget button, `MobileNav`'s
  Add a meal, the section labels the editors scroll to. Renaming any of those
  breaks a card silently, and the card still renders, just wrong.
- **Playwright is pinned by the container, not by the repo.** `playwright@1.56.0`
  in `.ds-sync/` matches this machine's cached chromium 1194. On a machine with
  a different cache, find the version whose `browsers.json` pins what is there.
- **The compiled CSS comes from `npm run build`.** Run `buildCmd` before the
  converter or the design system ships whatever stylesheet was staged last.
