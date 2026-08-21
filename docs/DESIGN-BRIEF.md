# Bite Buddy, design brief

Everything a design system for this app has to cover: the screens, the components,
the states, the content that flows through them, and the constraints that bind the
design decisions.

Written to be handed to a designer, or fed to a tool, as the source of truth.

> **Companion document.** [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) is the visual
> authority: palette, type scale, component specs. This brief is the product
> inventory behind it, what exists, how much of it there is, and what it has to
> survive. The two agree today; the "Bold & Playful" system in that file is what
> the app actually ships.
>
> Last checked against the code on 20 August 2026.

---

## 1. What the app is

An **offline-first meal planner for two people**, Arany and Oli. It installs to a
phone, works with no network, and syncs through Supabase when an account is
configured. Run it yourself with no Supabase keys and there is no sign-in at all:
everything stays on the device.

**What makes it unlike other meal apps:** the content was not invented. The library
was parsed out of **14 real dietician plan documents** written in Romanian and
Hungarian across 2021 and 2022, 97 days, 481 individual meals. A second source, an
89-page Mediterranean Diet guide, supplies the food taxonomy: 17 categories, each
with a how-often tier and weekly serving goals the app scores against.

Three properties of that source data shape the whole product, and therefore the design:

| Property | Consequence for design |
|---|---|
| The dietician wrote **weighed portion lines**, not recipes (`50 g paine int + 100 g humus, jumatate de farfurie de legume`) | A meal is a *list of entries*, not one recipe. A snack is two food lines. Rows must handle 1 to 6 entries. |
| Weights are stated **uncooked** (`50 g bulgur nefiert`, `100 g piept de pui crud`) | Every food carries a state, raw / dry / cooked / as-sold, that sometimes needs surfacing |
| Every plan week ran **Wednesday to Tuesday** | No calendar component may assume a fixed first day. The week start is a setting, any of the seven; Monday is the default, and loading an archived plan lines its days up by weekday. |

The dietician never wrote a single calorie. Supplying them is what the app adds.

### Who uses it and where

Two people in one household, sharing a kitchen and a plan:

- **Shared**: the daily targets, the planned week, the recipe library, the food
  database, the shopping list, the cooking schedule.
- **Personal**: weight, five body measurements, exercise, sleep. Every one of those
  rows says whose it is, and both people appear on screen whether or not either has
  signed in.

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
| **Two primary form factors** | Sidebar (9 items) on desktop becomes a bottom bar (4 destinations plus a centre add button) on phone, with the rest behind More. |
| **44px touch targets** | Applied under `(pointer: coarse)` **only**, so phones get thumb-sized controls while pointer devices keep compact ones. A test fails the build if any control drops below 40x32. |
| **No horizontal scroll** | Asserted per screen at 390px. Long recipe names and 187-character source lines are the usual culprits. |
| **Fully offline** | Installable PWA. No CDN anything, fonts are bundled as files, icons are inline SVG or lucide components. Any asset a design needs must ship in the build. |
| **Light only** | There is no dark theme and no theme switch. It was built, then removed on purpose: one surface to design, one set of contrast decisions to get right. |
| **Numbers are the content** | Calories plus four macros, per meal, per day, per week. Figures align in columns; tabular numerals are set globally on `body`. |
| **Macros are written out** | Protein, Carbs, Fat, Fibre in full. No single-letter labels anywhere in the interface. |
| **Two languages on one row** | Many recipes show an English name with the dietician's original Romanian or Hungarian beneath it. This pairing needs a real typographic treatment, not just smaller grey text. |
| **Unknown is not zero** | A nutrient no ingredient knew about is shown as a floor (`12 g +`), never as a total. Any figure display has to have room for that marker. |
| **Over target is normal** | These are real days, not a game. Slightly over should read as information; only well over should read as a signal. Colour alone should not carry it. |
| **Nothing is deleted** | Deleting a recipe or a food hides it; archived weeks that name it still resolve. Merging duplicates works the same way. Deleted items stay listed in Settings and can be restored. |
| **Reduced motion** | All animation is disabled under `prefers-reduced-motion: reduce`. |

---

## 3. Screens

