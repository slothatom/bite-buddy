# Bite Buddy design system

> **Direction:** bold and playful, but calm where the work is. A competent meal
> planner with a personality, not a clinical nutrition dashboard and not a
> children's food app.

This file describes what ships today. The code is the authority:
`src/index.css` holds every token, `src/components/ui/index.tsx` the shared
components, `src/lib/status.ts` the over-target rules. If this file and the code
disagree, the code wins and this file is the bug.

The full reference, with swatches, specimens and component sheets, is the
**Bite Buddy Design System** artifact:
<https://claude.ai/artifact/9wDHyw1EFe2AQ9Eq2cqAxD> (private to the owner). This
file is written to stand on its own without it.

The product inventory behind the system (screens, content sizes, states) is in
[`DESIGN-BRIEF.md`](DESIGN-BRIEF.md).

---

## 1. Principles

1. **Food first, numbers second.** Figures are easy to scan, but food is the
   protagonist.
2. **Playful, never chaotic.** Roughly 70% calm (cream, ink, whitespace), 20%
   functional colour, 10% personality. Bold accents live in navigation,
   headings, empty states and moments; dense lists stay quiet.
3. **Inform, never judge.** Over target is information, not failure. Status is
   never hue alone.
4. **Built for real kitchens.** Thumb-sized controls on phones, deliberate
   density on desktop.
5. **Provenance is part of the product.** The dietician's original Romanian or
   Hungarian gets a real typographic treatment, not hidden metadata.

---

## 2. Brand

### Logo: the Bitten B

A capital B with a bite out of its upper bowl and two crumbs flying off. It is
the name on the door: the sidebar, the phone's top bar, the sign-in screen, the
app icon, the tab icon and the iOS launch screens.

- Masters live in `brand/` (`mark.svg`, `mark-mono.svg`, `lockup-horizontal.svg`,
  `lockup-stacked.svg`, `app-icon.svg`, `app-icon-maskable.svg`, `favicon.svg`).
- `src/components/brand/Logo.tsx` inlines the same paths so the colours come from
  tokens: the B in `bite-700`, the crumbs in `mustard-600`, the words in
  `ink-900`. Variants `mark` and `horizontal`, plus `mono` (all `currentColor`).
- Decorative by default (`aria-hidden`); pass `title` only where the logo is the
  name, as on the sign-in heading.
- Also the illustration for empty, error and loading states, where it stays
  decorative because a title beside it says what the state is.
- `npm run icons` (`scripts/make-icons.ts`) renders the PNG icons from the
  masters with content-hashed file names, so a home screen cannot keep an old
  picture at the same address. `npm run icons:check` fails if they drift.

### No mascot

There is no mascot. The mark (`<Logo variant="mark" />`) fills those places:
empty states (`EmptyState`), the error screen, the start-up wait and first-run
household setup, with a small mark on moment notes. The Home greeting has no
illustration, and sign-in leads with the logo. Personality otherwise comes from
colour, Bungee headings and the copy.

---

## 3. Colour

All tokens are CSS custom properties in the `@theme` block of `src/index.css`,
so `bg-bite-500`, `text-leaf-700` and so on exist automatically.

### Roles

| Ramp | Role | Key steps |
|---|---|---|
| `bite` (turquoise) | The brand: primary buttons, active nav, selected chips, focus ring | `500 #14b8a6` fill, `700 #0f766e` brand text and focus, `50/100` soft grounds |
| `on-brand` | Text on a `bite-500` fill, both themes | `#12312c` (white on `bite-500` is only 2.49:1) |
| `leaf` (green) | Data and done: on track, eaten, filled bars, trend lines, Daily/Weekly tiers | `500 #0a9d63` fill, `700 #096847` text |
| `mustard` | Slightly over, attention, Rarely tier, the logo's crumbs | `500 #ffd166` fill, `700 #906b1f` ring, `800 #8b661a` text |
| `coral` | Well over, errors, destructive | `500 #ff6868` fill, `700 #ce3a3a` text, `800 #a93030` danger button |
| `cream` / `paper` | Grounds | `cream-50 #faf7f0` page, `paper #fffdf9` cards |
| `ink` | Text | `900 #2d2320` main, `700 #514744` secondary, `500 #79706d` muted (the faintest colour any word may use), `300 #998d8a` icons and dividers only |
| `border` | Hairlines | `100 #f0eae2`, `200 #e6ded5` |

