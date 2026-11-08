# Bite Buddy, design brief

Everything a design system for this app has to cover: the screens, the components,
the states, the content that flows through them, and the constraints that bind the
design decisions.

Written to be handed to a designer, or fed to a tool, as the source of truth.

> **Companion document.** [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) is the visual
> authority: palette, type, component rules. This brief is the product inventory
> behind it: what exists, how much of it there is, and what it has to survive.
>
> Last checked against the code on 8 November 2026.

---

## 1. What the app is

An **offline-first meal planner for a household**. It installs to a phone, works
with no network, and syncs through Supabase when an account is configured. Run it
yourself with no Supabase keys and there is no sign-in at all: everything stays on
the device.

**What makes it unlike other meal apps:** the content was not invented. The library
was parsed out of **36 real dietician plan documents** (18 in Romanian, 18 in
Hungarian, October 2020 to November 2022): 254 days, 1,255 meal lines. A second
source, an 89-page Mediterranean Diet guide, supplies the food taxonomy: 17
categories, each with a how-often tier and weekly serving goals the app scores
against.

Three properties of that source data shape the whole product, and therefore the design:

| Property | Consequence for design |
|---|---|
| The dietician wrote **weighed portion lines**, not recipes (`50 g paine int + 100 g humus, jumatate de farfurie de legume`) | A meal is a *list of entries*, not one recipe. A snack is two food lines. Rows must handle several entries. |
| Weights are stated **uncooked** (`50 g bulgur nefiert`, `100 g piept de pui crud`) | Every food carries a state, raw / dry / cooked / as-sold, that sometimes needs surfacing |
| The plan weeks did not start on Monday | No calendar component may assume a fixed first day. The week start is a setting, any of the seven; Monday is the default, and loading an archived plan lines its days up by weekday. |

The dietician never wrote a single calorie. Supplying them is what the app adds.

### Who uses it and where

A household that shares a kitchen and a plan. A household is data (Settings →
Household), with roles: admin, editor, viewer.

- **Shared**: the daily targets, the planned week, the recipe library, the food
  database, the shopping list, the cooking schedule.
- **Personal**: weight, five body measurements, exercise, sleep. Every one of those
  rows says whose it is (a person key per household member).

Used daily in two very different contexts:

- **Phone**, standing in a kitchen or walking round a supermarket. Often one-handed,
  often with wet or cold hands, sometimes in poor light.
- **Laptop**, sitting down to plan a week properly.

Neither is secondary. This is not a mobile design stretched wide.

---

## 2. Constraints

These bind the design. Most are enforced by automated tests, so a redesign has to
satisfy them rather than discover them later.

| Constraint | Detail |
|---|---|
| **Two primary form factors** | Sidebar (9 destinations) on desktop; on a phone a bottom tab bar, Home · Plan · + · Recipes · More, with the other six screens in a More sheet. |
| **44px touch targets** | Applied under `(pointer: coarse)` **only**, so phones get thumb-sized controls while pointer devices keep compact ones. A test fails the build if any control drops below 40x32. |
| **No horizontal scroll** | Asserted per screen at 390px. Long recipe names and dietician lines of 200 characters are the usual culprits. Filter chips wrap rather than scroll. |
| **Fully offline** | Installable PWA. No CDN anything: fonts are bundled, icons are inline SVG or lucide components. Any asset a design needs must ship in the build. |
| **Light and dark** | A dark theme ships, with a System / Light / Dark choice in Settings (System is the default). Every token has to work on both grounds; the contrast check measures both. |
| **12px text floor** | `text-xs` is the smallest text anywhere. No opacity on text: quiet means `ink-500`, not faded. |
| **Numbers are the content** | Calories plus four macros, per meal, per day, per week. Figures align in columns; tabular numerals are set globally on `body`. |
| **Macros are written out** | Protein, Carbs, Fat, Fibre in full. No single-letter labels anywhere in the interface. |
| **Two languages on one row** | Many recipes show an English reading with the dietician's original Romanian or Hungarian beneath it. |
| **Unknown is not zero** | A nutrient no ingredient knew about is shown as a floor (`12 g +`), never as a total, and a day can say "3 of 5 entries fully known". |
| **Estimates, not advice** | Screens where the figures are the point say the calories are estimates and not medical advice. |
| **Over target is normal** | Slightly over reads as information; only well over reads as a signal. Colour never carries it alone. |
| **Nothing is deleted** | Deleting a recipe or a food hides it; archived weeks that name it still resolve. Merging duplicates works the same way. Deleted items stay listed in Settings and can be restored. |
| **Reduced motion** | All animation is disabled under `prefers-reduced-motion: reduce`. |