Nine screens. Routes are hash-based so the app works offline.

| Screen | Route | Its job | What's on it |
|---|---|---|---|
| **Home** | `/` | Open the app and know where you stand. | Greeting with Zig, four at-a-glance tiles (today's calories, days planned, Mediterranean goals met, next cook or latest weight), today's meals against a calorie ring, a seven-bar week chart, one dismissible moment, sync status |
| **Planner** | `/plan` | Plan and read a stretch of days. | Week, fortnight or month range, day cards with per-day calories, 5 meal slots each holding any number of entries, add-entry sheet, copy day, macro bars against target |
| **Recipes** | `/recipes` | Find something to eat. | 275 recipes on meal-type shelves, grouped into variant cards, dish-category sheet, 14 quick-filter chips, search, favourites, detail sheet with provenance and method, editor, merge duplicates, delete |
| **Foods** | `/foods` | The ingredient database. | 122 rows under 16 category headings, per-100 g figures and a how-often tier, add by hand or from USDA FoodData Central, Open Food Facts or a barcode, edit, merge, delete, provenance on every imported food |
| **Grocery** | `/grocery` | Get through a shop one-handed. | Checklist grouped by category, scoped to the days you pick, editable rows, free-typed additions, progress bar |
| **Schedule** | `/schedule` | Plan batch-cook sessions. | Session list with date, time, dishes and completion state, plus an email reminder to both people before a session |
| **Movement** | `/movement` | Log what the body did. | Person tabs (Arany, Oli), then Exercise and Sleep tabs: workout builder with an exercise search, calories from body weight, step counts, Garmin CSV import |
| **Progress** | `/analytics` | See how the week went. | Three tabs. This week: seven-bar calorie chart. Mediterranean: serving goals as progress rows. Body: person tabs, weight log, and waist, hips, chest, arms and thighs each with their own trend |
| **Settings** | `/settings` | Targets, preferences, data, archive. | Two tabs. Settings: daily targets (from the plans, from a TDEE calculation, or set by hand), week start, backup and restore, account, version, the weekly food check, deleted recipes and foods. Plan history: the 14 original plans, untranslated, loadable into the planner |

Settings is reachable **signed out**, on purpose: targets, the backup file and the
version live on the device, and signing out should not take away the screen you
signed out in order to reach.

---

## 4. Component inventory

| Group | Components | Notes |
|---|---|---|
| **Navigation** | Sidebar (9 items) · bottom bar (Home, Plan, add, Recipes, More) · More sheet · segmented tabs · person tabs | The centre add button sits proud of the bar and is the one-handed primary action |
| **Surfaces** | Card · soft card · bottom sheet · centred dialog · full-screen error | Sheets slide from the bottom on phone, centre on desktop |
| **Actions** | Primary · secondary · ghost · danger · icon-only · filter chip (on/off) · text link | Pill-shaped, primary has a pressed-down effect |
| **Forms** | Text · number with unit suffix · unit dropdown (g, kg, ml, l, piece, tsp, tbsp, cup) · select · checkbox · date · time · file · search with grouped results | Number inputs are used constantly and deserve their own treatment |
| **Data display** | Calorie ring · macro bar with target · seven-bar chart · sparkline · linear progress · stat tile · nutrient summary with partial markers | The ring and the bars appear together on the busiest screens and should read as one family |
| **Content rows** | Recipe card · food row · meal-slot row · grocery row · plan-day row · session card · workout row · measurement row | Each pairs a name, an optional second-language line, and right-aligned figures |
| **Markers** | Tier badge (4 levels) · status pill · dish-category label · quick-filter chip · favourite star · provenance card | Tier appears on all 122 food rows, so it has to be quiet and legible at once |
| **Feedback** | Empty state · error screen · storage warning banner · moment note · copied confirmation · update-available reload | Zig has three moods and carries the empty and error states |
| **Brand** | Zig the mascot (3 moods) · wordmark lockup · app icon · favicon | All inline SVG, theme-coloured, used from 30px to 96px |

---

## 5. States

All of these exist in code today. A redesign has to account for each.

**Data states**, populated · empty (first run) · empty (filtered to nothing) · partial
week · deleted but still referenced by an archived week · merged into another item ·
imported with provenance · imported with a nutrient the source did not know

**Target states**, under target · slightly over (105 to 130%) · well over (130%+) · no
target set

**System states**, loading (nutrition lookup) · offline · storage full · corrupt data
recovery · render error · a new build is waiting to take over · signed out

**Interaction states**, default · hover · focus-visible · pressed · disabled ·
favourited · checked off · session completed · person selected

**Calendar states**, today · selected day · day with no meals · day outside the
current month (month view)

**Preference states**, reduced motion · week start (any of the seven)

---

## 6. Content you're designing around

Real measurements from the shipped data, not estimates. Regenerate with
`npm run data:check`.

| What | Figure | Why it matters |
|---|---|---|
| Recipes | **275** | 71 base dishes plus 204 meals taken from the plans, grouped into far fewer cards by variant |
| Recipe name length | **5 to 77 chars**, median 41 | Cards must handle two-line names without breaking the grid |
| Source lines | **up to 187 chars** | Shown under the name; truncates on cards, wraps in detail |
| Foods | **122** | Across 16 categories, each row carrying up to three language names |
| Dish categories | **38 defined, 19 in use** | Describe what the food is, never when it is eaten |
| Quick filters | **14** | One horizontally scrolling chip row |
| Meal types | **4** | Breakfast, Lunch, Dinner, Snack. A recipe can belong to several |
| Meal slots | **5 x 7 = 35** | A slot can hold several entries |
| Food categories | **17 defined, 16 in use** | Group headings on the Foods screen |
| Plan archive | **14 plans / 97 days** | All with untranslated source text |
| People | **2** | Arany and Oli, fixed ids, both always on screen |
| Body measurements | **5** | Waist, hips, chest, arms, thighs, each with its own history and trend |
| Typical day | **~1,258 kcal** | Range 869 to 2,651, bars need headroom well past target |

**The five meal slots**, in order: Breakfast · Snack 1 · Lunch · Snack 2 · Dinner.

**The 17 food categories:** vegetables, legumes, fruits, grains, nuts-seeds,
herbs-spices, fats-vinegars, dairy, fish-seafood, poultry, eggs, red-meat, pantry,
spreads-sauces, treats, sweeteners, beverages.

**The 4 Mediterranean tiers:** daily · weekly · moderation · rarely.

---

## 7. Tokens in place today

Everything is CSS custom properties in one file (`src/index.css`), inside an
`@theme { }` block, so a palette swap is a single edit. Full specs live in
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).

