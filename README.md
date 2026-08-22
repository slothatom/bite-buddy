# 🫐 Bite Buddy

*Plan your week. Eat well. Feel good.*

A meal planner built around one person's actual dietician plans and the Mediterranean diet.

Two people, one shared week. Deployed free on GitHub Pages with a Supabase back end,
and it still runs entirely offline on your own machine with no account at all.

---

## What it's built on

Bite Buddy isn't seeded with invented recipes. Its library comes from two real sources:

**14 dietician plan documents** (Jan 2021 in Hungarian, Apr–Nov 2022 in Romanian), **97 days,
481 meals**. These are parsed into **204 named meal recipes** and **71 underlying dishes**,
every one traceable back to the line the dietician wrote.

**An 89-page Mediterranean Diet guide**, its 17 food categories, allowed-lists and serving
goals become the food database's structure, the tier badges in the food library, and the
weekly serving scoring on the Progress screen.

Three things about that source data shape the whole app:

- **The unit of planning is a weighed portion, not a recipe.** `50 g paine int + 100 g humus,
  jumatate de farfurie de legume`. So a planned meal is a list of entries, a snack is two food
  lines, not a fabricated recipe.
- **Weights are stated raw.** `50 g bulgur nefiert`, `100 g piept de pui crud`. Dry bulgur is
  roughly three times the calories of cooked, so the state a food is weighed in is part of its
  identity (`raw` / `dry` / `cooked` / `as-sold`).
- **The dietician's weeks run Wednesday to Tuesday.** The app's week is the ordinary
  Monday → Sunday; loading a plan lines its days up by weekday, so a Wednesday meal still
  lands on Wednesday. The start day is configurable in Settings.

The dietician never wrote a single calorie. Supplying them is what this app adds.

---

## Look and feel

Implements `docs/DESIGN-SYSTEM.md`, Bold & Playful. The balance it asks for is
roughly 70% calm (paper, ink, whitespace), 20% functional colour, 10% chaos, so
the bold accents concentrate in navigation, headings, empty states and moments
of delight while dense working areas stay quiet.

**Zig** is the mascot: an abstract bite-shaped creature, deliberately not a bowl
or a piece of food, the silhouette is a lumpy blob with a bite out of one
shoulder, so the name is in the shape rather than illustrated literally. Six
moods (`happy`, `sleepy`, `oops`, `chef`, `celebrate`, `thinking`) drawn inline
as SVG in `src/components/brand/Mascot.tsx`. He appears in empty states, errors
and brand moments, never on every card or in dense tables.

**Colour.** Purple `#6D5BD0` is the single brand primary. Teal carries data and
positive progress, mustard means slightly over, coral means well over. Cream
grounds, warm ink text.

**Type.** Bungee for the wordmark, page titles and short expressive labels only
- never for recipe names, tables or numeric data. Plus Jakarta Sans for
everything else. Both bundled, not fetched from a CDN, so the app looks the same
offline.

**One palette.** The app is cream and ink, and only that. A dark theme existed
and has been taken out: it doubled every colour decision, and the guard it
needed, a walk over every screen looking for text whose contrast against its
painted background collapsed, was catching bugs that only a second palette
could create.

**Colour is measured, not asserted.** `npm run check:contrast` reads the tokens
out of `index.css` and the class pairs out of the components, so it grades what
ships rather than what a palette document claims. WCAG AA: 4.5:1 for words,
3:1 for large text and for icons, which is the bar WCAG actually sets for a
graphic. It found twenty six combinations below the line, including the muted
text colour used in 189 places, and it runs in `verify` and in both workflows
so they cannot come back.

The pairing is done inside a single string literal, which sounds like a detail
and is not. A whole line is the wrong unit: a ternary holds two alternatives
that never appear together, and a table of style variants holds a fill, a text
colour and a surface as separate keys, where the fill is a dot rather than the
ground the words sit on. Measuring by line reported a third more failures than
exist, and a check that cries wolf is one people learn to silence.

**Status is never hue alone.** `src/lib/status.ts` returns a label, a symbol and
a signed delta alongside the colour level, and every consumer renders at least
one of them: bars show `+ Slightly over · +42 g`, and the target sits on the bar
as an explicit line rather than being inferred from where the fill stops.

**Mediterranean tiers** use a symbol and a word (`● Daily`, `◐ Weekly`,
`○ Moderation`, `◇ Rarely`), quiet enough to sit on 122 food rows at once.