---

## 3. Screens

Nine destinations, plus two pages reached from them. Routes are hash-based so the
app works offline.

| Screen | Route | Its job | What's on it |
|---|---|---|---|
| **Home** | `/` | Open the app and know where you stand. | Greeting, today's meals against a calorie ring, a seven-bar week chart, "Worth a thought" hints, one dismissible moment, who else is in the household, sync status and any edit clashes ("Use theirs / Keep mine") |
| **Planner** | `/plan` | Plan and read a stretch of days. | Week, fortnight or month range, four slots a day (Breakfast, Lunch, Dinner, Snacks) each holding any number of entries, eaten / skipped ticks, add-entry sheet, copy day, Fill the gaps, saved weeks, macro bars against target. On a phone the week is a list of days. |
| **Recipes** | `/recipes` | Find something to eat. | Lenses (Quick tonight, From the cupboard, Use it up, Fits today, Not lately, Worth a batch), search, meal times, dish categories, 14 quick filters, favourites, detail sheet with provenance and method, editor, merge, delete |
| **Foods** | `/foods` | The ingredient database. | 148 foods under 17 category headings, per-100 g figures and a how-often tier, add by hand or from USDA FoodData Central, Open Food Facts or a barcode, edit, delete, provenance on every imported food |
| **Grocery** | `/grocery` | Get through a shop one-handed. | Checklist grouped by category, scoped to the days you pick, typed additions, share or copy, and a Cupboard tab of what you have and your staples |
| **Schedule** | `/schedule` | Plan batch-cook sessions. | Sessions with date, time and dishes, a weigh-out, what came out of the pan into the fridge or freezer, and a push reminder before a session |
| **Movement** | `/movement` | Log what the body did. | Person tabs, then Exercise and Sleep: workout builder with an exercise search, calories from body weight, step counts, Garmin CSV import |
| **Progress** | `/analytics` | See how the week went. | This week, Mediterranean serving goals, Body (per person: weight with an optional goal, five measurements), and a link to the dietician summary |
| **Dietician summary** | `/analytics/summary` | Take a stretch to an appointment. | Pick a span and a person; download as one HTML file or print / save as PDF |
| **Settings** | `/settings` | Targets, preferences, data, archive. | Two tabs. Settings: targets, exercise, week start, appearance (System / Light / Dark), weight unit, backup and restore, deleted recipes and foods, the weekly food check, account, household, sync, notifications, version. Plan history: the original plans, loadable into the planner |
| **Household setup** | (first run) | An account in no household. | Start a household of your own, or ask to be invited and check again |

Settings is reachable **signed out**, on purpose: targets, the backup file and the
version live on the device.

---

## 4. Component inventory

| Group | Components | Notes |
|---|---|---|
| **Navigation** | Sidebar (9 items) · bottom tab bar (Home, Plan, +, Recipes, More) · More sheet · segmented tabs · person tabs | The centre + opens the add sheet on today, at the slot for the time of day |
| **Surfaces** | Card · soft card · bottom sheet · centred dialog · full-screen error | Sheets slide from the bottom on phone, centre on desktop |
| **Actions** | Primary · secondary · ghost · danger · icon-only · filter chip (on/off) · text link | Buttons have 16px corners, chips are full pills; a chip that is on shows a check and sets `aria-pressed` |
| **Forms** | Text · number with unit suffix · unit dropdown (g, kg, ml, l, piece, tsp, tbsp, cup) · select · checkbox · date · time · file · search with a clear button and grouped results | Number inputs are used constantly and deserve their own treatment |
| **Data display** | Calorie ring (with an overflow lap past 100%) · macro bar with target line · seven-bar chart · sparkline · linear progress · stat tile · nutrient summary with partial markers · "fully known" hint · estimates note | The ring and the bars appear together on the busiest screens and should read as one family |
| **Content rows** | Recipe card · food row · meal-slot row · grocery row · plan-day row · session card · workout row · measurement row | Each pairs a name, an optional second-language line, and right-aligned figures |
| **Markers** | Tier badge (4 levels) · status pill · dish-category label · quick-filter chip · favourite star · provenance card · Past / Skipped labels | Tier appears on every food row, so it has to be quiet and legible at once |
| **Feedback** | Empty state · error screen · storage warning banner · held-deletion question · edit-clash list · moment note · copied confirmation · update-available reload | Empty and error states use the Bitten B mark |
| **Brand** | The Bitten B: mark, horizontal and stacked lockups, app icon, maskable icon, favicon | Masters in `brand/`, inlined in `Logo.tsx` so colours follow the theme. There is no mascot |

