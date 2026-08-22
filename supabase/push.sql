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