**Navigation.** Ten destinations in the desktop sidebar; on a phone the bar is
Home · Plan · **+** · Recipes · More, where the centre button opens the first
empty meal slot and More holds the remaining six screens.

**Filters wrap, they don't scroll.** Foods has 17 category chips; a horizontal
scroller showed four of them and hid the rest with no affordance. `ChipRow`
wraps and collapses to the first few behind a `+N more`, and callers sort any
active filter to the front so a live filter is never behind the toggle.

**Three axes, not one row of tags.** Recipes used to offer thirteen tags side by
side, meal times, diets and dish shapes as if they answered the same question.
A recipe is now described by three separate things:

| Axis | Cardinality | Where it comes from |
|---|---|---|
| **Meal time**, breakfast, lunch, dinner, snack | several | the fourteen plans |
| **Dish category**, what the food *is* | exactly one | `scripts/classify-recipes.ts` |
| **Quick filters**, what it asks of you | any number | derived, or applied by hand |

A category says what the food *is*, never when it is eaten, how it is served or
how it was cooked, which rules out "Main", "Side" and "Bowl": those describe a
role at a table and tell you nothing when you are deciding what to make. There
are 38 of them; this library uses 19, and the filter only offers the ones with
something behind them.

**Grain** is the 38th, added because Rice, Pasta and Noodles left nowhere for the
bulgur, couscous and quinoa this library runs on, those dishes fell through to
their protein, so there was no way to ask for a grain bowl. It means *the grain
is the dish*: "Bulgur with chicken breast" is one, "Zucchini patties with bulgur"
is not. Mămăligă sits here rather than under Porridge, since in these plans it
arrives under cottage cheese as the starch of a meal rather than in a bowl with
a spoon; oats stay Porridge, which is the distinction the two categories are for.

`CATEGORY_MEAL_TIMES` maps a category to when it is usually eaten, but only ever
as a *default*: a recipe's own meal times come from the plans, which is actual
evidence, and always win. The mapping fills the gap for the 71 batch-cooked
dishes, which were never a meal in a plan and so carry no meal time, without it
the planner would never offer you the lentil stew for lunch.

---

## Features

### Home
Where you land: today's meals against your calorie ring, the week as seven bars, and who
else is in the household and when they were last here. On the deployed app it also says
whether your copy and theirs are in step.

**Worth a thought** is up to four things, and they come from two places. The kitchen ones
are about now: portions cooked with nothing planned to eat them, something that has been in
the fridge a few days, a cook session tomorrow with two of its ingredients not in the house,
a shopping list that no longer matches the plan, three meals this week that all want
spinach. The week ones are about balance against the Mediterranean guide, which matters and
never matters today, so they sort below.

Four is a cap rather than a target. A screen that raises five things is one people learn to
scroll past, which costs the one that actually needed saying. Nothing scolds, and nothing
passes a verdict on food it cannot see: "in the fridge 6 days" is a fact you can act on,
"expired" is not the app's to say. `src/lib/kitchen.ts` sets out the rules.

### Planner
**Fill the gaps** proposes a meal for every empty breakfast, lunch and dinner on screen, from
your own library. It is arithmetic rather than a model: it prefers what is already in the
fridge, then what the cupboard covers, avoids what you ate in the last fortnight, aims each
day near your calorie target, and gives every proposal a reason you can check. Nothing is
written until you accept it, anything can be dropped first, and it works with no signal
because there is nothing to phone. `src/lib/autoPlan.ts` explains the scoring.

A week, a fortnight or a whole month at a time, five slots a day (breakfast, two snacks,
lunch, dinner), live totals against your targets, and copy a day onto another day. The week
starts on Monday by default and can start on any of the seven; loading an archived plan lines
its days up by weekday, so a Wednesday meal still lands on a Wednesday.

**Saved weeks** keep a week you eat often so it can be dropped onto one that has not
happened yet. Held as offsets from the start of the week rather than as dates, so a saved
week lands the same way whichever day yours begins on, and every copied meal gets its own
id so moving one does not move the other. Applying replaces the week rather than merging
into it, which is the honest behaviour and also the destructive one, so it counts what is
already there and puts the number on the button: "Replace 6". Nothing moves until that
second tap.

They sync like everything else, without a migration: a saved week is a row in the settings
table under a `template:` id. A new table would have meant new SQL to find, paste and run
before the feature worked at all, which is a poor trade for a prefix.