---

## 5. States

All of these exist in code today. A redesign has to account for each.

**Data states**: populated · empty (first run) · empty (filtered to nothing) · partial
week · deleted but still referenced by an archived week · merged into another item ·
imported with provenance · imported with a nutrient the source did not know

**Target states**: under target · slightly over (105 to 130%) · well over (130%+) · no
target set

**System states**: loading · offline · storage full · corrupt data recovery · render
error · a new build is waiting · signed out · no household yet · deletions held
back for confirmation · edits that clashed

**Interaction states**: default · hover · focus-visible · pressed · disabled ·
favourited · checked off · eaten · skipped · session completed · person selected

**Calendar states**: today · past · selected day · day with no meals · day outside
the current month (month view)

**Preference states**: theme (System / Light / Dark) · reduced motion · week start
(any of the seven) · weight unit

**Role states**: admin · editor · viewer (read only)

---

## 6. Content you're designing around

Real measurements from the shipped data. Regenerate with `npm run data:check`.

| What | Figure | Why it matters |
|---|---|---|
| Recipes | **576** | 83 hand-written dishes plus 493 meals taken from the plans, grouped into fewer cards by variant |
| Recipe names | Often long | A name says what makes that version different, so cards must handle two-line names |
| Source lines | **up to about 200 chars** | Shown under the name; clamps on cards, wraps in detail |
| Foods | **148** | Across 17 categories, each row carrying up to three language names |
| Dish categories | **38 defined, 23 in use** | Describe what the food is, never when it is eaten |
| Quick filters | **14** | 9 derived, 5 applied by hand; a chip row that wraps |
| Meal times | **4** | Breakfast, Lunch, Dinner, Snack. A recipe can belong to several |
| Meal slots | **4 x 7 = 28** a week | A slot can hold several entries |
| Plan archive | **36 plans / 254 days** | All with the original text |
| People | **Per household** | One person key each; personal rows say whose they are |
| Body measurements | **5** | Waist, hips, chest, arms, thighs, each with its own history and trend |

**The four meal slots**, in order: Breakfast · Lunch · Dinner · Snacks.

**The 17 food categories:** vegetables, legumes, fruits, grains, nuts-seeds,
herbs-spices, fats-vinegars, dairy, fish-seafood, poultry, eggs, red-meat, pantry,
spreads-sauces, treats, sweeteners, beverages.

**The 4 Mediterranean tiers:** daily · weekly · moderation · rarely.

---

## 7. Tokens in place today

Everything is CSS custom properties in `src/index.css`, inside an `@theme { }`
block, with dark overrides under `:root[data-theme='dark']` and the
`prefers-color-scheme: dark` media query. Full rules are in
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).

### Colour

**Bite**, the brand: a turquoise. Fills at `bite-500 #14b8a6` with `on-brand
#12312c` text on it; `bite-700 #0f766e` for brand text and the focus ring.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| `#effcf9` | `#d5f5ef` | `#a7e9df` | `#5eead4` | `#2dd4bf` | `#14b8a6` | `#0d9488` | `#0f766e` | `#115e59` | `#134e4a` |

**Leaf**, data and done: on target, eaten, filled bars. `#edfaf3` … `#0a9d63` … `#08402e`

**Mustard**, slightly over and attention. `#fffcf2` … `#ffd166` … `#82601b`

**Coral**, well over, errors, destructive (the danger button is `coral-800`).
`#fff3f3` … `#ff6868` … `#8a2a2a`

