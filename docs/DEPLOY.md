# Deploying Bite Buddy

Free, end to end: GitHub Pages for the site, Supabase's free tier for the
database and the sign-in links. One household, one shared set of plans.

There are a handful of things only you can do, because they need accounts I
can't create. Each takes a couple of minutes.

---

## 1. Make the repository public

GitHub Pages is free only on public repos. Pages on a private repo needs a paid
plan, and the published site is public either way.

> **Settings → General → Danger Zone → Change repository visibility → Public**

What becomes readable: the code, and the parsed dietician plans in
`src/data/generated/`, which also ship inside the site's JavaScript. What does
**not**: everything you enter from now on. Your weeks, weights, targets and
shopping lists live in the database behind the login.

(Whether the dietician plans should move out of the public bundle and the
public repo, into Supabase behind the login, is an open decision. See "Not done
yet" in the README.)

## 2. Create the Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project. The free
tier is enough by a wide margin: this app's whole dataset is a few hundred
kilobytes against a 500 MB allowance.

Pick the region closest to you, it's the round trip on every save.

> **One caveat worth knowing:** Supabase pauses free projects after a week with
> no requests. If you all go away for a fortnight, the first person back gets
> an error and you restore the project from the Supabase dashboard in one
> click. Nothing is lost.

## 3. Add the three repository secrets

From Supabase, **Project Settings → API**, copy the Project URL and the
publishable (`anon`) key, and from **Connect** (or **Project Settings →
Database**) the connection string for the **Session pooler** (port 5432). Then
in GitHub:

> **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_...`) or the legacy `anon` key (`eyJ...`) |
| `SUPABASE_DB_URL` | `postgresql://postgres.xxxx:<password>@...pooler.supabase.com:5432/postgres` |

**`SUPABASE_DB_URL` is a real secret**, unlike the anon key: it holds the
database password. Only the deploy's migrate job reads it. Use the session
pooler, not the transaction pooler on 6543, which cannot hold the lock the
migration runner takes.

The runner is forgiving about how it was pasted (`scripts/lib/db-url.ts`): it
trims spaces and line breaks, strips quotes around the whole value and square
brackets left around the password, and encodes special characters in the
password. It refuses, with a message describing the problem but never the
value, when the `[YOUR-PASSWORD]` placeholder is still there, the password is
empty, the value is the `https://` Project URL, or the port is 6543.

**The anon key is meant to be public.** It ships in the JavaScript bundle. It
grants nothing on its own: every table requires a signed-in session belonging to
a household member, enforced by row-level security in Postgres. The
`service_role` key is never used by the app and must never be added here.

**The deploy checks the two `VITE_` secrets before building**, because anything
named `VITE_*` is baked into the public JavaScript. It fails if
`VITE_SUPABASE_URL` is not an `https://<ref>.supabase.co` address (a
`postgresql://` string there would publish the database password), if
`VITE_SUPABASE_ANON_KEY` is neither a publishable key nor a JWT, or if it is a
JWT whose role is anything but `anon` (a `service_role` key looks the same from
the outside). Values are never printed. It also fails, rather than publishing a
local-only site, when `VITE_SUPABASE_URL` or `SUPABASE_DB_URL` is missing.

## 4. Push, and it deploys itself

Every push to `main` runs `.github/workflows/deploy.yml`, in this order:

1. **CI**, the whole of `.github/workflows/ci.yml`: lint, typecheck, unit tests,
   data checks, house style, contrast, the function check, the schema check, a
   build, and the end-to-end tests in a browser.
2. **Migrate**: `npm run db:migrate` against `SUPABASE_DB_URL`. The database
   moves before the site does, so published code never talks to an older
   schema.
3. **Build**: the secret safety check above, then `npm run build`.
4. **Publish** to Pages. Pages turns itself on the first time, so there is no
   switch to find in the settings.

Your site: `https://<your-github-username>.github.io/bite-buddy/`

### Migrations

Each migration is `supabase/migrations/<timestamp>_<name>/migration.sql` and
runs once, in its own transaction, recorded with a SHA-256 checksum in
`bite_migrations.journal` (a private schema, so the API does not serve it). The
runner refuses to go on, rather than guessing, when:

- a migration that already ran has been edited since. Write a new one instead.
- the database has a migration this commit does not, meaning an older commit is
  being deployed over a newer one.
- an earlier run started a migration and never finished it.

To change the schema, add a folder with a later timestamp. `npm run db:check`
runs every migration against a real Postgres (PGlite) on each push. By hand:

```sh
SUPABASE_DB_URL=postgres://... npm run db:migrate -- --dry-run   # what would run
SUPABASE_DB_URL=postgres://... npm run db:migrate                # apply
```

Today there are five: `schema`, `rows`, `push`, `photos` (the four files that
used to be pasted by hand, safe to repeat, so a database set up the old way
adopts them on the first deploy) and `households`. Nothing in them needs
pasting into the SQL editor any more.

## 5. Sign-in settings

In the Supabase dashboard:

- **Authentication → URL Configuration → Site URL:**
  `https://<your-github-username>.github.io/bite-buddy/`
- **Authentication → URL Configuration → Redirect URLs:** add the same URL, and
  `http://localhost:5173/` if you want sign-in to work when running it locally.

A magic link that comes back to an address not on that list is rejected, which
looks exactly like a broken link. It's the most common thing to get wrong.

**Turn off open signups:** Authentication → Sign In / Providers → untick
"Allow new users to sign up". With that off, nobody can create an account
unless you create it for them (Authentication → Users → Invite user).

## 6. The first person in

A household is data: a row in `households`, one row per person in
`household_members` with a role, and pending invites in `household_invites`.
Access is decided by `household_members` alone.

On a new, empty project there is no household yet. Two ways to start one:

- **Guest list (the legacy way, kept for the transition).** In the SQL editor:

  ```sql
  insert into public.allowed_emails (email, note) values
    ('you@example.com', 'you')
  on conflict (email) do nothing;
  ```

  The first address on the list to sign in creates the original ("default")
  household and becomes its admin; any later guest-list address joins it as an
  editor. Do this in the SQL editor, never in the repository: the repo is
  public, and an address committed to it is an address published.
- **First-run screen.** An account with no invite and no guest-list entry is
  offered to start a household of its own, as its admin.

Either way, with signups off you also create the account first
(Authentication → Users → Invite user).

**Check person keys after the first sign-in.** Personal rows (weights,
measurements, workouts, steps, sleep) say whose they are by `member_id`, which
matches a member's `person_key`. On a new project the key is made from the
display name or the email (`arany` from `arany.mak@...`), which may not match
the ids in a backup you are about to restore. Before restoring, run:

```sql
select m.email, m.person_key, m.role, h.name as household
from public.household_members m join public.households h on h.id = m.household_id;
```

and, if a key is not the one the backup uses:

```sql
update public.household_members set person_key = 'arany' where email = 'you@example.com';
```

(On a project that was already in use, the households migration matched the
existing ids, `arany` and `oli`, to their owners itself, and raised a notice if
it could not.)

### Inviting someone

| Role | Can |
|---|---|
| Viewer | see everything in the household, change nothing |
| Editor | plan, cook, shop and log |
| Admin | all of that, plus invite people, change roles and remove members |

1. As an admin, open **Settings → Household**, type their email, pick a role
   and press **Invite**.
2. With signups off, also create their account: **Authentication → Users →
   Invite user**, with the same address.
3. They open the site and sign in with that address. The invite is accepted on
   their first sign-in, with the role you picked.

An invite admits only the address it was sent to, and only once. Change a role
or remove someone from the same screen; the database keeps at least one admin
per household. The SQL equivalent, run as an admin, is
`select public.invite_member('them@example.com', 'editor');`.

Where the signup trigger could be created (newer projects may refuse it; the
migration carries on with a notice), it rejects any address that is neither on
the guest list nor has a pending invite.

**Removing someone** is Settings → Household (or `remove_member()`). Deleting an
address from `allowed_emails` no longer revokes anything: `is_member()` now
means "has a `household_members` row".

**One household per account**, for now: `household_members` has a unique
constraint on the user.

### When somebody is told they are not in

Paste `supabase/fix-membership.sql` into the SQL editor. It lists every
household, member, pending invite and account with no household, and has a
commented insert for putting an account back into the original household. It
was rewritten for households: the older version of that file redefined
`is_member()` the pre-households way, and **must not be pasted** into a
database that has the households migration.

## 7. Reminders (optional): push notifications

The one part that needs something running while nobody has the app open: an
Edge Function called `notify`, on a five-minute schedule. It sends push
notifications only (there is no email path), for two things: fifteen minutes
before a cook session, and when someone else in the household has changed the
week and then been still for ten minutes.

**On a new Supabase project none of this exists yet**: the function, its VAPID
secrets, the public key row and the cron job all have to be set up again. The
`push` migration (tables) runs on deploy; the rest is by hand:

```bash
supabase functions deploy notify

npx web-push generate-vapid-keys        # prints a public and a private key
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=https://your-site/
```

`supabase/functions/notify/deploy.ts` is a single-file copy for pasting into
the dashboard instead, generated by `npm run function:build`; `verify` fails if
it drifts from its sources.

Then, in the SQL editor, the **public** half of the key, which the app reads
(it is public by design and authorises nothing on its own):

```sql
insert into public.push_config (key, value)
values ('vapid_public', '<the public key>')
on conflict (key) do update set value = excluded.value;
```

Then the schedule. **Copy** the commented `cron.schedule` block from the bottom
of `supabase/migrations/20261108000100_schema/migration.sql` into the SQL
editor, fill in the project ref and the anon key, and run it there. Do not
uncomment it in the file: that migration has already run, and the runner
refuses an edited migration.

**The Authorization header is not optional.** Edge Functions verify a JWT before
your code runs; without the header the gateway answers 401, the function never
executes, and `pg_cron` still records the job as succeeded. When a
notification does not arrive, look here first:

```sql
select id, status_code, content, timed_out, error_msg
from net._http_response order by id desc limit 20;
```

| What you see | What it means |
|---|---|
| `UNAUTHORIZED_NO_AUTH_HEADER` | No `Authorization` header. The dashboard's cron builder writes `headers := '{}'` unless you fill it in. |
| `UNAUTHORIZED_INVALID_JWT_FORMAT` | The token was truncated or line-broken in a paste. Use the copy button on the API keys page. |
| `200` with `"pushing": false` | The function runs; the VAPID secrets are not set. |
| `timed_out` true | A cold function took longer than pg_net's default; schedule with `timeout_milliseconds := 20000` (the block in the migration already does). |

Use the **anon** key in the cron job, never the service role key.

Each person then turns notifications on per device in **Settings →
Notifications**, and chooses which of the two kinds they want. On Android it is
more reliable once the app is on the home screen. Without any of this the
toggle still saves and nothing is sent; nothing else depends on it.

---

## How the sharing works

Everything in a household is shared except the personal logs: one week, one
grocery list, one recipe library, one set of targets. It is stored as one row
per thing, and Postgres realtime pushes changes to every other open screen,
including your own other devices. A pull reads every page of changes, not just
the first thousand rows.

What wins is decided per row, and it favours the device in front of you: a row
you changed and have not yet sent stays, and is sent. When someone else changed
the same row in the meantime, their version is kept on your Home screen with
**Use theirs** and **Keep mine**, rather than disappearing.

If this device would delete rows that the shared copy still has, and its own
copy looks wiped, it holds the deletions and asks before sending them.

Offline still works. The app writes locally first, so a dropped connection
changes nothing except that the others don't see it yet.

---

## Running it locally after all this

Unchanged, and it still needs no accounts:

```bash
npm install && npm run dev
```

Without `VITE_SUPABASE_URL` set there is no sign-in screen and no sync; the app
runs entirely on localStorage. That is also why the test suite doesn't need a
database.

To test the real thing locally, put the two public values in `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

`.env.local` is gitignored. Add `http://localhost:5173/` to the Supabase
redirect URLs or the magic link won't come back to you.