Each planned meal also says **whether you can actually cook it tonight**: either everything
it needs is in, or the two or three things that are short, named rather than counted, since
"3 missing" sends you to open the cupboard anyway. It stays quiet until the cupboard has
something in it, because an empty cupboard means the app does not know what you have, not
that you have nothing. Portions from the fridge are already yours, so they never count as
shopping. `mealAvailability()` in `src/lib/pantry.ts` does the work.

### Recipes
A row of **lenses** across the top, because nobody stands in a kitchen at seven wondering
about categories. They wonder what is quick, what can be made from what is in, and what
needs using up. Each is a different order as much as a different filter, and each prints its
rule underneath, since a filter nobody can explain is a filter nobody trusts:

| Lens | Rule |
|---|---|
| Quick tonight | Twenty minutes or less, start to plate. Quickest first. |
| From the cupboard | Everything it needs is something you have. Fewest ingredients first. |
| Use it up | Uses something in the cupboard with a date on it. Soonest first. |
| Fits today | Lands inside what is left of today against your target. Closest first. |
| Not lately | Nothing you have planned in the last month. Longest gap first. |
| Worth a batch | Makes four or more, and keeps. Most portions first. |

One at a time, and they compose with the search and the chips, so "quick" inside "soups" is
a sensible question. A lens that cannot answer, "from the cupboard" with an empty cupboard,
says what is missing rather than showing an empty screen that reads as "you have no
recipes". `src/lib/discovery.ts` holds the rules.

A recipe of your own can also carry **your notes**, **where it came from** and **how much
of an evening it is** (easy, some effort, a project). Three levels rather than five,
because the only thing that has to be told apart is a Tuesday from a Sunday.

A source link is checked before it is stored and again before it is shown. Only http and
https ever become a link: a recipe is data, it can arrive from a backup, from the other
phone or from the assistant, and `javascript:` in an href is a script running on your page
with your session. `src/lib/links.ts` is four lines of that and a test for each way in.

275 recipes on six shelves, opening on the meal you are most likely looking for at this hour.
Searchable in English, Romanian or Hungarian, typing `telemea` or `zabpehely` finds the right
thing. Every imported meal shows the original dietician line as provenance. Macros are always
derived from components, never stored, so they can't drift out of date.

The plans write the same dish more than once, sometimes at a different portion, more often
just worded differently (`supă de fasole verde` one week, `ciorbă de fasole verde` the next),
which is why 68 of the 204 imported meals are numbered repeats. Those collapse into one card
with the wordings inside it, taking the library from 275 cards to 207.

Collapsing them is only a display; they can also be **merged** for real, which takes them out
of the library and out of the planner's picker. 21 of the 45 repeated dishes have versions that
come to identical numbers, and those are offered as a one-tap tidy, the other 24 differ by
portion (`Spicy chicken & vegetable pan` runs 259 to 408 kcal), which is a real choice and is
never swept up automatically; merge those by hand from the recipe itself.

A merge deletes nothing. It records "this recipe is really that one", and every lookup resolves
through the note, which is what lets you merge something a planned day already names, or
something one of the fourteen archived weeks refers to, since those ids live in code and cannot
be rewritten. Undo puts them back.

Filtering combines all three axes, `Dinner` + `Soup` + `💪 High Protein`, with the category
and the fourteen quick filters behind two buttons rather than fifty chips, and whatever you
pick coming back as a chip you can take off.

Nine of the fourteen quick filters are derived from the recipe: time, macros, and what goes in.
The other five are not, and are left empty rather than guessed at. Lazy Meals, Leftovers,
Fridge Clean-Out and Special Occasion are judgements about a particular week in a particular
kitchen. **Budget Friendly** is the interesting one: the app holds no prices, and the nearest
guess, "contains nothing expensive", was true of 83% of the library, because Mediterranean
home cooking out of a Romanian supermarket is cheap almost by definition. A filter matching
four recipes in five narrows nothing, so it is yours to apply.

Every recipe is editable, including the 275 that ship in code: the first change keeps a copy
of your own and the original stays underneath, so **Revert** and **Delete** are separate
buttons that mean different things.