### Colour

**Bite**, primary. A confident violet, the brand colour and the focus ring.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| `#f5f2ff` | `#e9e4ff` | `#c9c0f1` | `#aa9ce8` | `#8b7add` | `#6d5bd0` | `#5947be` | `#4938a7` | `#3b2d85` | `#2c2166` |

**Coral**, warnings, destructive actions, well over target. `#fff3f3` … `#ff6868` … `#8a2a2a`

**Teal**, the positive counterweight: on target, completed, synced. `#ebfaf8` … `#00b8a9` … `#08504a`

**Mustard**, the third accent, highlights and gentle attention. `#fffcf2` … `#ffd166` … `#82601b`

**Grounds and text**

| Token | Value | Use |
|---|---|---|
| `--color-cream-50` | `#faf7f0` | App background |
| `--color-paper` | `#fffdf9` | Primary card surface |
| `--color-ink-900` | `#2d2320` | Main text |
| `--color-ink-700` | `#514744` | Secondary text |
| `--color-ink-500` | `#817774` | Muted text |
| `--color-ink-300` | `#a79d9a` | Placeholders |
| `--color-border-100` / `200` | `#f0eae2` / `#e6ded5` | Hairlines and card edges |

### Type

| Role | Face | Usage |
|---|---|---|
| Display | **Bungee** | The `display` utility only: wordmark, page titles, big moments. Never long copy, never data |
| Body | **Plus Jakarta Sans Variable** | Everything else, `body` weight 500 |
| Numeric | Plus Jakarta Sans with `font-variant-numeric: tabular-nums` | Set globally |

