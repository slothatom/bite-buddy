# 🫐 Bite Buddy

*Plan your week. Eat well. Feel good.*

A meal planner built around one person's actual dietician plans and the Mediterranean diet.

A local project. Everything lives in your own browser — no account, no server, nothing
leaves the machine, and it keeps working with the wifi off.

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

Implements `docs/DESIGN-SYSTEM.md` — Bold & Playful. The balance it asks for is
roughly 70% calm (paper, ink, whitespace), 20% functional colour, 10% chaos, so
the bold accents concentrate in navigation, headings, empty states and moments
of delight while dense working areas stay quiet.

**Zig** is the mascot: an abstract bite-shaped creature, deliberately not a bowl
or a piece of food — the silhouette is a lumpy blob with a bite out of one
shoulder, so the name is in the shape rather than illustrated literally. Six
moods (`happy`, `sleepy`, `oops`, `chef`, `celebrate`, `thinking`) drawn inline
as SVG in `src/components/brand/Mascot.tsx`. He appears in empty states, errors
and brand moments — never on every card or in dense tables.

**Colour.** Purple `#6D5BD0` is the single brand primary. Teal carries data and
positive progress, mustard means slightly over, coral means well over. Cream
grounds, warm ink text.

**Type.** Bungee for the wordmark, page titles and short expressive labels only
— never for recipe names, tables or numeric data. Plus Jakarta Sans for
everything else. Both bundled, not fetched from a CDN, so the app looks the same
offline.

**Status is never hue alone.** `src/lib/status.ts` returns a label, a symbol and
a signed delta alongside the colour level, and every consumer renders at least
one of them: bars show `+ Slightly over · +42 g`, and the target sits on the bar
as an explicit line rather than being inferred from where the fill stops.

**Mediterranean tiers** use a symbol and a word (`● Daily`, `◐ Weekly`,
`○ Moderation`, `◇ Rarely`), quiet enough to sit on 122 food rows at once.

**Navigation.** Nine destinations in the desktop sidebar; on a phone the bar is
Plan · Recipes · **+** · Grocery · More, where the centre button opens the first
empty meal slot and More holds the remaining six screens.

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

### Backup
Settings → Your data. Download or copy everything you've entered as one JSON file, and restore
it from a file or a paste. There's no account behind the app, so this is the only copy that
survives clearing browser data, switching phone, or a browser that won't let the page save at
all. A backup from a different `SCHEMA_VERSION` is refused rather than merged into a shape it
no longer fits.

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

This is a local project. It is not deployed anywhere, it talks to no server of
its own, and it is meant to run on your own machine and keep working with the
wifi off.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview    # http://localhost:4173
```

**Node 20.19+, 22.13+, or 24 and up.** Not simply "20 or newer" — the toolchain
leaves gaps. ESLint 10 is the tightest constraint at
`^20.19.0 || ^22.13.0 || >=24`, which rules out every odd-numbered release
along with 20.0–20.18 and 22.0–22.12. Vite 8 and Vitest 4 exclude much the same
set. Node 24 is the simplest answer and what CI runs; `package.json` now
declares the range, so npm warns instead of letting you find out from a
confusing build error.

(`@zxing/library`, pulled in by the barcode scanner, declares
`engines.node >= 24`. It doesn't bind here — it is browser code that Vite
bundles and Node never executes — so `npm install` warns about it on Node 22
and everything still passes.)

Run `npm install` even on an existing clone — React, Vite, Tailwind, Router and
TypeScript all changed major versions.

`base` is `./`, so the built app runs from wherever it is put — a folder, a
different port, a USB stick — without being told its own address.

### On your phone, on your own wifi

```bash
npm run build && npm run serve    # prints a http://192.168.x.x:4173 address
```

Open that address on the phone. One caveat worth knowing before you rely on it:
browsers only allow service workers on `localhost` or over HTTPS, so over a
plain LAN address the app runs as an ordinary web page — no home-screen
install, no offline once the laptop sleeps. For a phone copy that genuinely
works offline, use the one-file build below.

### Checks

```bash
npm run verify     # lint + typecheck + unit tests + data integrity + build
npm run test:e2e   # drives the real app in a browser, desktop and phone
```

### One-file build

```bash
npm run build:single   # dist-single/bite-buddy.html — CSS, JS and fonts inlined
npm run test:single    # asserts it makes no external request at all
```

Everything in one file — no server, no install, nothing fetched. Put it in your
phone's Files app or a synced folder and open it; it works with the wifi off.
Two things it gives up: there's no manifest, so it can't be added to the home
screen as an app, and opened from certain viewers it may have nowhere to save
to — take a backup from Settings before closing it if you're unsure.

`npm run verify` and `npm run test:e2e` run in CI on every push
(`.github/workflows/ci.yml`).

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
and old state is discarded rather than misread. Backups are read from the live
stores, not from localStorage, so the case where storage never worked is still
recoverable — and an end-to-end test wipes storage and restores from a paste to
prove it.

**Error boundary** — a render error shows a recovery screen with the message,
not a blank white page. On a phone with no console, those are indistinguishable.

**Accessibility** — 44px minimum touch targets under `(pointer: coarse)` only,
so phones get thumb-sized controls while desktop keeps compact ones, and
animations are disabled under `prefers-reduced-motion`.

---

## Deliberately not done

**No backend, no hosting, no sync.** This is a single-user offline tool, and a
server would mean an account, a deployment and somebody else holding a copy of
what you eat — all of it cost with no benefit here. Moving between devices is a
backup file, exported from Settings and restored on the other one. The stores
sit behind narrow interfaces, so sync could be added later without touching a
screen; it just isn't wanted.

The same reasoning rules out publishing recipes at public URLs for MyFitnessPal's
recipe importer to scrape. Clipboard and CSV cover that direction offline.

## Not done yet

- Pantry tracking, saved week templates.