**Deleting** takes a recipe out of the library, search, the planner's picker, your favourites
and every filter, but does not destroy it. A day you planned in March names the recipe by id
rather than storing a copy, so throwing it away turned that day's dinner into a blank worth
zero calories, quietly rewriting your own history. Deleted recipes stay resolvable: the day
keeps its meal and its numbers, with the entry marked `deleted`. **Settings → Deleted recipes**
puts them back. Ingredients are never touched, other recipes use them. **New recipe** writes one from scratch, name, shelf,
labels, weighed ingredients (foods or other recipes) and a method, with the nutrition derived
as you type rather than entered.

### Foods
122 foods with per-100 g nutrition, each carrying EN/RO/HU names and a Mediterranean tier.
Every one is editable and deletable, the curated ones included: the first change keeps a copy
of your own with the original underneath, so **Revert** and **Delete** mean different things.
Deleting takes a food out of the library without destroying it, a food is named by every
recipe that contains it *and* directly by the snack lines in your plan, so throwing it away
would blank all of them at once. **Settings → Deleted foods** puts them back
(daily / weekly / moderation / rarely). Add your own by hand, by USDA / Open Food Facts
lookup, or by scanning a barcode. A lookup that fails says why, rate-limited, offline, or
the service being down, rather than reporting "no results" for a food the database has.

### History
All 14 plans as a browsable archive with the original Romanian and Hungarian preserved
verbatim. Load any week straight into the planner.

### Grocery list
Built from the planned week, resolving nested recipes down to what you actually buy, merged by
food and grouped by category. Weights are raw, matching how the plans are written. Anything
covered by a portion already in the fridge is left off, since it is already cooked.

A second tab holds the cupboard. Two kinds of entry and the difference matters: something you
have now, and something you always have. A staple never appears on a list again, which is the
setting that earns its place, without it a week of real cooking produces forty lines and
thirty of them are salt, oil and flour. An amount is optional: blank means enough, which is
what anybody means when they say they have olive oil, and a number is believed and subtracted,
because 200 g of the 500 g a week needs is a different answer.

"Have it" on any line puts it in the cupboard rather than merely removing it, so the next
rebuild does not ask again. Nothing is ever decremented automatically. The cupboard is in your
kitchen and the app has never seen it.

A recipe says what it would still cost you a trip for. Worded as a list rather than a
verdict: whether three missing things is a lot depends entirely on which three.

### Moments
Eight little things Zig notices, a first day planned, a whole week, something actually
cooked. Each once, ever, then he stops. Deliberately not a points system: nothing counts,
so nothing can be lost, and nothing resets. A streak works by threatening you with what
you lose by stopping, which is a poor thing to aim at somebody's eating, a week where you
skip the planner is a normal week. `src/lib/moments.ts` says so at greater length.

### Backup
Settings → Your data. Download or copy everything you've entered as one JSON file, and restore
it from a file or a paste. There's no account behind the app, so this is the only copy that
survives clearing browser data, switching phone, or a browser that won't let the page save at
all. A backup from a different `SCHEMA_VERSION` is refused rather than merged into a shape it
no longer fits.

### Progress
The week's calories and macros, Mediterranean serving goals against the guide, and body
tracking, which is **the one thing in the app that is not shared**.

The week, the targets, the recipes and the grocery list are shared on purpose: you eat the
same dinners. A waist measurement is not that, and averaging two people into one trend line
is a graph of nothing. Every weight and measurement carries the id of whoever it belongs to,
and the Body tab shows one person at a time. The rows still sync, so either of you can log
from either phone, shared storage, separate histories.

Weight, plus waist, hips, chest, arms and thighs, each with its own trend. Fill in whichever
you took: a blank means not measured that day, so it gets no card and never reads as a change.
Entries logged before the app knew who was who stay unclaimed rather than being handed to
whoever is looking; the screen offers to claim them.


### Movement
Exercise and sleep, one person at a time. Workouts are built from an exercise search and
costed against that person's own body weight, steps are logged per day, and a Garmin CSV
export can be imported rather than retyped. Like the Body tab, none of it is shared: every
row carries whose it is.

### Schedule
Batch-cook sessions, since the plans deliberately repeat one dish across several days. A
session holds a date, a time and the dishes it covers, with a weigh-out derived from each
recipe's components, nested recipes resolved and duplicates merged, because the dietician
wrote portions rather than instructions. Both people get an email before a session starts.

Ticking a session off asks what came out of the pan, because that is the one moment
anybody knows. Those portions go in the fridge or the freezer and are offered first the
next time a meal slot needs filling, which is the entire point of cooking in advance and
the thing the app used to make harder: a batch had to be typed in on each day it covered,
and the shopping list bought its ingredients again every time.