Both are bundled via `@fontsource`, not fetched from a CDN. There is no true
monospace; `--font-mono` points at Plus Jakarta Sans and alignment comes from tabular
figures.

### Shape, elevation, motion

| Token | Value |
|---|---|
| `--radius-sm` … `--radius-xl` | 8, 12, 16, 20px |
| `--radius-card` | 24px |
| Buttons | Fully pill (`rounded-full`) |
| `--shadow-e1` / `e2` / `e3` | A three-step warm-toned elevation scale |
| Focus | `3px solid var(--color-bite-500)`, offset 2px, everywhere |
| Spacing | Tailwind's default 4px scale, unmodified |
| Motion | 150ms on interaction, 500 to 700ms on bars and rings, plus `pop` and `wiggle` for personality |

### Still open

- **Contrast**, never formally audited against WCAG
- **Semantic colour**, over-target reuses coral rather than having its own scale
- **Charts**, the seven-bar chart and the sparkline were drawn ad hoc rather than
  specified

---

## 8. Tone of voice

The app should read like a kitchen notebook, not an analytics dashboard.

- Warm and plain. "Your week", "Pop something in", "What are we having?"
- Errors are calm and reassuring: *"Oops, something spilled. This screen tripped over
  itself. Your recipes and plans are safe."*
- Never scolding about food. Going over target is information, not a failure.
- Nothing counts and nothing resets. There are no points, streaks or levels; Zig
  notices a handful of firsts and then goes quiet.
- British spelling (*favourites*, *fibre*, *cosy*).
- **No em dashes.** House rule, enforced by `npm run text:check` and documented in
  `.claude/skills/no-em-dashes/`. Use a comma, a colon, a full stop or brackets.

> **Note:** several e2e tests assert on exact copy. Changing user-facing strings means
> updating the specs in `e2e/` in the same commit.

---

## 9. Accessibility requirements

- Minimum 40x32 tap target on coarse pointers, enforced by test
- `prefers-reduced-motion` respected globally
- One visible focus treatment everywhere, not the browser default
- Every icon-only control has an `aria-label`
- No horizontal scroll at any viewport
- **Not yet done:** contrast has not been formally audited, and over-target status is
  still signalled largely by hue

---

## 10. Implementation notes

React 19 with TypeScript, Vite, Zustand with `persist`, React Router on a hash
history, Supabase for optional sync, Workbox for the service worker.

Tailwind CSS v4, CSS-first, **there is no `tailwind.config.js`**.

- **Design tokens** are custom properties in an `@theme { }` block. Adding
  `--color-foo-500` makes `bg-foo-500`, `text-foo-500` and so on available
  automatically.
- **Components** are `@utility` classes (`btn-primary`, `card`, `chip-on`, `tab-off`,
  `input`, `nav-item`, `meal-slot`). Note that `@utility` *inlines* a composed base
  rather than adding its class to the element, so a rule targeting `.btn` will not
  match an element with `class="btn-primary"`; media-query overrides must list each
  variant.
- **Touch sizing** lives in an unlayered `@media (pointer: coarse)` block at the end of
  the stylesheet so it takes precedence over the utilities it widens.
- **Nutrition is always derived**, never stored. A recipe holds components; calories
  and macros are computed from them at every level: ingredient, recipe, serving.
- **A weekly GitHub Action** re-checks the food database for macro, micronutrient,
  category and how-often problems and reports them rather than editing the data.

A design system can be delivered as: token values (any format), component specs, and
optionally the `@theme` block itself.

---

## 11. Decisions worth taking next

1. **How should over-target read without relying on colour?** It is the single
   most-read signal in the app and today it is mostly a hue shift.
3. **What should a partial figure look like?** `12 g +` is honest but plain, and it
   appears wherever an ingredient did not know a nutrient.
4. **How much should the second language show?** The Romanian and Hungarian source
   text is the app's whole provenance story, and it is also visual noise on every row.
5. **Do the two people need visual identity?** Arany and Oli are currently just tab
   labels. A colour or an initial each would make a shared screen readable at a glance,
   at the cost of two more committed hues.

---

*Anything missing here, ask. The numbers above all come from the shipped data.*
