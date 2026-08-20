# Bite Buddy, Bold & Playful Design System

> **Design direction:** funky, cosy, energetic, useful.  
> Bite Buddy should feel like a very competent meal planner that happens to have a personality, not a clinical nutrition dashboard and not a children's food app.

This design system builds on **Option 3, Bold & Playful** while respecting the shipped product constraints and content model in `DESIGNBRIEF.md`.

---

## 1. Design principles

### 1.1 Food first, numbers second
Nutrition data is important, but food remains the protagonist. Calories and macros should be easy to scan without making every screen feel like an analytics product.

### 1.2 Playful, never chaotic
Bold colour, chunky headings, doodles and Zig give Bite Buddy personality. Dense working areas, recipe lists, food tables, grocery rows and meal entries, stay calm and highly legible.

### 1.3 Inform, never judge
Going over a calorie target is information, not failure. Status is communicated through copy, iconography, pattern/shape and colour together.

### 1.4 Built for real kitchens
Phone controls are thumb-friendly and high-priority actions remain reachable one-handed. Desktop gets deliberate higher-density layouts rather than stretched mobile cards.

### 1.5 Provenance is part of the product
The original Romanian/Hungarian meal text is not metadata to hide completely. It gets a distinct secondary typographic treatment and remains available wherever provenance matters.

---

# 2. Brand personality

**Keywords:** bold · friendly · funky · cosy · clever · imperfect · foodie · optimistic

**Avoid:** clinical wellness · sterile SaaS · diet culture · childish kawaii overload · neon fitness app · excessive gamification.

The visual balance should be approximately:

- **70% calm:** off-white surfaces, ink, whitespace
- **20% functional colour:** lavender, muted category backgrounds, borders
- **10% chaos:** purple, coral, teal, mustard, Zig, stickers and doodles

---

# 3. Colour system

## Brand colours

| Token | Value | Purpose |
|---|---:|---|
| `bite-purple-500` | `#6D5BD0` | Primary brand/action |
| `bite-purple-600` | `#5947BE` | Hover |
| `bite-purple-700` | `#4938A7` | Pressed / strong text |
| `coral-500` | `#FF6868` | Warm accent |
| `teal-500` | `#00B8A9` | Data / positive progress |
| `mustard-500` | `#FFD166` | Highlights / attention |
| `lavender-100` | `#E9E4FF` | Soft branded surface |
| `cream-50` | `#FAF7F0` | App background |
| `paper-0` | `#FFFDF9` | Primary card surface |
| `ink-900` | `#2D2320` | Main text |
| `ink-700` | `#514744` | Secondary text |
| `ink-500` | `#817774` | Muted text |
| `border-200` | `#E6DED5` | Borders / dividers |

## Semantic colours

Brand accents must not double as semantic meaning.

| State | Colour | Additional signal |
|---|---|---|
| On track | Teal | check / plain status label |
| Slightly over | Mustard | `+120 kcal` text + marker |
| Well over | Coral | alert icon + explicit label |
| Error | Coral/dark coral | error icon + message |
| Info | Purple/blue-purple | info icon |
| Disabled | warm grey | reduced contrast + disabled state |

### Calorie target behaviour

**Under 105%:** neutral/on-track presentation.  
**105–130%:** `Slightly over · +120 kcal` using mustard plus a small `+` marker extending beyond the target line.  
**130%+:** `Over target · +430 kcal` using coral plus an alert marker.

Never rely on hue alone.

---

# 4. Typography

## Display
**Bungee** or a similarly chunky locally bundled display face.

Use only for:
- Wordmark
- H1
- occasional section/empty-state statement
- short expressive labels

Never use it for long copy, recipe names, tables or numeric data.

## UI / body
**Plus Jakarta Sans Variable**

Fallback: `system-ui, sans-serif`.

| Style | Size / line | Weight |
|---|---|---|
| Display XL | 36 / 40 | 800 |
| H1 | 30 / 36 | 800 |
| H2 | 24 / 30 | 700 |
| H3 | 20 / 26 | 700 |
| Body | 16 / 24 | 500 |
| Body strong | 16 / 24 | 700 |
| Small | 14 / 20 | 500 |
| Caption | 12 / 16 | 600 |
| Data XL | 32 / 36 | 700 |
| Data | 16 / 20 | 700 |

All numeric styles use `font-variant-numeric: tabular-nums`.

### Second-language treatment

English name:
**16px / 700 / Ink 900**

Original source:
**13px / 500 / Ink 500**, optionally prefixed by a tiny `RO` / `HU` language badge.

Do not use italics or ultra-low contrast. On dense cards it may truncate to one line; full source text is available in detail views.

---

# 5. Shape

Bite Buddy uses rounded geometry but should not become a collection of pills.

| Token | Value |
|---|---:|
| `radius-sm` | 8px |
| `radius-md` | 12px |
| `radius-lg` | 16px |
| `radius-xl` | 20px |
| `radius-card` | 24px |
| `radius-round` | 999px |

