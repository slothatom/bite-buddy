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

Open **SQL Editor** in the Supabase dashboard, paste in all of
[`supabase/schema.sql`](../supabase/schema.sql), and run it.

Before you run it, change the two addresses at the bottom:

```sql
insert into public.allowed_emails (email, note) values
  ('you@example.com',   'you'),
  ('them@example.com',  'the other person')
on conflict (email) do nothing;
```

Change them in the SQL editor, not in the repository, this repo is public, and
an address committed to it is an address published.

**Run the whole file, not just that block.** The insert needs the tables, and
the tables are created by everything above it. Running the last few lines on
their own gives `relation "public.allowed_emails" does not exist`.

That list is the whole security model for who gets in. Anyone not on it cannot
create an account, even knowing the URL and the key, a database trigger
rejects the signup itself.

> **If the editor shows a red error, read which statement it was.** Some of this
> file touches `auth.users`, which belongs to Supabase rather than to you, and
> newer projects refuse to let anything else put a trigger on it. Those parts are
> wrapped so the rest of the file still runs, but if you see an error and are not
> sure how much applied, run
> [`supabase/fix-membership.sql`](../supabase/fix-membership.sql) afterwards. It
> is short, it is only about who is allowed to read and write, and it ends by
> printing who is in the household so you can see it worked.

Then paste in all of [`supabase/rows.sql`](../supabase/rows.sql) and run that
too. It creates the tables the app actually stores your data in, one row per
meal, weight, recipe or shopping line, with the policies and indexes each of
them needs. Nothing to edit in this one.

It ends by reading whatever the older `app_state` documents hold and writing
them out as rows, so a project that has been in use keeps everything it had.
Running it a second time changes nothing.

Then two settings in the dashboard:

- **Authentication → URL Configuration → Site URL:**
  `https://<your-github-username>.github.io/bite-buddy/`
- **Authentication → URL Configuration → Redirect URLs:** add the same URL, and
  `http://localhost:5173/` if you want sign-in to work when running it locally.

A magic link that comes back to an address not on that list is rejected, which
looks exactly like a broken link. It's the most common thing to get wrong.

## 4. Add the two repository secrets

From Supabase, **Project Settings → API**, copy the Project URL and the
`anon` `public` key. Then in GitHub:

> **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the long `anon` key |

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
