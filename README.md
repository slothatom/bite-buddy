# Bite Buddy

*Plan your week. Eat well. Feel good.*

A meal planner built around real dietician plans and the Mediterranean diet.

One household, one shared week. Deployed free on GitHub Pages with a Supabase back
end, and it still runs entirely offline on your own machine with no account at all.

---

## What it's built on

Bite Buddy isn't seeded with invented recipes. Its library comes from two real sources:

**36 dietician plan documents** (October 2020 to November 2022, 18 in Hungarian and
18 in Romanian), **254 days, 1,255 meal lines**. These are parsed into **493 meal
recipes** and **83 underlying dishes**, every one traceable back to the line the
dietician wrote.

**An 89-page Mediterranean Diet guide**: its 17 food categories, allowed-lists and
serving goals become the food database's structure, the tier badges in the food
library, and the weekly serving scoring on the Progress screen.

Three things about that source data shape the whole app:

- **The unit of planning is a weighed portion, not a recipe.** `50 g paine int + 100 g humus,
  jumatate de farfurie de legume`. So a planned meal is a list of entries, and a snack is
  two food lines, not a fabricated recipe.
- **Weights are stated raw.** `50 g bulgur nefiert`, `100 g piept de pui crud`. Dry bulgur is
  roughly three times the calories of cooked, so the state a food is weighed in is part of its
  identity (`raw` / `dry` / `cooked` / `as-sold`).
- **The dietician's weeks mostly ran Wednesday to Tuesday.** The app's week is Monday to
  Sunday by default and can start on any day; loading a plan lines its days up by weekday,
  so a Wednesday meal still lands on Wednesday.

The dietician never wrote a single calorie. Supplying them is what this app adds, and the
app says so: every screen where the figures are the point carries "Calories are estimates
worked out by Bite Buddy, not by your dietician. This isn't medical advice."

---

## Look and feel

The full spec is [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md). In short: bold and
playful, roughly 70% calm (cream, ink, whitespace), 20% functional colour, 10%
personality, with the bold accents in navigation, headings and empty states while
dense working areas stay quiet.

**The Bitten B** is the brand: a capital B with a bite out of it and two crumbs. It is
the logo in the sidebar, the phone's top bar, the sign-in screen and the app icon, and
the illustration in empty states, errors and loading. There is no mascot. (Masters in
`brand/`, inlined in `src/components/brand/Logo.tsx`, icons rendered by `npm run icons`.)

**Colour.** Turquoise (`bite`) is the brand: primary buttons, the active nav item,
selected chips, the focus ring. Green (`leaf`) carries data and "this happened": on
track, eaten, filled bars. Mustard means slightly over, coral means well over. Cream
grounds, warm ink text.

**Light and dark.** Settings → Your week → Appearance: System (the default), Light or
Dark. The whole palette is tokens in `src/index.css`, redefined for dark, so no
component knows a theme exists (`src/lib/theme.ts`).

**Type.** Bungee for page titles and short expressive labels only, never recipe names,
tables or numbers. Plus Jakarta Sans for everything else. Both bundled, so the app looks
the same offline. Nothing is smaller than 12px, and no text is faded with opacity: past
days say **Past** and skipped meals say **Skipped**.

**Colour is measured, not asserted.** `npm run check:contrast` reads the tokens for both
themes out of `index.css` and the class pairs out of the components, so it grades what
ships rather than what a palette document claims. WCAG AA: 4.5:1 for words, 3:1 for large
text, icons and marks (it also measures the focus ring, the danger button and the calorie
ring). It pairs colours inside a single string literal, because a whole line is the wrong
unit: a ternary holds two alternatives that never appear together. It runs in `verify` and
in CI. One known gap: the well-over ring stroke, `coral-500`, is 2.64:1 on cream.