**Cards:** 20–24px  
**Inputs:** 14–16px  
**Buttons:** 14–16px  
**Chips:** full pill is allowed  
**Sheets:** 24–28px top corners

---

# 6. Spacing

4px base grid.

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

Default card padding:
- phone: 16px
- desktop compact: 16–20px
- hero/summary: 24px

---

# 7. Elevation

Use elevation sparingly.

### Level 0
Flat surface + border.

### Level 1
Normal cards. Very soft warm shadow.

### Level 2
Floating controls, sticky mobile navigation, menus.

### Level 3
Dialogs and sheets.

Avoid grey/black SaaS shadows. Shadows should feel warm and diffuse.

---

# 8. Buttons

## Primary
Purple fill, white text.

Use for the single strongest action in a context:
`Add meal`, `Save`, `Load week`.

## Secondary
Paper background, purple border/text.

## Tertiary / ghost
No fill until hover.

## Destructive
Coral/red treatment only for genuinely destructive actions.

## Icon-only
Minimum 44×44px on coarse pointers. Always has `aria-label`.

### Interaction
- hover: subtle colour shift / 1–2px lift
- pressed: return to baseline or 1px downward shift
- focus-visible: 3px outer purple focus ring with cream separation
- disabled: reduced contrast; no motion

---

# 9. Chips & tags

Chips carry filters and compact metadata.

Recipe filters may use playful category colours, but selected state must also use:
- stronger border
- check or selection indicator
- weight change

Examples:

`✓ Breakfast` `Lunch` `Quick` `High protein` `♥ Favourites`

Do not assign a completely unique colour to every one of the 13 tags.

---

# 10. Forms

Number entry is a first-class component because grams, calories and body measurements are entered frequently.

### Numeric input
Large tabular number + fixed unit suffix.

Example:

`[  125  ]  g`

Units never disappear when focused.

### Search
Search icon + clear action. On mobile it can become sticky on Recipes/Foods.

### Validation
Errors appear below the control with icon + plain-language explanation. Never indicate invalid state through red border alone.

---

# 11. Cards and rows

## Recipe card

Contains:
1. optional food thumbnail/illustration
2. English recipe name
3. original Romanian/Hungarian line
4. kcal
5. compact macro summary when useful
6. tags
7. favourite action

Desktop supports compact and comfortable density.

## Meal slot

Each of the five slots is a **container**, not a recipe card.

Header:
`BREAKFAST` + slot total

Then 1–6 meal-entry rows.

This respects the underlying dietician data where a meal consists of multiple weighed food entries.

## Food row

Left:
food name + translations + tier

Right:
kcal / protein / carbs / fat per 100g using aligned tabular columns.

## Grocery row

Designed for one-handed supermarket use:
- large checkbox
- ingredient
- amount
- category
- checked items remain readable but visually recede

---

# 12. Navigation

## Desktop
Persistent sidebar with all nine destinations:

1. Planner
2. Recipes
3. Foods
4. Grocery
5. History
6. Prep
7. Schedule
8. Progress
9. Settings

Desktop sidebar should be compact enough to leave room for working content.

## Mobile
Five-item bottom bar:

**Plan · Recipes · + · Grocery · More**

The centre `+` opens the most contextually useful creation action.

`More` exposes Foods, History, Prep, Schedule, Progress and Settings.

The bar remains reachable one-handed and respects safe-area insets.

---

# 13. Planner

The Planner is the product's visual centre.

### Week strip
Seven days using the configured week start. **Wednesday is the default.**

Each day shows:
- weekday
- date where relevant
- tiny kcal indicator
- today state
- selected state
- empty-day state

Never hard-code Monday-first visual assumptions.

### Daily summary

Primary:
`1,437 kcal`

Secondary:
`163 kcal remaining`

Then calorie progress + four macro bars.

Numbers remain more prominent than decorative graphics.

### Meal area
Five vertically ordered slots:

Breakfast  
Snack 1  
Lunch  
Snack 2  
Dinner

Each can contain multiple entries.

---

# 14. Data visualisation

All data components belong to one visual family.

### Calorie ring
Use for a single day's overview only.

### Macro bars
Protein · Carbs · Fat · Fibre.

Actual and target are explicitly distinguishable.

### Weekly chart
Seven vertical bars. The target is represented as a line, not only inferred from bar colour.

### Mediterranean goals
Seven quiet progress rows rather than seven competing colourful charts.

Each row contains:
icon · category · actual / goal · progress.

---

# 15. Mediterranean tiers

Do not use four colours alone.

Use compact text+symbol badges:

- `● Daily`
- `◐ Weekly`
- `○ Moderation`
- `◇ Rarely`

Colour can reinforce the distinction but the word and symbol carry the meaning.

These badges must remain quiet enough for 122-row food lists.

---

# 16. Zig, Bite Buddy character

Zig is an **abstract bite-shaped creature**, not a bowl or literal food.

