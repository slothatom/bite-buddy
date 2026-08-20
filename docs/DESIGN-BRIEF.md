# Bite Buddy, design brief

Everything a design system for this app has to cover: the screens, the components,
the states, the content that flows through them, and the constraints that bind the
design decisions.

Written to be handed to a designer, or fed to a tool, as the source of truth.

> **Superseded.** This brief was the input that produced
> [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md), which is now the authority, and the two
> disagree. Section 10's typography (Fredoka + Nunito) belongs to the earlier
> "cute and cozy" round; the app ships Bungee + Plus Jakarta Sans, and the Fredoka
> and Nunito packages have been uninstalled. Read this for the screen, state and
> content inventory, which is still accurate; read the design system for anything
> visual.

---

## 1. What the app is

An **offline, single-user meal planner**. No accounts, no server, no sync, everything
lives in the browser. It plans a week of eating, keeps a recipe library, and turns that
week into a shopping list.

**What makes it unlike other meal apps:** the content was not invented. The library was
parsed out of **14 real dietician plan documents** written in Romanian and Hungarian
across 2021–22, 97 days, 481 individual meals. A second source, an 89-page
Mediterranean Diet guide, supplies the food taxonomy: 17 categories, each with a
how-often tier and weekly serving goals the app scores against.

Three properties of that source data shape the whole product, and therefore the design:

| Property | Consequence for design |
|---|---|
| The dietician wrote **weighed portion lines**, not recipes (`50 g paine int + 100 g humus, jumatate de farfurie de legume`) | A meal is a *list of entries*, not one recipe. A snack is two food lines. Rows must handle 1–6 entries. |
| Weights are stated **uncooked** (`50 g bulgur nefiert`, `100 g piept de pui crud`) | Every food carries a state, raw / dry / cooked / as-sold, that sometimes needs surfacing |
| Every plan week ran **Wednesday → Tuesday** | No calendar component may assume a Monday or Sunday start. It is configurable, but Wednesday is the default. |

The dietician never wrote a single calorie. Supplying them is what the app adds.

### Who uses it and where

One person, daily, in two very different contexts:

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
| **Two primary form factors** | Sidebar (9 items) on desktop becomes a bottom bar (5 items) on phone. Both need to feel deliberate. |
| **44px touch targets** | Applied under `(pointer: coarse)` **only**, so phones get thumb-sized controls while pointer devices keep compact ones. A test fails the build if any control drops below 40×32. |
| **No horizontal scroll** | Asserted per screen at 390px. Long recipe names and 187-character source lines are the usual culprits. |
| **Fully offline** | Installable PWA. No CDN anything, fonts are bundled as files, icons are inline SVG. Any asset a design needs must ship in the build. |
| **Numbers are the content** | Calories plus four macros, per meal, per day, per week. Figures must align in columns, tabular numerals are not optional. |
| **Two languages on one row** | Nearly every recipe shows an English name with the dietician's original Romanian or Hungarian beneath it. This pairing needs a real typographic treatment, not just smaller grey text. |
| **Over target is normal** | These are real days, not a game. Slightly over should read as information; only well over should read as a signal. Colour alone should not carry it. |
| **Reduced motion** | All animation is disabled under `prefers-reduced-motion: reduce`. |

---

## 3. Screens

Nine screens. Routes are hash-based so the app works offline.

| Screen | Route | Its job | What's on it |
|---|---|---|---|
| **Planner** | `/` | Home. Plan and read a week. | 7-day strip with per-day calories · calorie ring · 4 macro bars · 5 meal slots, each holding any number of entries · copy-day and clipboard actions |
| **Recipes** | `/recipes` | Find something to eat. | 275 cards in a 1/2/3-column grid · search · 14 filter chips · favourite toggles · detail sheet with provenance, components and method |
| **Foods** | `/foods` | The ingredient database. | 122 rows under 16 category headings, each with per-100 g figures and a how-often tier · add-food sheet with manual entry, online lookup and barcode scan |
| **Grocery** | `/grocery` | Get through a shop one-handed. | Checklist grouped by category · progress bar · ~46 rows for a full week |
| **History** | `/history` | Browse the 14 original plans. | Expandable plan cards, each with 7 days of untranslated source text and a load-into-planner action |
| **Prep** | `/prep` | Cook along. | Recipe picker, then one large step at a time with a countdown timer and a progress bar |
| **Schedule** | `/schedule` | Plan batch-cook sessions. | Session list with date, time, completion state and recipe tags |
| **Progress** | `/analytics` | See how the week went. | Three tabs: 7-bar calorie chart · Mediterranean serving goals as 7 progress rows · weight log with a sparkline |
| **Settings** | `/settings` | Targets and preferences. | Three target-setting routes · TDEE form · week-start select · toggles · CSV import |