Leftovers are the same mechanism with a different label. A recipe when it was one, free
text when it was not, because half a lasagne somebody improvised is a real thing in a real
fridge.

None of it is an inventory. Nobody weighs what they took out of the tub, so the count is a
note to yourselves: always editable, allowed to be wrong, and never the reason something
refuses to work. A planned portion comes off the count, unplanning it puts it back, and a
portion already eaten stays on record so the day it fed still says what it was.

---

## Targets

Two independent routes, because they answer different questions, and either can be overridden:

- **From your plans**, averages what the dietician actually prescribed across the 14 weeks.
- **Calculator**, Mifflin-St Jeor from your body stats, adjusted for activity and goal.

---

## How your data is stored

Everything lives on the device first, in localStorage, and every screen reads
from there. That is what makes the app work with no signal and with no account
at all: run it yourself without Supabase keys and there is no sign-in, no
network, and nothing missing.

When an account is configured, the shared copy lives in Postgres as **one row
per thing**: a meal, a weight, a shopping list line, a recipe you wrote. Not one
document per store, which is what it used to be and which caused the worst bug
this app has had.

A document says what exists. Three consequences, all of which bit:

| Under documents | Under rows |
|---|---|
| A write is all or nothing, so saving a weight rewrote every weight | A write is about one thing, so two people rarely contend at all |
| A deletion is an absence, and merging two lists cannot express "this went away" | A deletion is a row with `deleted_at` set, a fact that travels like any other |
| Every change sent the whole store | A pull asks for what changed since last time |

Each table carries `id`, `data`, `updated_at`, `deleted_at` and `updated_by`,
plus the few columns the app filters on: `day`, `member_id`, `slot`. Everything
else stays inside `data`. That is a deliberate middle position: a column per
field would be more conventional and would mean a database migration every time
a recipe gains one, for no gain, since this database has exactly one client and
the types are enforced in TypeScript. What matters is that **the unit of change
is a row**, because that is what was wrong before.

Rows are never removed, only marked deleted, which is also what keeps archived
weeks resolving: a plan from 2022 names a recipe by id, and that id still finds
something.

`supabase/rows.sql` creates it all, and ends with a one-time import that reads
whatever the old `app_state` documents hold and writes them out as rows. The old
table is left alone.

### What wins when both of you change something

Per row, and local-first: a row this device changed and has not yet delivered
stays, whatever the server says. Anything else takes the server's version,
including its deletions. When both copies moved since they last agreed, theirs
is kept and yours is reported on screen rather than disappearing quietly.

The device remembers a fingerprint of every row it has sent or received, which
is what makes a deletion detectable at all, and it is persisted so a deletion
made offline survives being closed. If local state is empty but that record is
full, the app refuses to publish it: that is what a cleared browser looks like
from the inside, and sending it faithfully would take the other person's copy
down too.

---

## Deployment

Free end to end: **GitHub Pages** for the site, **Supabase** free tier for the
database and the sign-in links. Sign-in is a magic link, no passwords, and the
guest list lives in the database, so an address that isn't on it cannot create
an account even with the URL and the key.

