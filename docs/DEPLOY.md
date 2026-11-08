# Deploying Bite Buddy

Free, end to end: GitHub Pages for the site, Supabase's free tier for the
database and the sign-in links. Two people, one shared set of plans.

There are four things only you can do, they need accounts I can't create. Each
takes a couple of minutes.

---

## 1. Make the repository public

GitHub Pages is free only on public repos. Pages on a private repo needs a paid
plan, and the published site is public either way, so this buys nothing to keep
it private.

> **Settings → General → Danger Zone → Change repository visibility → Public**

What becomes readable: the code, and the parsed dietician plans in
`src/data/generated/`. What does **not**: everything you enter from now on -
your weeks, weights, targets and shopping lists all live in the database behind
the login.

## 2. Create the Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project. The free
tier is enough by a wide margin: this app's whole dataset is a few hundred
kilobytes against a 500 MB allowance.

Pick the region closest to you, it's the round trip on every save.

> **One caveat worth knowing:** Supabase pauses free projects after a week with
> no requests. Two people using it most days will never hit that. If you both
> go away for a fortnight, the first person back gets an error and you restore
> the project from the Supabase dashboard in one click. Nothing is lost.

## 3. Set up the database

The schema lives in [`supabase/migrations/`](../supabase/migrations/), one
folder per change, and the deploy applies whatever the database has not seen
yet (`npm run db:migrate`, see [Migrations](#migrations) below). Nothing is
pasted by hand any more, except the guest list.

Once the first deploy has run, open **SQL Editor** in the Supabase dashboard
and put the two of you on the guest list:

```sql
insert into public.allowed_emails (email, note) values
  ('you@example.com',   'you'),
  ('them@example.com',  'the other person')
on conflict (email) do nothing;
```

Do this in the SQL editor, not in the repository: this repo is public, and an
address committed to it is an address published.

That list is the whole security model for who gets in, and it is checked in
two places. A database trigger rejects a signup from anyone not on it, when
the project lets that trigger be created (newer projects may not; the file
carries on with a notice). And every read and write checks it again:
`is_member()` requires the account's email to be on the list, so an account
that got past signup still sees nothing, and removing an email from the list
revokes access straight away.

**Also turn off open signups:** Authentication → Sign In / Providers → untick
"Allow new users to sign up", then invite the two of you from Authentication →
Users. With that off, nobody else can create an account at all.

If the database was set up before this check existed, paste
`supabase/fix-membership.sql` into the SQL editor to apply it. Its last query
lists every member with an `on_guest_list` column; anyone showing `false` has
no access, and you can delete their account from Authentication → Users.

The rows migration creates the tables the app stores your data in, one row per
meal, weight, recipe or shopping line. It ends by reading whatever the older
`app_state` documents hold and writing them out as rows, so a project that has
been in use keeps everything it had.

### Migrations

Ported from rebelMerch. Each migration is
`supabase/migrations/<timestamp>_<name>/migration.sql` and runs once, in its
own transaction, recorded with a checksum in the `bite_migrations.journal`
table (a private schema, so it is not served by the API). The runner refuses
to go on, rather than guessing, when:

- a migration that already ran has been edited since. Write a new one instead.
- the database has a migration this commit does not, meaning an older commit is
  being deployed over a newer one.
- an earlier run started a migration and never finished it.

To change the schema, add a folder with a later timestamp. `npm run db:check`
runs every migration against a real Postgres (PGlite) on each push, and the
deploy applies them before the site is published:

```sh
SUPABASE_DB_URL=postgres://... npm run db:migrate -- --dry-run   # what would run
SUPABASE_DB_URL=postgres://... npm run db:migrate                # apply
```

The four baseline migrations are the files that used to be pasted in by hand,
and they are safe to repeat, so a database set up the old way simply adopts
them on the first deploy.

Then two settings in the dashboard:

- **Authentication → URL Configuration → Site URL:**
  `https://<your-github-username>.github.io/bite-buddy/`
- **Authentication → URL Configuration → Redirect URLs:** add the same URL, and
  `http://localhost:5173/` if you want sign-in to work when running it locally.

A magic link that comes back to an address not on that list is rejected, which
looks exactly like a broken link. It's the most common thing to get wrong.

## 4. Add the three repository secrets

From Supabase, **Project Settings → API**, copy the Project URL and the
`anon` `public` key, and from **Project Settings → Database** the connection
string for the **session pooler** (port 5432). Then in GitHub:

> **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the long `anon` key |
| `SUPABASE_DB_URL` | `postgresql://postgres.xxxx:<password>@...pooler.supabase.com:5432/postgres` |

**`SUPABASE_DB_URL` is a real secret**, unlike the anon key: it is the database
password. It is only ever read by the deploy's migrate job. Use the session
pooler, not the transaction pooler on 6543, which cannot hold the lock the
runner takes.

**The anon key is meant to be public.** It ships in the JavaScript bundle and
anyone can read it out. It grants nothing on its own: every table requires a
signed-in session belonging to a household member, enforced by row-level
security in Postgres. The key that *would* matter, `service_role`, is never
used by this app and must never be added here.

The deploy workflow fails deliberately if these are missing, rather than
publishing a site that silently falls back to local-only storage.

---

## Then it deploys itself

Every push to the branch runs `.github/workflows/deploy.yml`: lint, typecheck,
unit tests and the data checks, then a build and a publish. Pages turns itself
on the first time it runs, so there's no switch to find in the settings.

Your site: `https://<your-github-username>.github.io/bite-buddy/`

Send the other person the link. They type their address, get a link, and they're
in, no account to create, no password to agree on.

---

## How the sharing works

Everything is shared: one week, one grocery list, one recipe library, one set of
targets. It is stored as one row per thing, a meal, a weight, a shopping list
line, and Postgres realtime pushes changes to the other screen as they happen.

What wins is decided per row, and it favours the device in front of you: a row
you have changed and not yet sent stays, whatever the server says. Everything
else takes the shared version, deletions included.

**The honest limitation: both of you editing the same row.** Not the same day,
the same meal. The later write wins and the app says so on screen rather than
letting your version disappear without a word. It does not offer you both
versions to choose between.

Offline still works. The app writes locally first, so a dropped connection
changes nothing except that the other person doesn't see it yet; the welcome
screen says so, and it goes up when you're back.

---

## Running it locally after all this

Unchanged, and it still needs no accounts:

```bash
npm install && npm run dev
```

Without `VITE_SUPABASE_URL` set there is no sign-in screen and no sync, the app
runs entirely on localStorage, exactly as it did before any of this. That is
also why the test suite doesn't need a database.

To test the real thing locally, put the same two values in `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

`.env.local` is gitignored. Add `http://localhost:5173/` to the Supabase
redirect URLs or the magic link won't come back to you.
