-- Bite Buddy, push notifications
--
-- Paste this whole file into the Supabase SQL editor and run it once, after
-- schema.sql and rows.sql. Re-running is safe.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Why this is not one of the synced tables
--
-- Everything in rows.sql is shared: a recipe, a weight, a planned meal belong
-- to the household and every device holds a copy. A push subscription is the
-- opposite of that. It belongs to one browser on one phone, it is worthless
-- anywhere else, and copying it to the other person's device would mean their
-- phone holding the credential needed to send notifications to yours.
--
-- So these tables are private per member, they never sync, and the app reads
-- and writes them directly rather than through the row engine.

-- ─────────────────────────────────────────────────────────────────────────────
-- Where to send

create table if not exists public.push_subscriptions (
  -- The endpoint is the identity: it is the URL the push service gave this
  -- browser, and re-subscribing on the same device returns the same one, which
  -- is what stops a phone accumulating a subscription per sign-in.
  endpoint    text primary key,
  member_id   uuid not null references public.members(id) on delete cascade,
  -- The two halves of the key that encrypts a payload for this device.
  p256dh      text not null,
  auth        text not null,
  -- Only so a person can recognise a device in a list and remove the old one.
  label       text,
  created_at  timestamptz not null default now(),
  -- Set when a push service says this subscription is gone, so a dead device
  -- stops being retried forever. Rows are kept rather than deleted: a phone
  -- that went quiet for a fortnight and came back is a fact worth having.
  failed_at   timestamptz
);

create index if not exists push_subscriptions_member
  on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;

-- Yours and nobody else's, not even the other member of the household. The
-- send happens with the service role, which bypasses this by design.
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions"
  on public.push_subscriptions for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- What each person has already been told

create table if not exists public.notify_state (
  member_id      uuid primary key references public.members(id) on delete cascade,
  -- The last plan change this person has been notified about. Without it, every
  -- run would either repeat itself or need to guess.
  plan_seen_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.notify_state enable row level security;

drop policy if exists "own notify state" on public.notify_state;
create policy "own notify state"
  on public.notify_state for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Which notifications each person wants
--
-- On the profile rather than here would have been simpler, and wrong: the
-- profile syncs, so turning notifications off on your phone would turn them off
-- on theirs.

alter table public.notify_state
  add column if not exists want_cook boolean not null default true;

alter table public.notify_state
  add column if not exists want_plan boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────────────
-- The public half of the signing key
--
-- A browser will not subscribe to push without the sender's public VAPID key,
-- so the app has to be able to read it. It is public by design: it is handed to
-- the push service on every subscription and it authorises nothing on its own.
-- The private half never leaves the Edge Function's secrets.
--
-- It lives here rather than in the built bundle so that setting it up is one
-- more line in the SQL editor you are already in, rather than a repository
-- secret and a rebuild. Members can read it; nobody can write it except from
-- here.

create table if not exists public.push_config (
  key    text primary key,
  value  text not null
);

alter table public.push_config enable row level security;

drop policy if exists "the household can read the public key" on public.push_config;
create policy "the household can read the public key"
  on public.push_config for select
  using (public.is_member());

-- Put your own key in with this, once you have generated a pair. See the README.
--
--   insert into public.push_config (key, value)
--   values ('vapid_public', 'BEl62i...')
--   on conflict (key) do update set value = excluded.value;

-- ─────────────────────────────────────────────────────────────────────────────
-- What has already been sent
--
-- One row per cook session that has been reminded about, so a reminder goes
-- out once. Sending the same one twice is worse than sending it late: the
-- second one teaches you to ignore the first. The reminder window is an hour
-- wide and the job runs every five minutes, so without this a single dinner
-- would buzz twelve times.
--
-- It lived in schema.sql when reminders were emails, and stayed there when
-- they became push, which is how a database can end up running the push
-- feature without the one table that stops it repeating itself. It belongs
-- with the rest of the notification schema, and here it is.
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
