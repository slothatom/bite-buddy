-- Bite Buddy, database schema
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Re-running is safe: everything here is idempotent.
--
-- The shape follows one decision: the two of you share everything. There is no
-- per-user data, so there is no per-user partitioning to get wrong, a row is
-- either readable by household members or by nobody.

-- ─────────────────────────────────────────────────────────────────────────────
-- Who is allowed in
--
-- Supabase's email sign-in will happily create an account for anyone who knows
-- the URL. This table is the guest list, and the trigger below enforces it at
-- the moment of signup rather than letting strangers register and then be
-- filtered out afterwards.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.allowed_emails (
  email text primary key,
  note  text
);

alter table public.allowed_emails enable row level security;

-- No policies, deliberately: with RLS on and nothing granted, the client cannot
-- read this table at all. The signup trigger below reaches it as the definer,
-- and you edit it from the SQL editor.

create or replace function public.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'This app is private. % is not on the guest list.', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Wrapped, because `auth.users` belongs to Supabase rather than to you, and
-- newer projects refuse a trigger on it with "must be owner of relation users".
-- The SQL editor runs this file as one transaction, so an error here does not
-- stop at this line: it abandons everything below it, including the policies
-- that decide whether anybody can read their own data. That is exactly what
-- happened, and the symptom was an app that appeared to save nothing.
--
-- If it cannot be created, the guest list still holds. It is enforced by the
-- redirect allow-list and by the fact that nothing in the database is readable
-- without a members row.
do $$
begin
  drop trigger if exists enforce_allowed_email on auth.users;
  create trigger enforce_allowed_email
    before insert on auth.users
    for each row execute function public.enforce_allowed_email();
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Could not put the guest list trigger on auth.users (%). Everything else in this file still applies.', sqlerrm;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Household members
--
-- One row per person who has actually signed in, so the welcome screen can
-- greet you by name and show who else is around. Populated automatically on
-- first sign-in.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.members (
  id           uuid primary key references auth.users on delete cascade,
  email        text not null,
  display_name text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table public.members enable row level security;

-- Membership is the definition of "allowed to see the household's data", so it
-- is the one check every other policy is built on. Written as a function so
-- Postgres does not recurse when the policy on `members` consults `members`.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

-- The `or id = auth.uid()` is not a convenience, it is what makes joining
-- possible at all, and leaving it out was the bug that made this app appear to
-- save nothing.
--
-- The app announces itself with an upsert, which Postgres runs as
-- `insert ... on conflict do update`, and that statement requires the select
-- policy to pass so it can look for the conflicting row. With only
-- `is_member()` there, the check asks "are you already a member" of somebody
-- whose whole purpose in writing this row is to become one. It refused, every
-- time, so nobody was ever added; and because every other policy in this file
-- consults `is_member()`, every read and write of the household's data was then
-- refused too. One circular policy, and the app looks like it has lost your
-- data.
--
-- Seeing your own row grants nothing else: everything worth reading is behind
-- `is_member()`, and this row is yours.
drop policy if exists "members are visible to the household" on public.members;
create policy "members are visible to the household"
  on public.members for select
  using (public.is_member() or id = auth.uid());

drop policy if exists "you may create your own member row" on public.members;
create policy "you may create your own member row"
  on public.members for insert
  with check (id = auth.uid());

drop policy if exists "you may edit your own member row" on public.members;
create policy "you may edit your own member row"
  on public.members for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Joining, without depending on the app to manage it
--
-- The row above is also written by the app at sign-in, and that is fine when it
-- works. This makes it not matter: an account that exists is a member, decided
-- by the database at the moment the account is created.
--
-- Who may create an account is already settled by the guest list and the
-- trigger that enforces it, so there is nothing this loosens. What it removes
-- is a whole class of failure where somebody is signed in, allowed to read and
-- write nothing, and the app can only say that something went wrong.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.add_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  drop trigger if exists add_member on auth.users;
  create trigger add_member
    after insert on auth.users
    for each row execute function public.add_member();
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Could not put the membership trigger on auth.users (%). The app adds itself instead, see join_household below.', sqlerrm;
end;
$$;

-- Anyone who signed up before this existed, and was therefore never added.
insert into public.members (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

/**
 * The way in, for an app that cannot rely on any of the above having worked.
 *
 * Adding yourself to the household through the table means satisfying its
 * policies, and those policies are the thing most likely to be wrong, since
 * they are what a person pastes into a SQL editor and hopes ran. This function
 * runs as its owner, so it needs none of them, and it can add exactly one row:
 * yours, for the account making the call.
 *
 * It cannot be used to add anybody else, or to see anything, and being signed
 * in at all already required being on the guest list.
 */
create or replace function public.join_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.members (id, email)
  select auth.uid(), coalesce((select email from auth.users where id = auth.uid()), '')
  on conflict (id) do update set last_seen_at = now();
end;
$$;

-- `authenticated` is Supabase's role for a signed-in caller. Guarded so this
-- file still runs on a plain Postgres that has never heard of it.
do $$
begin
  grant execute on function public.join_household() to authenticated;
exception
  when undefined_object then
    raise notice 'No authenticated role here, skipping the grant.';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The shared state
--
-- One row per store, holding exactly what the app already serialises for a
-- backup. Documents rather than relational tables is a deliberate trade: the
-- app's own model is the authority, the sync layer stays small enough to
-- reason about, and a schema change here means a version bump rather than a
-- migration.
--
-- The cost is last-write-wins per document. With two people that is rare and
-- visible, realtime pushes every change to the other screen immediately, but
-- it is a real limitation, not an oversight.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_state (
  key        text primary key,
  data       jsonb not null,
  schema     integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

alter table public.app_state enable row level security;

drop policy if exists "household members read the shared state" on public.app_state;
create policy "household members read the shared state"
  on public.app_state for select
  using (public.is_member());

drop policy if exists "household members write the shared state" on public.app_state;
create policy "household members write the shared state"
  on public.app_state for insert
  with check (public.is_member());

drop policy if exists "household members update the shared state" on public.app_state;
create policy "household members update the shared state"
  on public.app_state for update
  using (public.is_member())
  with check (public.is_member());

-- Push changes to the other person's screen as they happen. Wrapped because
-- adding a table to a publication twice is an error, and this file is meant to
-- be safe to re-run.
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
  -- Adding to a publication needs to own it. Realtime is a nicety, the other
  -- person's screen updating a moment later rather than at once, and it is not
  -- worth abandoning the rest of this file over.
  when insufficient_privilege or undefined_object then
    raise notice 'Could not add app_state to the realtime publication (%).', sqlerrm;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The guest list itself
--
-- Put the real addresses in before running this, and keep them out of the
-- repository, it is public, and an address committed here is an address
-- published. Adding someone later is a one-line insert in the SQL editor.
--
-- Anyone not listed cannot create an account, even with the URL and the key.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.allowed_emails (email, note) values
  ('you@example.com',  'you'),
  ('them@example.com', 'the other person')
on conflict (email) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- The schedule
--
-- Every five minutes, which is as coarse as a fifteen-minute warning can stand
-- and still be roughly on time. Requires the pg_cron and pg_net extensions,
-- both available on Supabase; enable them under Database > Extensions.
--
-- The Authorization header is not optional and is the whole of the setup that
-- goes wrong silently. Edge Functions verify a JWT before your code runs, so a
-- request without one is answered 401 by the gateway and the function never
-- executes: pg_cron reports the job as succeeded, because posting the request
-- did succeed, and nothing anywhere says a notification was refused. See the
-- README for the one query that shows it.
--
-- The **anon** key, not the service role key. Anon is enough to get past the
-- gateway, it is in the app's own bundle already, and it authorises nothing on
-- its own. The service role key bypasses every policy in this file and has no
-- business in a scheduled job, a repository, or a chat window.
--
-- Replace the two placeholders before running: the project ref and the anon key.
-- ─────────────────────────────────────────────────────────────────────────────

-- select cron.schedule(
--   'notify',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR-ANON-KEY'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
