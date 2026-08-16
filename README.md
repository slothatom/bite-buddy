# 🍎 Bite Buddy

*Your cosy kitchen.*

A meal planner built around one person's actual dietician plans and the Mediterranean diet.

Everything lives in the browser — no account, no server, works offline, installable on a phone.

---

## What it's built on

Bite Buddy isn't seeded with invented recipes. Its library comes from two real sources:

**14 dietician plan documents** (Jan 2021 in Hungarian, Apr–Nov 2022 in Romanian) — **97 days,
481 meals**. These are parsed into **204 named meal recipes** and **71 underlying dishes**,
every one traceable back to the line the dietician wrote.

**An 89-page Mediterranean Diet guide** — its 17 food categories, allowed-lists and serving
goals become the food database's structure, the tier badges in the food library, and the
weekly serving scoring on the Progress screen.

Three things about that source data shape the whole app:

- **The unit of planning is a weighed portion, not a recipe.** `50 g paine int + 100 g humus,
  jumatate de farfurie de legume`. So a planned meal is a list of entries — a snack is two food
  lines, not a fabricated recipe.
- **Weights are stated raw.** `50 g bulgur nefiert`, `100 g piept de pui crud`. Dry bulgur is
  roughly three times the calories of cooked, so the state a food is weighed in is part of its
  identity (`raw` / `dry` / `cooked` / `as-sold`).
- **The week starts on Wednesday.** Every plan runs Wed → Tue. That's the default; it's
  configurable in Settings.

The dietician never wrote a single calorie. Supplying them is what this app adds.

---

## Look and feel

The app is meant to feel like a kitchen notebook, not an analytics dashboard.

**Logo.** A big cheeky bite taken out of the mark itself — it draws the name
rather than illustrating food, which is why it isn't a bowl or a plate. Bold ink
outline, one silhouette, so it holds up at favicon size. Drawn inline as SVG in
`src/components/brand/Mascot.tsx` so it inherits theme colours and stays crisp
from 30px in the sidebar to 96px in an empty state. It has three moods —
`happy`, `sleepy` and `oops` — covering the three things the app has to say:
all is well, there's nothing here yet, and something went wrong.

The bite is cut from two concentric copies rather than one masked shape: the
dark body takes a smaller cut than the coloured body, so the bitten edge keeps
the same outline weight as the rest of the mark.

**Palette.** Cream ground rather than grey, a muted sage as the primary, peach
for warmth, plus butter and berry accents. Defined as tokens in `src/index.css`
under Tailwind 4's `@theme`.

**Type.** Nunito throughout for its rounded terminals, with Fredoka reserved for
the wordmark and page titles. Both are **bundled**, not fetched from a CDN, so
the app looks identical offline — which also cut the end-to-end suite from
5.4 minutes to 24 seconds, since the tests no longer wait on font requests.

**Shape.** Pill buttons, 24px card corners, and soft warm-toned shadows instead
of grey ones.

**Tone.** Going a little over target warms the bar to peach and only deepens
past 130% — a normal day should never look like an alarm.

---

## Features

### Planner
Wed→Tue week grid, five slots a day (breakfast, two snacks, lunch, dinner), live totals against
your targets, copy a day to another day, and one-tap copy of a whole day formatted for
MyFitnessPal.

### Recipes
275 recipes, searchable in English, Romanian or Hungarian — typing `telemea` or `zabpehely`
finds the right thing. Every imported meal shows the original dietician line as provenance.
Macros are always derived from components, never stored, so they can't drift out of date.

### Foods
122 foods with per-100 g nutrition, each carrying EN/RO/HU names and a Mediterranean tier
(daily / weekly / moderation / rarely). Add your own by hand or by USDA / Open Food Facts
lookup — the barcode scanner is still there for packaged goods.

### History
All 14 plans as a browsable archive with the original Romanian and Hungarian preserved
verbatim. Load any week straight into the planner.

### Grocery list
Built from the planned week, resolving nested recipes down to what you actually buy, merged by
food and grouped by category. Weights are raw, matching how the plans are written.

### Progress
Weekly calories against target, Mediterranean serving goals (≥3 veg/day, ≥3 legumes/week…),
and a weight log.

### Prep & Schedule
Step-by-step cooking with timers, and batch-cook sessions — because the plans deliberately
repeat a dish across several days.

---

## MyFitnessPal

**MyFitnessPal has no usable public API.** It was withdrawn in 2019 and they don't grant new
developer access. Nothing can write to your diary programmatically, and any app claiming
otherwise is either a paid B2B aggregator or scraping.

What Bite Buddy does instead:

| Direction | How |
|---|---|
| Bite Buddy → MFP | **Copy for MyFitnessPal** on any day or recipe — a Quick Add line, or a recipe as a pasteable ingredient list for MFP's recipe importer |
| MFP → Bite Buddy | **Import diary CSV** in Settings, from MyFitnessPal's own nutrition export |

---

## Targets

Two independent routes, because they answer different questions — and either can be overridden:

- **From your plans** — averages what the dietician actually prescribed across the 14 weeks.
- **Calculator** — Mifflin-St Jeor from your body stats, adjusted for activity and goal.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173/bite-buddy/
npm run build
npm run preview
```

Node 20+.

### Checks

```bash
npm run verify     # lint + typecheck + unit tests + data integrity + build
npm run test:e2e   # drives the real app in a browser, desktop and phone
```

Both run in CI on every push (`.github/workflows/ci.yml`).

### Optional

```bash
# .env.local — raises the USDA rate limit for ingredient lookup
VITE_USDA_API_KEY=your_key    # https://fdc.nal.usda.gov/api-guide.html
```

The app works without it and works with no network at all.

---

## The data pipeline

The plan data is generated, not hand-typed, so it stays reproducible and auditable.

```bash
npm run data:build -- <dir-with-the-.docx-plans>   # regenerate src/data/generated/
npm run data:check                                 # integrity checks
```

`scripts/build-data.ts` reads the `.docx` files directly (a small ZIP reader — no dependency),
splits each meal line into fragments, and resolves each fragment to either a food or a dish.
Two judgement calls live in the data rather than the parser:

- `DISH_BY_WEIGHT` in `src/data/dishes.ts` marks dishes the plans portion by weight
  (`350 g ciorba a la grec`). For everything else a stated weight names an *ingredient*
  (`tigaie picanta: 100 g piept de pui`) and must not be read as a portion size.
- A parenthetical's ingredients are added only when the dish definition doesn't already
  contain them, so `cartofi cu ou (…, sos: 100 g iaurt, 50 g telemea)` picks up its sauce
  without double-counting the potatoes.

`scripts/check-data.ts` verifies every reference resolves, no recipe nests itself, every one of
the 481 source lines maps to something, recipe names are unique, and each food's stated
calories agree with its own macros — using fibre-aware Atwater (fibre at 2 kcal/g), because
plain 4/4/9 makes every vegetable look mis-keyed.

---

## Tech

| Layer | |
|---|---|
| UI | React 19 + TypeScript 6 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, no config file) |
| Routing | React Router v7, hash-based so it works offline |
| State | Zustand + `persist` (localStorage) |
| Build | Vite 8 · `vite-plugin-pwa` (Workbox) |
| Quality | ESLint 10 · Vitest · Playwright |
| Nutrition lookup | USDA FoodData Central · Open Food Facts |
| Barcodes | `@zxing/browser` |
| Data pipeline | `tsx` scripts, run on demand |

TypeScript is held at 6 deliberately: 7.0 works for `tsc` and the build, but
typescript-eslint does not support it yet, and losing the linter costs more than
the upgrade gains. Revisit when typescript-eslint ships TS 7 support.

```
src/
├── data/
│   ├── foods.ts          # 122 curated foods, EN/RO/HU
│   ├── dishes.ts         # 71 dishes the plans name but don't spell out
│   └── generated/        # built by scripts/build-data.ts
├── lib/
│   ├── units.ts          # "o lingurita", "jumatate de farfurie", raw vs dry
│   ├── nutrition.ts      # the one place nutrition numbers are produced
│   ├── targets.ts        # plan averages + TDEE
│   ├── mediterranean.ts  # serving goals from the guide
│   └── mfp.ts            # clipboard + diary CSV
├── pages/                # Planner, Recipes, Foods, Grocery, History, Prep, Schedule, Progress, Settings
└── store/                # zustand stores
```

---

## Guardrails

Everything here exists because of a failure that actually happened, or one that
would be silent if it did.

**Data invariants** (`npm run data:check`) — every component resolves to a real
food or recipe, no recipe nests itself, all 481 plan lines map to something,
recipe names are unique, and each food's stated calories agree with its own
macros. Calorie agreement uses fibre-aware Atwater (fibre at 2 kcal/g); plain
4/4/9 flags every vegetable as mis-keyed. Foods whose energy genuinely isn't in
the macros — vanilla extract is mostly ethanol — are listed explicitly rather
than silently tolerated.

**Unit tests** cover the parsing vocabulary and the nutrition maths, the two
places where a mistake produces a plausible wrong number instead of an error:
raw-vs-dry detection, spoon measures, decimal commas, nested-recipe scaling,
cycle safety, and the Wednesday week boundary across daylight saving.

**Lint rules** include a custom one banning a `<button>` inside a `<button>`.
That bug shipped twice here — browsers reparent the inner element and its click
handler silently stops firing — so it is now caught mechanically.

**End-to-end tests** run at desktop and phone sizes and assert three things per
screen: it renders with no console errors, it does not scroll horizontally, and
every control is at least 40x32px. The tap-target check is what keeps the mobile
work from regressing.

**Storage safety** — writes go through a wrapper that degrades instead of
throwing. A full or blocked localStorage shows a banner rather than losing data
quietly, and corrupt JSON falls back to defaults. Every store is schema-versioned:
bump `SCHEMA_VERSION` in `src/store/persist.ts` when a persisted shape changes
and old state is discarded rather than misread.

**Error boundary** — a render error shows a recovery screen with the message,
not a blank white page. On a phone with no console, those are indistinguishable.

**Accessibility** — 44px minimum touch targets under `(pointer: coarse)` only,
so phones get thumb-sized controls while desktop keeps compact ones, and
animations are disabled under `prefers-reduced-motion`.

---

## Not done yet

- **Cloud sync.** Currently local-first: your phone and laptop are separate. A Supabase
  backend is the planned next pass, and the stores are kept behind narrow interfaces so it can
  slot in without touching screens.
- Publishing recipes at public URLs with schema.org markup, so MyFitnessPal's recipe importer
  can pull them by link — needs hosting, so it follows the backend.
- Pantry tracking, household sharing, saved week templates.