**Status is never hue alone.** `src/lib/status.ts` returns a label, a symbol and a signed
delta alongside the colour: bars show `+ Slightly over · +42 g`, the target sits on the bar
as an explicit line, and the calorie ring draws a second lap past 100% so 101% and 160% no
longer look the same.

**A total says how much of it is actually known.** Missing nutrient data means unknown,
never zero, so a figure built partly on silence is marked with a `+` and shown as a floor,
and a day says how many of its entries are fully known: "3 of 5 entries fully known".

**Mediterranean tiers** use a symbol and a word (`● Daily`, `◐ Weekly`, `○ Moderation`,
`◇ Rarely`), quiet enough to sit on every food row at once.

**Navigation.** Nine destinations (`src/components/layout/nav.ts`): Home, Planner, Recipes,
Foods, Grocery, Schedule, Movement, Progress, Settings. A sidebar on desktop. On a phone a
bottom tab bar, Home · Plan · **+** · Recipes · More, where the centre button opens the add
sheet on today at the slot for the time of day, and More opens a sheet with the other six.

**Filters wrap, they don't scroll.** `ChipRow` wraps and collapses to the first few behind
a `+N more`, with any active filter sorted to the front. A chip that is on shows a check
and sets `aria-pressed`, so the state is not carried by colour alone. Search boxes have a
clear button.

**Three axes, not one row of tags.** A recipe is described by three separate things:

| Axis | Cardinality | Where it comes from |
|---|---|---|
| **Meal time**: breakfast, lunch, dinner, snack | several | the plans |
| **Dish category**: what the food *is* | exactly one | `scripts/classify-recipes.ts` |
| **Quick filters**: what it asks of you | any number | derived, or applied by hand |

A category says what the food *is*, never when it is eaten or how it is served, which
rules out "Main", "Side" and "Bowl". There are 38; this library uses 23, and the filter
only offers the ones with something behind them. `CATEGORY_MEAL_TIMES` maps a category to
when it is usually eaten, but only as a *default*: a recipe's own meal times come from the
plans and always win.

---

## Features