Everything is shared between the two accounts: one week, one grocery list, one
recipe library. It syncs as rows, one per meal, weight or shopping line, and
Postgres realtime pushes changes to the other screen as they happen. See
[how your data is stored](#how-your-data-is-stored) for what wins when you both
change the same thing.

Setup is five steps, all in [`docs/DEPLOY.md`](docs/DEPLOY.md): make the repo
public, create the Supabase project, run `supabase/schema.sql` and then
`supabase/rows.sql`, add two repository secrets. Every push then deploys
itself.

### The recipe assistant

Optional, and the only feature in the app that calls a model. You paste a
recipe, from a website or a message or a few lines of your own shorthand, and it
comes back as a draft: named, weighed in grams, ingredients matched to foods you
already have, with a method if the paste had one.

```bash
supabase login                                        # once, opens a browser
supabase link --project-ref <your-project-ref>        # the id in your Supabase URL
supabase secrets set ANTHROPIC_API_KEY=...            # from console.anthropic.com
supabase functions deploy recipe-assistant
```

This repository holds no `supabase/config.toml`, so the CLI has nothing to
deduce the project from: without the link step, or a `--project-ref` on each
command, it stops and asks. The project ref is the subdomain of your Supabase
URL, and it is not a secret, it is already in the public bundle.

The key lives on the function and never reaches a browser, which is the whole
reason this is a function at all: the site is public, and a key in the bundle is
a key anyone can read and spend. The function checks that the caller is in the
household before it spends anything, using the same membership row every policy
in the database consults.

Three rules it works under, in `supabase/functions/recipe-assistant/index.ts`
and enforced again on the way back in `src/lib/recipeDraft.ts`:

- **No nutrition ever comes from the model.** There is no field for a calorie in
  what it returns. Ingredients are matched to your food database and every
  number is computed from those, so a model that hallucinates cannot put a
  figure on a screen about what you eat.
- **It cannot invent a category or a filter**, only choose from the ones this app
  has. Anything else is dropped when the reply is read.
- **A miss is reported, never guessed.** An ingredient it cannot match to a food
  you have comes back as a name and a weight, listed for you to resolve. A wrong
  match is a wrong number nobody would ever notice.

Nothing is saved until you press save. Without the key the button is still
there and says the assistant is not set up, and every other way of writing a
recipe works exactly as before.

### Reminders and notifications

The one part of the app that needs something running when nobody is looking at
it: a browser that is closed sends no email and receives no push. It is an Edge
Function called `notify` on a five-minute schedule, and it does two jobs.

**Before a cooking session.** An email to everyone on the household list,
fifteen minutes before, and a push to whichever devices asked for one. The time
is worked out by the browser that scheduled it: "18:00" is an instant only once
you know where the person typing it was standing, and the server does not. Each
reminder is recorded in `reminder_log` so it is sent once, and only after
something actually arrived, so a run that reached nobody tries again rather
than recording a send that never happened. Sending it twice is worse than
sending it late, because the second one teaches you to ignore the first.

**When the other one of you changes the week.** Push only. An email saying
"Oli moved Thursday" is an email nobody wants. Nothing is sent until they have
been still for ten minutes, so planning a week is one line rather than thirty,
and you are never told about your own edits.

The whole of that decision, what to send and when, lives in
`supabase/functions/_shared/notify.ts`, which has no imports so it runs under
vitest with the rest of the app. Fourteen tests cover it. The encryption and
delivery around it belong to `web-push` and to Google.

#### Setting it up

Three parts, and each works without the others. Email needs no VAPID keys, push
needs no Resend account.

```bash
# 1. The function
supabase functions deploy notify

# 2. Email, if you want it
supabase secrets set RESEND_API_KEY=...        # a free Resend account
supabase secrets set REMINDER_FROM="Bite Buddy <hello@yourdomain>"

# 3. Push, if you want it
npx web-push generate-vapid-keys               # prints a public and a private key
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:you@yourdomain
```

Run `supabase/push.sql` in the SQL editor, then put the **public** half of the
key where the app can read it:

```sql
insert into public.push_config (key, value)
values ('vapid_public', 'BEl62i...')
on conflict (key) do update set value = excluded.value;
```

That key is public by design. It is handed to the push service on every
subscription and authorises nothing on its own, which is why it can live in a
table the app reads rather than in a repository secret and a rebuild. The
private half never leaves the function's secrets.

Then schedule it, either by uncommenting the `cron.schedule` block at the
bottom of `supabase/schema.sql` and filling in the project ref, or from the
dashboard under Integrations > Cron, which avoids putting a key in SQL at all.

Each person turns notifications on per device, in Settings. Per device rather
than per person because a phone is what gets notified, and because the profile
syncs: putting the setting there would mean switching it off on your phone
switched it off on theirs. On Android it is more reliable once the app has been
added to the home screen.

Without any of this the toggle still saves and the app simply never sends.
Nothing else depends on it.

---

## Running it

Locally it needs no account and no network. Without `VITE_SUPABASE_URL` set
there is no sign-in screen and no sync, the app runs entirely on localStorage,
which is also why the test suite needs no database.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview    # http://localhost:4173
```

**Node 20.19+, 22.13+, or 24 and up.** Not simply "20 or newer", the toolchain
leaves gaps. ESLint 10 is the tightest constraint at
`^20.19.0 || ^22.13.0 || >=24`, which rules out every odd-numbered release
along with 20.0–20.18 and 22.0–22.12. Vite 8 and Vitest 4 exclude much the same
set. `package.json` declares the range, so npm warns instead of letting you find
out from a confusing build error.

CI runs **Node 26**, the current release, even-numbered, so it becomes LTS in
October 2026. Node 24 is the conservative choice if you would rather stay on a
line that is already LTS; both satisfy the range above.

(`@zxing/library`, pulled in by the barcode scanner, declares
`engines.node >= 24`. It doesn't bind here, it is browser code that Vite
bundles and Node never executes, so `npm install` warns about it on Node 22
and everything still passes.)

Run `npm install` even on an existing clone, React, Vite, Tailwind, Router and
TypeScript all changed major versions.

`base` is `./`, so the built app runs from wherever it is put, a folder, a
different port, a USB stick, without being told its own address.

### On your phone, on your own wifi

```bash
npm run build && npm run serve    # prints a http://192.168.x.x:4173 address
```

Open that address on the phone. One caveat worth knowing before you rely on it:
browsers only allow service workers on `localhost` or over HTTPS, so over a
plain LAN address the app runs as an ordinary web page, no home-screen
install, no offline once the laptop sleeps. For a phone copy that genuinely
works offline, use the one-file build below.

### Checks

```bash
npm run verify     # lint + typecheck + unit tests + data integrity + build
npm run test:e2e   # drives the real app in a browser, desktop and phone
```

### One-file build

```bash
npm run build:single   # dist-single/bite-buddy.html, CSS, JS and fonts inlined
npm run test:single    # asserts it makes no external request at all
```

Everything in one file, no server, no install, nothing fetched. Put it in your
phone's Files app or a synced folder and open it; it works with the wifi off.
Two things it gives up: there's no manifest, so it can't be added to the home
screen as an app, and opened from certain viewers it may have nowhere to save
to, take a backup from Settings before closing it if you're unsure.

`npm run verify` and `npm run test:e2e` run in CI on every push
(`.github/workflows/ci.yml`).

### Optional

```bash
# .env.local, raises the USDA rate limit for ingredient lookup
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

`scripts/build-data.ts` reads the `.docx` files directly (a small ZIP reader, no dependency),
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
calories agree with its own macros, using fibre-aware Atwater (fibre at 2 kcal/g), because
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
| Nutrition lookup | USDA FoodData Central (CC0) · Open Food Facts (ODbL) |
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
│   ├── portions.ts       # g/kg/ml/l/piece/tsp/tbsp/cup → grams
│   ├── foodImport.ts     # a search result becomes a food you own
│   ├── nutrition.ts      # the one place nutrition numbers are produced
│   ├── targets.ts        # plan averages + TDEE
│   ├── mediterranean.ts  # serving goals from the guide
│   ├── recipeGroups.ts   # shelves, labels and the repeated-dish grouping
│   ├── dishCategories.ts # the 38 categories, 14 filters, and the meal-time map
│   ├── classify.ts       # reading a category off a recipe's components
│   └── mergeRecipes.ts   # folding repeats together without losing references
├── pages/                # Home, Planner, Recipes, Foods, Grocery, Schedule, Movement, Progress, Settings
└── store/                # zustand stores
```

---

## Ingredients and nutrition

One search covers everything an ingredient could come from. Your own foods and
recipes appear instantly and work with no signal; USDA and Open Food Facts
arrive underneath a moment later, and picking one of those saves it to your
foods, with its source and id, and drops it into the recipe in a single tap.
There is no leaving a half-written recipe to go and fetch an ingredient.

Free and open sources only, in this order: **USDA FoodData Central → Open Food
Facts → typed in by hand**. USDA is the reference for generic ingredients -
chicken, rice, a tomato, because its figures are laboratory measurements; Open
Food Facts covers branded and packaged products, which is what community-entered
label data is actually good for. Barcodes go straight to Open Food Facts.

Every imported food keeps its **provenance**: which source, the source's own id
(FDC ID or barcode) and name, what the figures are per, and the date they were
fetched. That is what stops the same ingredient being fetched twice, and what
lets a wrong number be traced back to whoever said it.

**Missing means unknown, never zero.** A source that says nothing about zinc has
not told you there is no zinc. Nutrients are optional throughout, absent rather
than `0`, and a total made of ingredients that do not all report a nutrient is
marked: `12 g +` means a floor rather than a figure. `reportNutrients` is what
computes that, and it is the reason `addNutrients` does not coerce.

**Salt and sodium are one number.** Sodium in milligrams is canonical, salt is
`sodium × 2.5 ÷ 1000`, and what the source actually said is kept on the food's
provenance, European labels state salt, USDA states sodium. Sugar and salt are
shown alongside the macros rather than among the micronutrients, because they
are the two you watch across a day.

**Units.** `g · kg · ml · l · piece · tsp · tbsp · cup`, all converted to grams
on entry, because grams are the only thing the grocery list and recipe scaling
can work with. `piece` is read off the food's own named portions and is not
offered for a food that has none, falling back to grams would turn "1 piece"
into 1 g. Millilitres are treated as grams; spoons and cups are volumes used as
weights, and the UI says so rather than pretending otherwise.

Nutrition is calculated at three levels and always derived, never stored:
ingredient (per the quantity used) → recipe (the sum) → serving (÷ servings).
Changing a quantity recalculates everything immediately, because there is
nothing to keep in step.

---

## Guardrails

Everything here exists because of a failure that actually happened, or one that
would be silent if it did.

**Data invariants** (`npm run data:check`), every component resolves to a real
food or recipe, no recipe nests itself, all 481 plan lines map to something,
recipe names are unique, and each food's stated calories agree with its own
macros. Calorie agreement uses fibre-aware Atwater (fibre at 2 kcal/g); plain
4/4/9 flags every vegetable as mis-keyed. Foods whose energy genuinely isn't in
the macros, vanilla extract is mostly ethanol, are listed explicitly rather
than silently tolerated.

**Unit tests** cover the parsing vocabulary and the nutrition maths, the two
places where a mistake produces a plausible wrong number instead of an error:
raw-vs-dry detection, spoon measures, decimal commas, nested-recipe scaling,
cycle safety, and the Wednesday week boundary across daylight saving.

**Lint rules** include a custom one banning a `<button>` inside a `<button>`.
That bug shipped twice here, browsers reparent the inner element and its click
handler silently stops firing, so it is now caught mechanically.

**End-to-end tests** run at desktop and phone sizes and assert four things per
screen: it renders with no console errors, it does not scroll horizontally,
every control is at least 40x32px, and, at phone width, nothing is clipped and
nothing is hidden inside a sideways scroller.

That last one exists because measuring the screens at 390px turned up nine
places where the layout was quietly hiding its own content: meal names cut to
`Potatoes with egg, Teleme…`, the dietician's line reduced to a stub, 829px of
recipe filters and 1,578px of food categories scrolled out of sight with nothing
on screen to say they were there. Every one of those looked fine in a
screenshot. The check compares `scrollWidth` against `clientWidth`, so it does
not.

**Storage safety**, writes go through a wrapper that degrades instead of
throwing. A full or blocked localStorage shows a banner rather than losing data
quietly, and corrupt JSON falls back to defaults. Every store is schema-versioned:
bump `SCHEMA_VERSION` in `src/store/persist.ts` when a persisted shape changes
and old state is discarded rather than misread. Backups are read from the live
stores, not from localStorage, so the case where storage never worked is still
recoverable, and an end-to-end test wipes storage and restores from a paste to
prove it.

**Error boundary**, a render error shows a recovery screen with the message,
not a blank white page. On a phone with no console, those are indistinguishable.

**Accessibility**, 44px minimum touch targets under `(pointer: coarse)` only,
so phones get thumb-sized controls while desktop keeps compact ones, and
animations are disabled under `prefers-reduced-motion`. Nothing below 11px.

**A phone is not a narrow desktop.** Two rules came out of the layout pass and
are worth keeping: a fixed-width column beside flexible text will win at 390px -
the food rows gave a 112px figures column and a tier badge the room, leaving the
name 85px of 356, and any flex child holding text needs `min-w-0`, or it
refuses to shrink and overflows instead of wrapping. Long content wraps or
clamps; it is never truncated to a single line where the words carry meaning.

---

## Deliberately not done

**No resolution screen for a contested row.** Sync is per row now, so two
people have to be editing the same meal, not the same day, before either can
lose anything. When that does happen the later write wins and the app says so
on screen. Offering both versions and asking you to choose is a screen and a
data model for something that has to happen at the same second in a household
of two.

**No per-user data.** You share everything, by choice. There is no notion of
"my plan" and "their plan", which is what keeps the permission model down to a
single question: are you a member of this household.

**Nothing is published publicly.** The site is public; your data is not. No
recipe, plan or measurement is served at a public URL for anything else to read.

## Not done yet

- A recipe assistant that can open a link rather than being handed the text.
- Anything at all for a device that is not signed in. Notifications, sync and
  sharing all begin at an account.