---

## 4. Component inventory

| Group | Components | Notes |
|---|---|---|
| **Navigation** | Sidebar (9 items) · bottom bar (5 items) · segmented tabs | The phone bar shows only 5 of 9 screens, which 5 is worth revisiting |
| **Surfaces** | Card · soft card · bottom sheet · centred dialog · full-screen error | Sheets slide from the bottom on phone, centre on desktop. Five exist. |
| **Actions** | Primary · secondary · ghost · danger · icon-only · filter chip (on/off) · text link | Currently pill-shaped, primary has a pressed-down effect |
| **Forms** | Text · number with unit suffix · select · checkbox · date · time · file · search | Number inputs are used constantly (grams, kcal, body stats) and deserve their own treatment |
| **Data display** | Calorie ring (radial progress) · macro bar with target · 7-bar chart · sparkline · linear progress · stat block | The ring and bars appear together on the busiest screen and should read as one family |
| **Content rows** | Recipe card · food row · meal-slot row · grocery row · plan-day row · session card | Each pairs a name, an optional second-language line, and right-aligned figures |
| **Markers** | Tier badge (4 levels) · tag · category heading · favourite star · language flag | Tier is a four-step scale, currently colour-only |
| **Feedback** | Empty state · error screen · storage warning banner · XP toast · copied confirmation · countdown timer | The logo has three moods and carries the empty and error states |
| **Brand** | Logo (3 moods) · wordmark lockup · app icon · favicon | All inline SVG, theme-coloured, used from 30px to 96px |

---

## 5. States

All of these exist in code today. A redesign has to account for each.

**Data states**, populated · empty (first run) · empty (filtered to nothing) · partial week · someone else's plan

**Target states**, under target · slightly over (105–130%) · well over (130%+) · no target set

**System states**, loading (nutrition lookup) · offline · storage full · corrupt data recovery · render error

**Interaction states**, default · hover · focus-visible · pressed · disabled · favourited · checked off · session completed · timer running · timer finished

**Calendar states**, today · selected day · day with no meals

**Preference states**, reduced motion · XP layer shown/hidden

---

## 6. Content you're designing around

Real measurements from the shipped data, not estimates.

| What | Figure | Why it matters |
|---|---|---|
| Recipes | **275** | 71 base dishes + 204 meals taken from the plans |
| Recipe name length | **5–77 chars**, median 41 | Cards must handle two-line names without breaking the grid |
| Source lines | **up to 187 chars** | Shown under the name; truncates on cards, wraps in detail |
| Foods | **122** | Across 16 categories, each row carrying up to three language names |
| Food categories | **17 defined, 16 in use** | Used as group headings on two screens |
| Filter tags | **13** + favourites | 14 chips in one horizontally scrolling row |
| Meal slots | **5 × 7 = 35** | A slot can hold several entries |
| Grocery items | **~46** | For a full seven-day week |
| Plan archive | **14 plans / 97 days** | All with untranslated source text |
| Typical day | **~1,258 kcal** | Range 869–2,651, bars need headroom well past target |

**The five meal slots**, in order: Breakfast · Snack 1 · Lunch · Snack 2 · Dinner.

**The 13 recipe tags:** batch, breakfast, dinner, high-protein, low-carb, lunch,
pescatarian, quick, salad, soup, spread, vegan, vegetarian.

**The 17 food categories:** vegetables, legumes, fruits, grains, nuts-seeds,
herbs-spices, fats-vinegars, dairy, fish-seafood, poultry, eggs, red-meat, pantry,
spreads-sauces, treats, sweeteners, beverages.

**The 4 Mediterranean tiers:** daily · weekly · moderation · rarely.

---

## 7. Tokens in place today

Replace, extend or ignore, this is the starting point, not a constraint. Everything is
CSS custom properties in one file (`src/index.css`), so a palette swap is a single edit.

### Colour

**Sage**, primary. Muted and leafy, never neon.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| `#f2f7f1` | `#e2eede` | `#c6dcbf` | `#a2c497` | `#7faa72` | `#628f55` | `#4c7442` | `#3d5c36` | `#33492e` | `#2b3d28` |

**Peach (clay)**, warmth, highlights, and anything gently over target.

| 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| `#fff5f0` | `#ffe8dc` | `#ffd2bb` | `#ffb492` | `#fb9068` | `#ef7048` | `#d85632` | `#b34327` | `#923a25` | `#793322` |

**Cream (sand)**, page and card grounds. Paper, not plaster.

| 50 | 100 | 200 | 300 | 400 | 500 |
|---|---|---|---|---|---|
| `#fffbf4` | `#fdf4e7` | `#f6e8d5` | `#ecd8bd` | `#dcc09a` | `#c8a67b` |