### Home
Where you land: today's meals against your calorie ring, the week as seven bars, who else
is in the household and when they were last here, and whether your copy and theirs are in
step. If you and someone else changed the same thing, it is listed here with **Use theirs**
and **Keep mine** (see [what wins](#what-wins-when-two-people-change-something)).

**Worth a thought** is up to four things. The kitchen ones are about now: portions cooked
with nothing planned to eat them, something in the fridge a few days, a cook session
tomorrow with ingredients not in the house, a shopping list that no longer matches the
plan. The week ones are about balance against the Mediterranean guide. Four is a cap, not
a target, and nothing scolds. `src/lib/kitchen.ts` sets out the rules.

### Planner
A week, a fortnight or a month at a time, four slots a day (Breakfast, Lunch, Dinner,
Snacks), each holding any number of entries, with live totals against your targets. On a
phone the week is a list of days with every slot named in full.

- **Fill the gaps** proposes a breakfast, lunch or dinner for every empty one still ahead, from your own
  library. Arithmetic rather than a model: it prefers what is in the fridge, then what the
  cupboard covers, avoids what you ate in the last fortnight, aims near your target, and
  gives every proposal a reason. Nothing is written until you accept it.
  `src/lib/autoPlan.ts` explains the scoring.
- **The week is the one you are in.** The window is recomputed on start and when the app
  comes back to the foreground, and kept out of storage, backups and sync.
- **Targets are per person; the plan is not.** One week of meals, measured against whoever
  is looking. Which person a device shows is remembered per device.
- **A plan is an intention; a tick makes it a record.** Each meal cycles nothing said →
  eaten → skipped. Until something on a day is ticked its totals are "planned"; after,
  they are "eaten". A skipped meal is struck through and says Skipped, not red.
- **Portions can change after the fact**, in steps people actually eat in. Changing a
  portion gives the rest back to the fridge.
- **A batch can land in the week**: ticking off a cook session offers to put the portions
  into the days ahead. Off until asked for.
- **Saved weeks** keep a week you eat often, as offsets from the week start, and apply
  with "Replace 6" on the button. They sync as settings rows under a `template:` id.
- Each planned meal says **whether you can cook it tonight**, naming what is short, once
  the cupboard has something in it. `mealAvailability()` in `src/lib/pantry.ts`.

### Recipes
A row of **lenses**, each a different order as much as a filter, each printing its rule:

| Lens | Rule |
|---|---|
| Quick tonight | Twenty minutes or less, estimated for the imported meals. Quickest first. |
| From the cupboard | Everything it needs is something you have. Fewest ingredients first. |
| Use it up | Uses something in the cupboard with a date on it. Soonest first. |
| Fits today | Lands inside what is left of today against your target. Closest first. |
| Not lately | Nothing you have planned in the last month. Longest gap first. |
| Worth a batch | Makes more than one meal, and the plans came back to it. Most used first. |

They compose with search and chips, and a lens that cannot answer says what is missing.
`src/lib/discovery.ts` holds the rules. The dietician wrote portions, never methods, so an
imported meal's time is estimated from the hand-written dishes it contains and the dish
library's own medians (`cookingTimes.test.ts` pins them), and shown as "about 25 min".

576 recipes, searchable in English, Romanian or Hungarian. Every imported meal shows the
dietician's line as provenance, translated where the app knows the words and left as
written where it does not. Macros are derived from components, never stored.

Where the plans wrote the same food in different words, the importer keeps one recipe;
where the portion genuinely differs, both survive and the name says which, and variants
collapse into one card. You can also **merge** your own repeats: a merge records "this is
really that one" and deletes nothing, so archived weeks still resolve. Undo puts them back.

Every recipe is editable, the shipped ones included: the first change keeps your own copy
over the original, so **Revert** and **Delete** mean different things. **Deleting** hides a
recipe everywhere but keeps it resolvable, so a day you planned in March keeps its meal;
**Settings → Deleted recipes** puts it back. A recipe of your own can carry notes, a source
link (only http and https become links, `src/lib/links.ts`), an effort level and a photo.

Nine of the fourteen quick filters are derived from the recipe; the other five (Lazy Meals,
Leftovers, Fridge Clean-Out, Special Occasion, Budget Friendly) are judgements and are
yours to apply.

### Foods
148 foods with per-100 g nutrition, EN/RO/HU names and a Mediterranean tier. Editable and
deletable on the same terms as recipes (**Settings → Deleted foods**). Add your own by
hand, by USDA / Open Food Facts lookup, or by scanning a barcode. A lookup that fails says
why: rate-limited, offline, or the service down.

### Grocery list
Built from the planned week, resolving nested recipes down to what you buy, merged and
grouped by category. Weights are raw. Anything covered by a portion in the fridge is left
off. Amounts are counts where that is honest ("3 tomatoes", grams beside it). Share where
the browser can, the clipboard everywhere else.

The **Cupboard** tab holds what you have now and what you always have. A staple never
appears on a list again; an amount is optional, and blank means enough. "Have it" puts a
line in the cupboard. Nothing is decremented automatically.

### Schedule
Batch-cook sessions: date, time, dishes, and a weigh-out derived from each recipe. Ticking
a session off asks what came out of the pan; those portions go in the fridge or freezer
and are offered first the next time a slot needs filling. Leftovers work the same way.
With push set up, a reminder arrives fifteen minutes before a session.

### Progress
The week's calories and macros, Mediterranean serving goals (counted in the state the food
is in, with treats scored too), and body tracking: weight with an optional goal line, plus
waist, hips, chest, arms and thighs, one person at a time. Body rows are personal: each
carries whose it is, and still syncs so anyone can log from any phone.

**Summary for your dietician** (Progress → `/analytics/summary`): pick a span and a person,
read it, then **Download** one HTML file or **Print / Save as PDF**. It uses the app's own
rules for what a day came to and which figures are floors (`src/lib/export/`).

### Movement
Exercise and sleep, one person at a time. Workouts from an exercise search, costed against
that person's body weight, steps per day, and Garmin CSV import.

### Moments
Eight little firsts the app notices, a first day planned, a whole week, something cooked.
Each once, ever. Deliberately not a points system: nothing counts and nothing resets.
`src/lib/moments.ts`.

### Settings
Targets, exercise, week start, appearance, weight unit, **Your data** (backup and restore
as one JSON file; a backup from a different `SCHEMA_VERSION` is refused), deleted recipes
and foods, the weekly food check, and when signed in: account, **Household**, sync and
notifications. A second tab holds the **Plan history**: every original plan, with its own
wording, loadable into the planner. Settings works signed out.

---

## Targets

Two routes, either can be overridden:

- **From your plans**: averages what the dietician prescribed.
- **Calculator**: Mifflin-St Jeor from your body stats, adjusted for activity and goal.

---

## Households

A household is data (`supabase/migrations/20261109000100_households`): a row in
`households`, a row per person in `household_members` with a role and a person key, and
pending invites in `household_invites`. Every synced row belongs to a household.

| Role | Can |
|---|---|
| Viewer | see everything, change nothing |
| Editor | plan, cook, shop and log |
| Admin | all of that, plus invite, change roles and remove members |

- **Settings → Household**: admins invite by email with a role, change roles and remove
  people; the household always keeps at least one admin.
- An invite is accepted on that address's first sign-in.
- **First run**: an account with no invite is offered to start a household of its own,
  as admin.
- **The legacy guest list** (`allowed_emails`) still admits an address to the original
  household, as a transition, so nobody already using the app lost access. It no longer
  revokes anything: removing someone is done from the household.
- One household per account, for now.

Setup and the SQL are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## How your data is stored

Everything lives on the device first, in localStorage, and every screen reads from there.
That is what makes the app work with no signal and with no account at all.

When an account is configured, the shared copy lives in Postgres as **one row per thing**:
a meal, a weight, a shopping list line, a recipe you wrote. Each table carries `id`,
`household_id`, `data`, `updated_at`, `deleted_at` and `updated_by`, plus the few columns
the app filters on. Everything else stays inside `data`, since the types are enforced in
TypeScript. Rows are never removed, only marked deleted, which is also what keeps archived
weeks resolving.

| Under the old documents | Under rows |
|---|---|
| Saving a weight rewrote every weight | A write is about one thing |
| A deletion was an absence, which merging cannot express | A deletion is a row with `deleted_at`, a fact that travels |
| Every change sent the whole store | A pull asks for what changed since last time, every page of it |

Realtime pushes changes to every other open screen, **including your own other devices**:
echoes are skipped by content, not by who wrote them.

### What wins when two people change something

Per row, and local-first: a row this device changed and has not yet delivered stays, and
is sent. Anything else takes the server's version, deletions included. When someone else
changed the same row in the meantime, **their version is kept** on Home with **Use theirs**
(restore it here and send it on) and **Keep mine**, instead of being overwritten silently.

The device remembers a fingerprint of every row it has sent or received, which is what
makes a deletion detectable. If its own copy looks wiped, it **holds the deletions and
asks** which table and how many, with "I deleted those"; the answer covers one table once.
That is the difference between emptying a shopping list on purpose and a cleared browser
taking the other person's copy down with it.

---

## Deployment

Free end to end: **GitHub Pages** for the site, **Supabase** free tier for the database and
the sign-in links (magic links, no passwords). Signups are meant to be off: people get in
by invitation.

Everything is in [`docs/DEPLOY.md`](docs/DEPLOY.md): make the repo public, create the
Supabase project, add **three repository secrets** (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `SUPABASE_DB_URL`, the **session pooler** string on port
5432), set the sign-in URLs, and push. Every push to `main` then:

1. runs the whole of CI, end-to-end tests included;
2. applies migrations with `npm run db:migrate`;
3. checks the `VITE_` secrets look public (a `postgresql://` string or a non-anon key there
   would be baked into the public JavaScript) and builds;
4. publishes.

**Versioned migrations.** Each is `supabase/migrations/<timestamp>_<name>/migration.sql`,
runs once in its own transaction, and is recorded with a checksum in the
`bite_migrations` schema. The runner refuses an edited migration, a database ahead of the
code, or a half-finished run. `npm run db:check` runs every migration against PGlite on
each push. `SUPABASE_DB_URL` is read the way people paste it: stray spaces, quotes and
brackets are removed and the password is encoded, and a wrong value is described by its
shape, never printed.

### Reminders

An Edge Function, `supabase/functions/notify`, on a five-minute cron, sends **push
notifications only** (there is no email): fifteen minutes before a cook session, and when
someone else has changed the week and then been still for ten minutes. Each person turns
them on per device and picks which kinds under **Settings → Notifications**. The decisions
live in `supabase/functions/_shared/notify.ts`, with fourteen tests.

**On the current Supabase project this is not set up yet**: the function, its VAPID keys,
the public key row and the cron job all need doing again. The steps, and the query to run
when a notification does not arrive, are in
[`docs/DEPLOY.md`, Reminders](docs/DEPLOY.md#7-reminders-optional-push-notifications).
Without it the app works and simply never sends.

### Photos on recipes

The `photos` migration creates a private storage bucket. The app shrinks a photo to
1400px before upload and shows it through a signed URL, so a photo will not appear on a
phone that is fully offline and has not shown it before.

---

## Running it

Locally it needs no account and no network. Without `VITE_SUPABASE_URL` there is no
sign-in and no sync; the app runs on localStorage, which is also why the tests need no
database.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview    # http://localhost:4173
```

**Node 20.19+, 22.13+, or 24 and up** (`^20.19.0 || ^22.13.0 || >=24`, set by ESLint 10;
Vite 8 and Vitest 4 exclude much the same). CI runs Node 26.

`base` is `./`, so the built app runs from wherever it is put.

### On your phone, on your own wifi

```bash
npm run build && npm run serve    # prints a http://192.168.x.x:4173 address
```

Over a plain LAN address there is no service worker, so no install and no offline. For a
phone copy that works offline, use the one-file build.

### One-file build

```bash
npm run build:single   # dist-single/bite-buddy.html, CSS, JS and fonts inlined
npm run test:single    # asserts it makes no external request at all
```

No manifest, so it cannot be added to the home screen, and some viewers give it nowhere
to save: take a backup from Settings if unsure.

### Checks

```bash
npm run verify     # lint, typecheck, unit tests, data, text, contrast, db, function, icons, build
npm run test:e2e   # drives the real app in a browser, desktop and phone
```

### Optional

```bash
# .env.local, raises the USDA rate limit for ingredient lookup
VITE_USDA_API_KEY=your_key    # https://fdc.nal.usda.gov/api-guide.html
```

---

## The data pipeline

The plan data is generated, not hand-typed, so it stays reproducible and auditable.

```bash
npm run data:build -- <dir-with-the-.docx-plans>   # regenerate src/data/generated/
npm run data:build                                 # or from the committed archive
npm run data:check                                 # integrity checks
```

`scripts/build-data.ts` reads the `.docx` files directly and hands each meal line to
`scripts/lib/library.ts`, which resolves each fragment to a food or a dish. Without the
originals it rebuilds from the committed archive, which stores every line verbatim.

Judgement calls live in the data or the rules rather than the parser:

- `DISH_BY_WEIGHT` in `src/data/dishes.ts` marks dishes portioned by weight
  (`350 g ciorba a la grec`); elsewhere a stated weight names an *ingredient*.
- A food a dish in the same meal already contains is not added twice; where the
  dietician asked for more than the dish assumes, the difference is kept.
- Two lines with the same ingredients in the same amounts are one recipe, and the others
  become aliases in `recipeAliases.ts` so planned days still resolve.
- A duplicate name is settled by saying what differs, never by a number.

`scripts/check-data.ts` verifies every reference resolves, no recipe nests itself, every
source line maps to something, names are unique, no two recipes are identical, merged ids
still resolve, and each food's calories agree with its macros (fibre-aware Atwater). It
also rebuilds the library from the archive and compares it with what is committed.

---

## Tech

| Layer | |
|---|---|
| UI | React 19 + TypeScript 6 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, no config file) |
| Routing | React Router v7, hash-based so it works offline |
| State | Zustand + `persist` (localStorage) |
| Back end | Supabase: Postgres with row-level security, realtime, magic links, storage, one Edge Function |
| Build | Vite 8 · `vite-plugin-pwa` (Workbox) |
| Quality | ESLint 10 · Vitest · Playwright · PGlite for migrations |
| Nutrition lookup | USDA FoodData Central (CC0) · Open Food Facts (ODbL) |
| Barcodes | `@zxing/browser` |

TypeScript is held at 6 because typescript-eslint does not support 7 yet.

---

## Ingredients and nutrition

One search covers your own foods and recipes (instant, offline) and USDA and Open Food
Facts (a moment later). Picking a remote result saves it with its **provenance**: source,
the source's id, what the figures are per, and when they were fetched.

- **Missing means unknown, never zero.** `reportNutrients` marks a total built on gaps as a
  floor (`12 g +`).
- **Salt and sodium are one number**: sodium in mg is canonical, salt is
  `sodium × 2.5 ÷ 1000`.
- **Units** `g · kg · ml · l · piece · tsp · tbsp · cup`, converted to grams on entry;
  `piece` only where the food has named portions.
- Nutrition is derived at three levels (ingredient, recipe, serving), never stored.

---

## Guardrails

- **Data invariants**: `npm run data:check`, above.
- **Unit tests** on the parsing vocabulary and the nutrition maths, where a mistake gives
  a plausible wrong number rather than an error.
- **Lint** bans a `<button>` inside a `<button>`, a bug that shipped twice.
- **End-to-end tests** at desktop and phone sizes: no console errors, no horizontal
  scroll, every control at least 40x32px, nothing clipped at 390px, and a 12px text floor
  on the phone week.
- **Storage safety**: a full or blocked localStorage shows a banner rather than losing
  data; every store is schema-versioned (`SCHEMA_VERSION` in `src/store/persist.ts`).
- **Error boundary**: a recovery screen, not a blank page.
- **Accessibility**: 44px targets under `(pointer: coarse)`, one `bite-700` focus ring,
  reduced motion respected, decorative artwork `aria-hidden`, status never colour alone.
- **House style**: no em dashes, `npm run text:check`.

---

## Deliberately not done

**No "my plan" and "their plan".** A household shares its week by choice. The only
personal data is body, exercise and sleep.

**Your data is never served publicly.** The site is public; no plan, recipe of yours or
measurement is readable without signing in to the household.

## Not done yet

- **Push reminders on the new Supabase project**: function, VAPID keys, public key row
  and cron are not set up yet ([steps](docs/DEPLOY.md#7-reminders-optional-push-notifications)).
- **Over-target ring contrast**: `coral-500` is 2.64:1 on cream, under 3:1.
- **Recipe photos across households**: the storage policies check "is a member of some
  household", so a member of another household could read a photo if they knew its path.
- **One household per account**, enforced by a unique constraint.
- **Leftover text opacity** on a few count badges (`opacity-60`).
- **Remove-filter chips** have no check icon.
- **The dietician plans are public**: they ship in the site's JavaScript bundle and sit
  in this public repo (`src/data/generated/`). Moving them into Supabase behind the login,
  and the repo to private, is a decision still pending.