Personality:
curious · energetic · slightly chaotic · supportive · never judgemental.

### Zig appears in
- onboarding / first-run
- empty states
- successful week-planning moments
- errors
- occasional contextual hints
- app icon / brand moments

### Zig does NOT appear in
- every card
- every navigation item
- every calorie warning
- dense food tables
- repetitive grocery rows

### Core poses
- Default Zig
- Chef Zig
- Hungry Zig
- Thinking Zig
- Celebration Zig
- Oops Zig
- Sleeping / prep-timer Zig

Illustration style: bold irregular silhouette, black/ink hand-drawn outline, simple facial features, tiny imperfect limbs.

---

# 17. Iconography

Simple rounded outline icons, approximately 2px stroke.

Icons should feel slightly hand-drawn without compromising recognition.

Food-category icons can be filled illustrations; functional icons remain line-based.

All icons ship as inline SVG. No external icon CDN.

---

# 18. Illustration

Illustrations use:
- thick ink outlines
- flat fills
- minimal shading
- imperfect geometry
- occasional doodle marks
- limited palette

Food illustrations should look appetising rather than scientifically accurate.

Avoid stock photography as a core dependency; the product must work fully offline.

---

# 19. Motion

Default:
- controls: 120–160ms
- sheets/dialogs: 180–240ms
- data transitions: 400–600ms

Personality motion can include tiny bounce/wiggle effects for Zig and celebratory states.

Under `prefers-reduced-motion: reduce`, all nonessential animation is removed and state changes become immediate.

---

# 20. Feedback states

### Success
`Meal copied`

Soft teal surface + check.

### Slightly over
`Slightly over · +120 kcal`

Mustard surface + `+` marker. Neutral language.

### Well over
`Over target · +430 kcal`

Coral surface + alert icon. Still informational rather than scolding.

### Empty
Zig may appear.

`Nothing planned for Thursday yet.`  
`Pop something in when you're ready.`

### Error
Oops Zig.

`Oops, something spilled.`  
`This screen tripped over itself. Your recipes and plans are safe.`

### Offline
Do not treat offline as an error. Offline is normal product behaviour.

---

# 21. Desktop density

Desktop receives a deliberate compact density.

Differences may include:
- shorter row heights
- reduced card padding
- 3-column recipe grid
- persistent filters/sidebar
- data columns visible without opening details

Touch sizing overrides remain limited to coarse pointers.

---

# 22. Dark mode

**Recommended: yes, but Phase 2 of the visual implementation.**

The app is realistically used in kitchens at night, so dark mode adds value. However, stabilise the light palette and semantic tokens first.

Dark mode should be warm charcoal/aubergine rather than pure black and should preserve the playful accent palette without turning neon.

---

# 23. Accessibility

Required:
- coarse-pointer targets ≥44px preferred and never below existing tested minimum
- visible custom focus state
- WCAG contrast audit before palette lock
- no semantic state conveyed through colour alone
- reduced-motion support
- no horizontal viewport overflow at 390px
- icon-only controls labelled
- tabular numerals for nutrition figures
- long names and 187-character source lines handled without layout breakage

---

# 24. Tone of voice

Bite Buddy sounds like a competent friend in the kitchen.

### Good
**What's the plan?**

**Your week is looking delicious.**

**Nothing here yet. Pop something in.**

**Slightly over · +120 kcal**

**You've got dinner covered.**

### Avoid
`You failed your calorie goal.`

`Bad foods`

`Cheat meal`

`You have exceeded your allowance.`

`Congratulations! You earned 40 XP for staying under calories!`

Food is data and enjoyment, not morality.

---

# 25. Tailwind v4 token starter

```css
@theme {
  --color-bite-500: #6D5BD0;
  --color-bite-600: #5947BE;
  --color-bite-700: #4938A7;

  --color-coral-500: #FF6868;
  --color-teal-500: #00B8A9;
  --color-mustard-500: #FFD166;
  --color-lavender-100: #E9E4FF;

  --color-cream-50: #FAF7F0;
  --color-paper: #FFFDF9;

  --color-ink-900: #2D2320;
  --color-ink-700: #514744;
  --color-ink-500: #817774;
  --color-border-200: #E6DED5;

  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.25rem;
  --radius-card: 1.5rem;
}
```

---

# 26. Product decisions locked by this system

1. **Bold & Playful is the primary visual direction.**
2. Zig is an abstract bite-shaped companion, not a food bowl.
3. Purple is the brand primary; teal/mustard/coral handle supporting and semantic roles.
4. Over-target states use explicit labels and markers, never colour alone.
5. Mediterranean tiers use symbol + text + optional colour.
6. Original Romanian/Hungarian content remains visible as deliberately styled provenance.
7. Desktop gets a compact density.
8. Wednesday remains the default week start and all calendar components support configurable starts.
9. Light mode is the initial implementation target; dark mode is recommended as a follow-up.
10. Personality concentrates around navigation, headings, empty states, illustrations and moments of delight. Dense data remains calm.