**Butter**, soft third accent. `#fff6d9` `#ffecb0` `#ffdd7a` `#fdca45` `#edb122`

**Berry (xp)**, streaks and celebratory moments. `#fdf3f7` … `#d84f88` … `#6e2440`

**Ink**, `#33231c`. The logo outline. A deep warm brown rather than black, so the
chunky outline stays warm against the cream.

Text currently uses Tailwind's `stone` ramp (`stone-700` body, `stone-400/500`
secondary). That is the one part of the palette that was inherited rather than chosen,
and is the most obvious thing to replace with a warm neutral of your own.

### Type

| Role | Face | Usage |
|---|---|---|
| Display | **Fredoka Variable** (300–700) | Wordmark, page titles (`h1`, `h2`) only |
| Body | **Nunito Variable** (200–1000) | Everything else |
| Numeric | Nunito with `font-variant-numeric: tabular-nums` | Set globally on `body` |

Both are bundled via `@fontsource-variable`, not fetched from a CDN. There is no true
monospace, `--font-mono` points at Nunito, and alignment comes from tabular figures.

### Shape, elevation, motion

| Token | Value |
|---|---|
| `--radius-xl` | `0.875rem` (14px) |
| `--radius-2xl` | `1.25rem` (20px) |
| `--radius-3xl` | `1.75rem` (28px), cards |
| Buttons | Fully pill (`rounded-full`) |
| Inputs | 20px radius, 2px border |
| Shadow | One soft warm-toned shadow. **No elevation scale yet.** |
| Spacing | Tailwind's default 4px scale, unmodified |
| Motion | 150ms on interaction, 500–700ms on bars and rings |

### Currently missing

- **Dark mode**, not built, not designed
- **Elevation scale**, a single shadow does all the work
- **Focus-visible treatment**, browser default in most places
- **Semantic colour** separate from the accent, over-target reuses peach
- **Density variants**, desktop uses phone-sized cards in a wider grid

---

## 8. Tone of voice

The app should read like a kitchen notebook, not an analytics dashboard.

- Warm and plain. "Your week", "Pop something in", "What are we having?"
- Errors are calm and reassuring: *"Oops, something spilled. This screen tripped over
  itself. Your recipes and plans are safe."*
- Never scolding about food. Going over target is information, not a failure.
- British spelling (*favourites*, *fibre*, *cosy*).

> **Note:** several e2e tests assert on exact copy. Changing user-facing strings means
> updating `e2e/smoke.spec.ts` in the same commit.

---

## 9. Accessibility requirements

- Minimum 40×32 tap target on coarse pointers, enforced by test
- `prefers-reduced-motion` respected globally
- Every icon-only control has an `aria-label`
- No horizontal scroll at any viewport
- **Not yet done:** contrast has not been formally audited, focus-visible is mostly the
  browser default, and over-target status is signalled by hue alone

---

## 10. Implementation notes

Tailwind CSS v4, CSS-first, **there is no `tailwind.config.js`**.

- **Design tokens** are custom properties in an `@theme { }` block. Adding
  `--color-foo-500` makes `bg-foo-500`, `text-foo-500` etc. available automatically.
- **Components** are `@utility` classes (`btn-primary`, `card`, `chip-on`, `tab-off`,
  `input`, `nav-item`…). Note that `@utility` *inlines* a composed base rather than
  adding its class to the element, so a rule targeting `.btn` will not match an element
  with `class="btn-primary"`, media-query overrides must list each variant.
- **Touch sizing** lives in an unlayered `@media (pointer: coarse)` block at the end of
  the stylesheet so it takes precedence over the utilities it widens.

A design system can be delivered as: token values (any format), component specs, and
optionally the `@theme` block itself.

---

## 11. Decisions I'd like from you

1. **Is dark mode in scope?** There is none today. It is a real ask for an app opened in
   a kitchen at night, and it doubles the token work, better decided before the palette
   is fixed than after.
2. **How should over-target read without relying on colour?** Today it is a hue shift on
   a bar. That fails for anyone who cannot separate the hues, and it is the single
   most-read signal in the app.
3. **What carries the four-step Mediterranean tier?** It appears on all 122 food rows,
   so it must be legible at a glance and quiet enough to sit in a dense list.
4. **Should desktop get its own density?** Right now desktop uses phone-sized cards in a
   wider grid, which wastes a lot of screen, but a denser mode doubles the layout work.
5. **How much should the second language show?** The Romanian and Hungarian source text
   is the app's whole provenance story, but it is also visual noise on every row. It
   could be secondary, on hover, or behind a toggle.

---

*Anything missing here, ask, the numbers above all come from the shipped data and can
be regenerated with `npm run data:check`.*
