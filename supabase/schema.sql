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

drop trigger if exists enforce_allowed_email on auth.users;
create trigger enforce_allowed_email
  before insert on auth.users
  for each row execute function public.enforce_allowed_email();

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

drop policy if exists "members are visible to the household" on public.members;
create policy "members are visible to the household"
  on public.members for select
  using (public.is_member());

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
-- Cook session reminders
--
-- What has already been emailed, so a reminder goes out once. Sending the same
-- one twice is worse than sending it late: the second one teaches you to
-- ignore the first.
--
-- Written only by the scheduled function, which runs as the service role and
-- is not subject to these policies. The client can read it, so the app could
-- one day show "reminded at", and can write nothing.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.reminder_log (
  session_id text primary key,
  sent_to    text[] not null,
  session_at text,
  sent_at    timestamptz not null default now()
);

alter table public.reminder_log enable row level security;

drop policy if exists "household members read the reminder log" on public.reminder_log;
create policy "household members read the reminder log"
  on public.reminder_log for select
  using (public.is_member());

-- ─────────────────────────────────────────────────────────────────────────────
-- The schedule
--
-- Every five minutes, which is as coarse as a fifteen-minute warning can stand
-- and still be roughly on time. Requires the pg_cron and pg_net extensions,
-- both available on Supabase; enable them under Database > Extensions.
--
-- Replace the two placeholders before running: the project ref in the URL, and
-- the service role key. Keep the key out of the repository. If you would
-- rather not paste it here at all, Supabase's dashboard can schedule an Edge
-- Function directly instead, under Integrations > Cron.
-- ─────────────────────────────────────────────────────────────────────────────

-- select cron.schedule(
--   'cook-reminders',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/cook-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
--     )
--   );
--   $$
-- );