**Grounds and text** (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-cream-50` | `#faf7f0` | `#17130f` | App background |
| `--color-paper` | `#fffdf9` | `#221d18` | Card surface |
| `--color-ink-900` | `#2d2320` | `#f7f2ea` | Main text |
| `--color-ink-700` | `#514744` | `#d8cec1` | Secondary text |
| `--color-ink-500` | `#79706d` | `#a99d8d` | Muted text, the faintest colour any word may use |
| `--color-ink-300` | `#998d8a` | `#857a6c` | Icons and dividers only, never words |
| `--color-border-100` / `200` | `#f0eae2` / `#e6ded5` | `#2e2820` / `#3d352b` | Hairlines and card edges |

### Type

| Role | Face | Usage |
|---|---|---|
| Display | **Bungee** | The `display` utility only: page titles, big moments. Never long copy, never data |
| Body | **Plus Jakarta Sans Variable** | Everything else, `body` weight 500 |
| Numeric | Plus Jakarta Sans with `font-variant-numeric: tabular-nums` | Set globally |

Both are bundled via `@fontsource`, not fetched from a CDN.

### Shape, elevation, motion

| Token | Value |
|---|---|
| `--radius-sm` … `--radius-xl` | 8, 12, 16, 20px |
| `--radius-card` | 24px |
| Buttons and inputs | 16px (`rounded-lg`); chips are full pills |
| `--shadow-e1` / `e2` / `e3` | A three-step warm elevation scale (darker and tighter in dark) |
| Focus | `3px solid var(--color-bite-700)`, offset 2px, everywhere |
| Spacing | Tailwind's default 4px scale, unmodified |
| Motion | 150ms on interaction, 500 to 600ms on bars and rings, plus `pop` and `wiggle` |

### Still open

- **Over-target ring**: the well-over stroke, `coral-500`, is 2.64:1 on cream,
  under the 3:1 a graphic needs. The words beside it carry the meaning meanwhile.
- **Leftover opacity**: a few count badges still fade their text with `opacity-60`.
- **Remove-filter chips**: the active filters you tap to take off have no check.
- **Charts**: the seven-bar chart and the sparkline were drawn ad hoc rather than
  specified.

---

## 8. Tone of voice

The app should read like a kitchen notebook, not an analytics dashboard.

- Warm and plain. "Your week", "Pop something in", "What are we having?"
- Errors are calm and reassuring: *"Oops, something spilled. This screen tripped over
  itself. Your recipes and plans are safe."*
- Never scolding about food. Going over target is information, not a failure.
- Nothing counts and nothing resets. There are no points, streaks or levels; the app
  notices a handful of firsts and then goes quiet.
- British spelling (*favourites*, *fibre*, *cosy*).
- **No em dashes.** House rule, enforced by `npm run text:check` and documented in
  `.claude/skills/no-em-dashes/`. Use a comma, a colon, a full stop or brackets.

> **Note:** several e2e tests assert on exact copy. Changing user-facing strings means
> updating the specs in `e2e/` in the same commit.

---

## 9. Accessibility requirements

- Minimum 40x32 tap target on coarse pointers, enforced by test; 44px is the target
- `prefers-reduced-motion` respected globally
- One visible focus treatment everywhere (`bite-700`), not the browser default
- Every icon-only control has an `aria-label`; decorative artwork is `aria-hidden`
- No horizontal scroll at any viewport
- 12px minimum text, and no opacity on text
- Colour is measured rather than asserted. `npm run check:contrast` reads the tokens
  for both themes out of `index.css` and the class pairs out of the components, and
  fails the build below WCAG AA: 4.5:1 for words, 3:1 for large text, icons and
  marks (focus ring, danger fill, ring strokes). It runs in `verify` and in CI
- Over target is carried by words, a symbol and a signed delta as well as colour.
  The one known contrast gap is the well-over ring stroke (see Still open)

---

## 10. Implementation notes

React 19 with TypeScript, Vite, Zustand with `persist`, React Router on a hash
history, Supabase for optional sync, Workbox for the service worker.

Tailwind CSS v4, CSS-first, **there is no `tailwind.config.js`**.

- **Design tokens** are custom properties in an `@theme { }` block. Adding
  `--color-foo-500` makes `bg-foo-500`, `text-foo-500` and so on available
  automatically. A dark value goes in both dark blocks.
- **Components** are `@utility` classes (`btn-primary`, `card`, `chip-on`, `tab-off`,
  `input`, `nav-item`, `meal-slot`). `@utility` *inlines* a composed base rather
  than adding its class to the element, so a rule targeting `.btn` will not match
  `class="btn-primary"`; media-query overrides must list each variant.
- **Touch sizing** lives in an unlayered `@media (pointer: coarse)` block at the end of
  the stylesheet so it takes precedence over the utilities it widens.
- **Printing**: a `@media print` block prints only an element marked
  `data-print-root` (today, the dietician summary).
- **Nutrition is always derived**, never stored.
- **A weekly GitHub Action** re-checks the food database and reports problems rather
  than editing the data.

---

## 11. Decisions worth taking next

1. **What should a partial figure look like?** `12 g +` is honest but plain, and it
   appears wherever an ingredient did not know a nutrient.
2. **How much should the second language show?** The Romanian and Hungarian source
   text is the app's whole provenance story, and it is also visual noise on every row.
3. **Do household members need visual identity?** People are currently tab labels.
   A colour or an initial each would make a shared screen readable at a glance.
4. **The well-over ring colour**: a coral that reaches 3:1 on cream and paper
   without losing the warmth.

---

*Anything missing here, ask. The numbers above come from the shipped data.*