The brand and data colours are deliberately far apart on the wheel: a ticked
meal must not look like "this is Bite Buddy".

### Dark theme

There is a working dark theme. **Settings → Your week → Appearance** offers
**System** (the default), **Light** and **Dark**.

- `src/lib/theme.ts` sets `data-theme="light|dark"` on `<html>`, or removes it
  for System so the `prefers-color-scheme` media query decides. It also updates
  the `theme-color` meta tag.
- `src/index.css` redefines tokens under `:root[data-theme='dark']` and again
  under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`.
  No component knows a theme exists.
- In dark: neutrals invert and stay warm (`cream-50 #17130f`, `paper #221d18`,
  `ink-900 #f7f2ea`); the shades used as words (`bite-700`, `leaf-600/700`,
  `coral-600/700`, `mustard-700/800`) lighten; soft grounds become shades of the
  surface; shadows give way to lighter surfaces.
- `bite-500`, `on-brand` and `coral-800` do not change.

### Contrast is measured

`npm run check:contrast` (`scripts/check-contrast.ts`) reads the tokens for both
themes and the class pairs out of the components and fails below WCAG AA: 4.5:1
for words, 3:1 for large text, icons and marks. It also measures the focus
ring, the danger fill and the calorie ring strokes. It runs in `npm run verify`
and in CI.

**Known gap:** the well-over ring stroke, `coral-500`, is 2.64:1 on cream and
2.78:1 on paper, below 3:1. The checker lists it as "known, not yet fixed". The
status pill under the ring still says "Over target" in words.

---

## 4. Status: over target

From `src/lib/status.ts`. Every consumer renders a label, a symbol or a signed
delta as well as the colour.

| Level | Rule | Fill | Text | Ring stroke | Words |
|---|---|---|---|---|---|
| On track | up to 105% | `leaf-500` | `leaf-700` | `leaf-500` | "On track", or "N kcal remaining" |
| Slightly over | 105 to 130% | `mustard-500` | `mustard-800` | `mustard-700` | `+ Slightly over · +120 kcal` |
| Over | above 130% | `coral-500` | `coral-700` | `coral-500` (see gap above) | `Over target · +430 kcal` |
| No target | | `border-200` | `ink-500` | `border-200` | nothing |

- **Calorie ring:** past 100% it draws a **second lap** from the top (capped at
  one extra lap) over a paper halo, so 101% and 160% no longer look the same.
- **Macro bars:** the target is an explicit line on the bar; overflow stays
  visible; a partial figure fades out at its end instead of stopping flat.

---

## 5. Typography

| Role | Face | Use |
|---|---|---|
| Display | **Bungee** (`display` utility) | Page titles, empty-state titles, short expressive labels. Never recipe names, tables or numbers |
| Everything else | **Plus Jakarta Sans Variable**, weight 500 | Body, labels, data |

- Both bundled with `@fontsource`, never fetched, so the app looks the same
  offline. `--font-mono` also points at Jakarta; alignment comes from
  `font-variant-numeric: tabular-nums`, set on `body`.
- **12px is the floor.** `text-xs` (12px) is the smallest text anywhere; an e2e
  test checks the phone week list stays at 12px or more.
- **No opacity on text.** Quietness comes from `ink-700` or `ink-500`, never from
  fading a colour. Past days say **Past** and skipped meals say **Skipped** in
  words (skipped is also struck through) instead of being dimmed.
- **Second language** (`SourceLine`): 13px, `ink-500`, upright (not italic),
  with the right `lang` attribute (`ro` or `hu`), under the 13px `ink-700`
  English reading. Dense rows show the English reading alone; the plan archive
  puts the original first.

---

## 6. Shape, space, elevation, motion

| Token | Value | Used by |
|---|---|---|
| `--radius-sm` | 8px | Focus ring corners |
| `--radius-md` | 12px | Segmented tabs |
| `--radius-lg` | 16px | Buttons, inputs, nav items |
| `--radius-xl` | 20px | Soft cards |
| `--radius-card` | 24px | Cards |
| `rounded-full` | | Chips, badges, tags only |

- Spacing: Tailwind's default 4px scale.
- Elevation: `--shadow-e1/e2/e3`, warm and diffuse in light; in dark, surfaces
  are told apart by being lighter than the page.
- Motion: 150ms on controls, 500 to 600ms on bars and rings, `pop` and `wiggle`
  for personality. Everything non-essential goes under
  `prefers-reduced-motion: reduce`.

---

## 7. Interaction and accessibility rules

- **Focus:** one treatment everywhere, `3px solid var(--color-bite-700)`, offset
  2px (5.12:1 on cream). Inputs take the same ring.
- **Touch:** under `(pointer: coarse)` only, buttons, chips, tabs, inputs and
  nav items are at least 44px tall, icon buttons 44x44. An e2e test fails any
  control under 40x32.
- **No horizontal scroll** at 390px; filter rows wrap (`ChipRow`) rather than
  scroll sideways.
- **Selected chips** show a check icon (`ChipCheck`) and set `aria-pressed`, as
  well as the turquoise fill.
- **Icon-only controls** have an `aria-label`.
- **Search** (`SearchField`) has a clear button once there is text, 44px on
  coarse pointers, which returns focus to the box.
- **Unknown is not zero:** a figure built partly on missing data shows a `+` and
  is a floor; a day can say "3 of 5 entries fully known" (`KnownHint`).
- **Estimates:** screens where the figures are the point carry the
  `EstimatesNote`: "Calories are estimates worked out by Bite Buddy, not by your
  dietician. This isn't medical advice."

---

## 8. Components

### CSS utilities (`src/index.css`)

| Utility | What it is |
|---|---|
| `btn-primary` | `bite-500` fill, `on-brand` text, lifts 1px on hover |
| `btn-secondary` | Paper, `bite-700` text, `bite-200` border |
| `btn-ghost` | No fill until hover |
| `btn-danger` | `coral-800` fill, white text (6.66:1 in both themes) |
| `btn-icon` | Square icon button |
| `chip-off` / `chip-on` | Pill filter chips, 36px (44px on coarse) |
| `tab-on` / `tab-off` | Segmented control |
| `card` / `card-soft` | Raised card / flat nested panel |
| `input`, `label` | Form field and its label |
| `badge`, `tag` | Compact markers |
| `nav-item` / `nav-item-active` | Sidebar and More-sheet links |
| `meal-slot` | Dashed empty-slot target |
| `display` | Bungee |

`@utility` inlines its base, so a rule aimed at `.btn` will not match
`.btn-primary`; the coarse-pointer block lists every variant.

### React (`src/components/ui/index.tsx`)

`MacroBar` · `CalorieRing` · `StatusPill` · `NutrientSummary` · `TierBadge` ·
`SourceLine` · `EmptyState` (with the mark) · `EstimatesNote` · `KnownHint` ·
`SectionHeading` · `ChipCheck` · `SearchField` · `ChipRow`

### Brand and layout

`Logo` in `src/components/brand/`; `Sidebar`, `MobileNav`,
`StorageBanner`, `UndoBar` and `ErrorBoundary` in `src/components/layout/`.

### Mediterranean tiers

Symbol plus word, quiet enough for every food row: `● Daily`, `◐ Weekly` (leaf),
`○ Moderation` (cream and ink), `◇ Rarely` (mustard).

---

## 9. Navigation

Nine destinations, one list in `src/components/layout/nav.ts`: Home, Planner,
Recipes, Foods, Grocery, Schedule, Movement, Progress, Settings. The plan
archive is a tab inside Settings, and the dietician summary is a page under
Progress.

- **Desktop (md and up):** a sidebar with the Bitten B and all nine.
- **Phone:** a top bar with the logo, and a bottom tab bar
  **Home · Plan · + · Recipes · More**. The centre **+** opens the add sheet on
  today, at the slot for the time of day. **More** opens a sheet with the other
  six screens and reads as current while you are on one of them. The bar
  respects safe-area insets.

---

## 10. Voice

A competent friend in the kitchen. Warm and plain, British spelling, never
scolding about food. No points, streaks or levels. **No em dashes** (enforced by
`npm run text:check`; see `.claude/skills/no-em-dashes/`).

Good: "What's the plan?", "Nothing here yet. Pop something in.",
"Slightly over · +120 kcal".
Avoid: "You failed your calorie goal", "Cheat meal", "Bad foods".

---

## 11. Open items

- Over-target ring stroke `coral-500` is below 3:1 (see section 3).
- A few count badges still use `opacity-60` on text (Recipes, Grocery, the add
  sheet).
- Remove-filter chips (the active filters you tap to take off) have no check
  icon.
