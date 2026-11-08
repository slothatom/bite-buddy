-- Bite Buddy, households
--
-- Until now the household was a fact about the code: two people hardcoded in
-- src/lib/people.ts, and one database in which every row belonged to "us".
-- This makes it data. A household is a row, the people in it are rows with a
-- role each, and every synced row says which household it belongs to.
--
-- Roles, lowest to highest:
--
--   viewer   reads everything in the household, writes nothing
--   editor   reads and writes the household's plans, recipes and logs
--   admin    an editor who can also invite people, change roles and remove
--            members
--
-- Joining is by invitation only. An account may join a household through a
-- pending invite addressed to its own email (`accept_invite()`), or, when it
-- has no household and no invite, start a new one of its own as its admin
-- (`create_household(name)`).
--
-- The old guest list, `allowed_emails`, keeps working during the transition:
-- an address on it with no invite is treated as an invite to the default
-- household, the one every existing row is backfilled into. That is how the
-- two people already using this app keep their access without anybody
-- sending them anything.
--
-- Safe on a database already holding data and on an empty one, and safe to
-- run twice: everything below is idempotent.

-- ─────────────────────────────────────────────────────────────────────────────
-- The tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- The household that existed before this migration. Every existing row is
  -- backfilled into it, and the legacy guest list joins people to it. At most
  -- one, enforced by the partial index below.
  is_default boolean not null default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists households_one_default
  on public.households (is_default) where is_default;

alter table public.households enable row level security;

create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  -- The id the app's own rows use for this person: `member_id` on weights,
  -- measurements, workouts, steps and sleep. Backfilled to the ids that were
  -- hardcoded before ('arany', 'oli'), so existing entries keep their owner.
  person_key   text not null,
  display_name text,
  email        text,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per account, for now. It keeps `current_household()` a
  -- single answer, and it is the case the app is built for.
  constraint household_members_one_household unique (user_id),
  constraint household_members_person_key unique (household_id, person_key)
);

alter table public.household_members enable row level security;

create table if not exists public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email        text not null,
  role         text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  invited_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users on delete set null
);

-- One pending invite per address per household. Inviting again updates it.
create unique index if not exists household_invites_pending
  on public.household_invites (household_id, lower(email)) where accepted_at is null;

alter table public.household_invites enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
--
-- Security definer so policies can call them without recursing into the
-- policies on `household_members`, and with search_path pinned so a caller
-- cannot swap a table out from under them.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_household()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid() limit 1;
$$;

create or replace function public.role_rank(role text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case role when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end;
$$;

-- Whether the caller holds at least `min_role` in their household.
create or replace function public.has_role(min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where user_id = auth.uid()
      and public.role_rank(role) >= public.role_rank(min_role)
  );
$$;

-- Kept, because other migrations and policies use it (push_config, the photo
-- bucket). It now means "a member of some household". It no longer consults
-- the guest list: membership is the household_members row, and removing
-- someone is `remove_member()`, not deleting their email from a list.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.household_members where user_id = auth.uid());
$$;

-- The email Supabase holds for the caller, which the account cannot edit. An
-- invite is matched against this, never against anything the client sends.
create or replace function public.auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

-- A person key that is free in the household, derived from a name or email:
-- "Ana Pop" or "ana.pop@example.com" both give 'ana'. A clash gets a
-- number, 'ana2'.
create or replace function public.free_person_key(household uuid, hint text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base text := coalesce(nullif(substring(lower(coalesce(hint, '')) from '[a-z0-9]+'), ''), 'person');
  candidate text := base;
  n integer := 1;
begin
  while exists (
    select 1 from public.household_members where household_id = household and person_key = candidate
  ) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  return candidate;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies on the household tables
--
-- Reads go through these. Every change goes through the functions further
-- down, which check the role and keep the rules (the last admin cannot leave,
-- an invite only admits its own address) in one place.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "members see their household" on public.households;
create policy "members see their household"
  on public.households for select
  using (
    id = public.current_household()
    -- An invitee may see the name of the household inviting them.
    or exists (
      select 1 from public.household_invites i
      where i.household_id = households.id
        and i.accepted_at is null
        and lower(i.email) = public.auth_email()
    )
  );

drop policy if exists "members see each other" on public.household_members;
create policy "members see each other"
  on public.household_members for select
  using (household_id = public.current_household());

drop policy if exists "admins and invitees see invites" on public.household_invites;
create policy "admins and invitees see invites"
  on public.household_invites for select
  using (
    (household_id = public.current_household() and public.has_role('admin'))
    or lower(email) = public.auth_email()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- The old members table
--
-- It stays: push subscriptions and notification state reference it, and the
-- app still writes its presence there. It no longer grants anything, so the
-- guest-list check on inserting your own row goes, and you see only the
-- people in your own household rather than every account.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "members are visible to the household" on public.members;
create policy "members are visible to the household"
  on public.members for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members hm
      where hm.user_id = members.id and hm.household_id = public.current_household()
    )
  );

drop policy if exists "you may create your own member row" on public.members;
create policy "you may create your own member row"
  on public.members for insert
  with check (id = auth.uid());

-- The signup gate, where it exists, now also admits an address with a pending
-- invite. On projects that refuse the trigger on auth.users it was never
-- there, and anybody may sign up; they then belong to nothing until they are
-- invited or create a household of their own.
create or replace function public.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where lower(email) = lower(new.email)
  ) and not exists (
    select 1 from public.household_invites
    where lower(email) = lower(new.email) and accepted_at is null
  ) then
    raise exception 'This app is private. % has not been invited.', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The default household, and everyone already in it
--
-- Created only when there is something to put in it: a member on the guest
-- list, or a row of data. On an empty project nothing is created here, and the
-- first guest-list account to sign in creates it (see `accept_invite`).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  default_id uuid;
  has_rows boolean := false;
  t text;
  m record;
  legacy_keys text[];
  match text;
  unmatched_members uuid[];
  unmatched_keys text[];
begin
  foreach t in array array[
    'plan_meals', 'grocery_items', 'recipes', 'foods', 'weights', 'measurements',
    'workouts', 'steps', 'sleep', 'portions', 'pantry', 'cook_sessions', 'settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('select $1 or exists (select 1 from public.%I)', t) into has_rows using has_rows;
    end if;
  end loop;

  select id into default_id from public.households where is_default;

  if default_id is null and (has_rows or exists (
    select 1 from public.members mem
    join auth.users u on u.id = mem.id
    join public.allowed_emails a on lower(a.email) = lower(u.email)
  )) then
    insert into public.households (name, is_default) values ('Our household', true)
    returning id into default_id;
  end if;

  if default_id is null then
    return;
  end if;

  -- The ids the existing rows use for people. Read from the data rather than
  -- written out here, so this works whatever they are.
  select coalesce(array_agg(distinct k order by k), '{}') into legacy_keys from (
    select member_id k from public.weights union all
    select member_id from public.measurements union all
    select member_id from public.workouts union all
    select member_id from public.steps union all
    select member_id from public.sleep
  ) keys
  -- Account ids from before the people list existed are not person keys.
  where k is not null and k !~ '^[0-9a-f]{8}-';

  -- Everyone who has access today: a members row whose account email is still
  -- on the guest list, which is exactly what the old is_member() asked. All of
  -- them become admins, so nobody loses anything they could do before.
  for m in
    select mem.id, coalesce(mem.email, u.email) email, mem.display_name, mem.created_at
    from public.members mem
    join auth.users u on u.id = mem.id
    join public.allowed_emails a on lower(a.email) = lower(u.email)
    where not exists (select 1 from public.household_members hm where hm.user_id = mem.id)
    order by mem.created_at, mem.id
  loop
    -- A legacy key that this person's name or email starts with: exact first,
    -- then the longest prefix ('oli' for "Oliver"). Only keys nobody has yet.
    select k into match from unnest(legacy_keys) k
    where not exists (
      select 1 from public.household_members hm where hm.household_id = default_id and hm.person_key = k
    )
      and (
        lower(coalesce(m.display_name, '')) like k || '%'
        or lower(split_part(coalesce(m.email, ''), '@', 1)) like k || '%'
      )
    order by (substring(lower(coalesce(m.display_name, m.email, '')) from '[a-z0-9]+') = k) desc, length(k) desc
    limit 1;

    insert into public.household_members (household_id, user_id, role, person_key, display_name, email)
    values (
      default_id, m.id, 'admin',
      coalesce(match, public.free_person_key(default_id, coalesce(nullif(m.display_name, ''), m.email))),
      m.display_name, m.email
    );
    match := null;
  end loop;

  -- One member and one legacy key left over, after names did not settle it:
  -- in a household of two that is the only sensible pairing. Only applied
  -- when it is unambiguous.
  select coalesce(array_agg(hm.user_id), '{}') into unmatched_members
  from public.household_members hm
  where hm.household_id = default_id and not (hm.person_key = any (legacy_keys));

  select coalesce(array_agg(k), '{}') into unmatched_keys from unnest(legacy_keys) k
  where not exists (
    select 1 from public.household_members hm where hm.household_id = default_id and hm.person_key = k
  );

  if array_length(unmatched_members, 1) = 1 and array_length(unmatched_keys, 1) = 1 then
    update public.household_members set person_key = unmatched_keys[1]
    where household_id = default_id and user_id = unmatched_members[1];
  elsif array_length(unmatched_keys, 1) > 0 then
    -- Said out loud, because the fix is one update in the SQL editor and the
    -- symptom otherwise is a history that looks like it belongs to nobody.
    raise notice 'Rows use person ids % that no member was matched to. Set them with: update public.household_members set person_key = ''<id>'' where email = ''<their email>'';',
      unmatched_keys;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Every synced row belongs to a household
--
-- For each row table: a household_id column, backfilled to the default
-- household; then not null; then the primary key becomes (household_id, id),
-- because two households will both have a 'profile' settings row and their
-- own copy of the same shipped recipe hidden or favourited.
--
-- The column defaults to the caller's household, and the trigger fills it in
-- too, so a client that does not send it still writes to the right place.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.household_id is null then
    new.household_id := public.current_household();
  end if;
  return new;
end;
$$;

/**
 * The policies for one row table. Read: a member of the row's household.
 * Write: an editor or admin of it. A viewer reads and nothing else.
 *
 * Replaces the version in the rows migration, so any later call to it creates
 * household policies rather than the old household-wide ones.
 */
create or replace procedure public.make_syncable(table_name text)
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', table_name);

  execute format($f$
    drop policy if exists "household reads %1$s" on public.%1$I;
    drop policy if exists "household writes %1$s" on public.%1$I;
    drop policy if exists "household updates %1$s" on public.%1$I;

    drop policy if exists "members read %1$s" on public.%1$I;
    create policy "members read %1$s" on public.%1$I
      for select using (household_id = public.current_household());

    drop policy if exists "editors add %1$s" on public.%1$I;
    create policy "editors add %1$s" on public.%1$I
      for insert with check (household_id = public.current_household() and public.has_role('editor'));

    drop policy if exists "editors change %1$s" on public.%1$I;
    create policy "editors change %1$s" on public.%1$I
      for update
      using (household_id = public.current_household() and public.has_role('editor'))
      with check (household_id = public.current_household() and public.has_role('editor'));
  $f$, table_name);

  execute format(
    'create index if not exists %I on public.%I (updated_at desc)',
    table_name || '_updated_at_idx', table_name);
  execute format(
    'create index if not exists %I on public.%I (household_id, updated_at desc)',
    table_name || '_household_updated_at_idx', table_name);

  execute format('drop trigger if exists touch_%1$s on public.%1$I', table_name);
  execute format(
    'create trigger touch_%1$s before insert or update on public.%1$I
       for each row execute function public.touch_row()', table_name);

  begin
    execute format('alter publication supabase_realtime add table public.%I', table_name);
  exception
    when duplicate_object then null;
    when insufficient_privilege or undefined_object then
      raise notice 'Could not add % to the realtime publication (%).', table_name, sqlerrm;
  end;
end;
$$;

do $$
declare
  t text;
  default_id uuid;
  pk_name text;
  pk_cols text[];
begin
  select id into default_id from public.households where is_default;

  foreach t in array array[
    'plan_meals', 'grocery_items', 'recipes', 'foods', 'weights', 'measurements',
    'workouts', 'steps', 'sleep', 'portions', 'pantry', 'cook_sessions', 'settings'
  ] loop
    execute format(
      'alter table public.%I add column if not exists household_id uuid references public.households on delete cascade', t);

    if default_id is not null then
      execute format('update public.%I set household_id = $1 where household_id is null', t) using default_id;
    end if;

    execute format('alter table public.%I alter column household_id set default public.current_household()', t);
    -- Refuses, rightly, if a row somehow has no household: that would be data
    -- nobody could ever read again, and stopping here is better than that.
    execute format('alter table public.%I alter column household_id set not null', t);

    select c.conname, array_agg(a.attname::text order by a.attname)
      into pk_name, pk_cols
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = format('public.%I', t)::regclass and c.contype = 'p'
    group by c.conname;

    if pk_cols is distinct from array['household_id', 'id'] then
      if pk_name is not null then
        execute format('alter table public.%I drop constraint %I', t, pk_name);
      end if;
      execute format('alter table public.%I add primary key (household_id, id)', t);
    end if;

    call public.make_syncable(t);
  end loop;
end;
$$;

-- The reminder log said which emails a reminder went to. Readable by "any
-- member" was fine with one household and is not with two.
alter table public.reminder_log
  add column if not exists household_id uuid references public.households on delete cascade;

do $$
declare
  default_id uuid;
begin
  select id into default_id from public.households where is_default;
  if default_id is not null then
    update public.reminder_log set household_id = default_id where household_id is null;
  end if;
end;
$$;

drop policy if exists "household members read the reminder log" on public.reminder_log;
create policy "household members read the reminder log"
  on public.reminder_log for select
  using (household_id = public.current_household());

-- ─────────────────────────────────────────────────────────────────────────────
-- Joining
-- ─────────────────────────────────────────────────────────────────────────────

-- Adds the caller to a household. Internal: the public ways in are below.
create or replace function public.join_as(household uuid, new_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_email text := public.auth_email();
  my_name text;
begin
  insert into public.members (id, email)
  values (me, coalesce(my_email, ''))
  on conflict (id) do update set last_seen_at = now();

  select display_name into my_name from public.members where id = me;

  insert into public.household_members (household_id, user_id, role, person_key, display_name, email)
  values (
    household, me, new_role,
    public.free_person_key(household, coalesce(nullif(my_name, ''), my_email)),
    my_name, my_email
  );
  return household;
end;
$$;

/**
 * Accepts the invite addressed to the caller's email.
 *
 * Returns the household joined. Already in one: returns that, and changes
 * nothing. No invite, but the email is on the legacy guest list: joins the
 * default household, creating it if this is the first person ever, in which
 * case they are its admin. Neither: refuses, with errcode P0002 (no_data_found)
 * so the app can tell "nobody invited you" from anything else going wrong.
 */
create or replace function public.accept_invite()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_email text := public.auth_email();
  existing uuid;
  invite record;
  default_id uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  existing := public.current_household();
  if existing is not null then
    update public.members set last_seen_at = now() where id = me;
    return existing;
  end if;

  select * into invite from public.household_invites
  where lower(email) = my_email and accepted_at is null
  order by created_at desc
  limit 1
  for update;

  if found then
    perform public.join_as(invite.household_id, invite.role);
    update public.household_invites
      set accepted_at = now(), accepted_by = me
      where id = invite.id;
    return invite.household_id;
  end if;

  if exists (select 1 from public.allowed_emails where lower(email) = my_email) then
    -- Serialises two guest-list accounts arriving on an empty project at once,
    -- so they end up in one default household rather than racing to create two.
    lock table public.households in share row exclusive mode;
    select id into default_id from public.households where is_default;
    if default_id is null then
      insert into public.households (name, is_default, created_by)
      values ('Our household', true, me)
      returning id into default_id;
    end if;
    perform public.join_as(
      default_id,
      case when exists (select 1 from public.household_members where household_id = default_id)
        then 'editor' else 'admin' end
    );
    return default_id;
  end if;

  raise exception 'No invitation for %.', coalesce(my_email, 'this account')
    using errcode = 'no_data_found';
end;
$$;

-- What the app called before, kept so an installed copy that has not updated
-- yet still gets in the same way.
create or replace function public.join_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.accept_invite();
end;
$$;

/** Starts a new household with the caller as its admin. Only for an account in none. */
create or replace function public.create_household(name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  created uuid;
  clean text := nullif(trim(coalesce(name, '')), '');
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  if public.current_household() is not null then
    raise exception 'You are already in a household.' using errcode = 'unique_violation';
  end if;
  if clean is null then
    raise exception 'A household needs a name.' using errcode = 'check_violation';
  end if;

  insert into public.households (name, created_by)
  values (left(clean, 80), me)
  returning id into created;

  perform public.join_as(created, 'admin');
  return created;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Managing a household (admins)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  household uuid := public.current_household();
begin
  if household is null or not public.has_role('admin') then
    raise exception 'Only an admin of this household can do that.' using errcode = 'insufficient_privilege';
  end if;
  return household;
end;
$$;

/** Invites an address, or changes the role of the pending invite already there. */
create or replace function public.invite_member(email text, role text default 'editor')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  household uuid := public.require_admin();
  address text := lower(trim(coalesce(email, '')));
  invite_id uuid;
begin
  if address !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That does not look like an email address.' using errcode = 'check_violation';
  end if;
  if role not in ('admin', 'editor', 'viewer') then
    raise exception 'Unknown role %.', role using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = household and lower(household_members.email) = address
  ) then
    raise exception '% is already in this household.', address using errcode = 'unique_violation';
  end if;

  update public.household_invites i set role = invite_member.role, invited_by = auth.uid()
  where i.household_id = household and lower(i.email) = address and i.accepted_at is null
  returning i.id into invite_id;

  if invite_id is null then
    insert into public.household_invites (household_id, email, role, invited_by)
    values (household, address, invite_member.role, auth.uid())
    returning id into invite_id;
  end if;
  return invite_id;
end;
$$;

create or replace function public.revoke_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  household uuid := public.require_admin();
begin
  delete from public.household_invites
  where id = invite_id and household_id = household and accepted_at is null;
end;
$$;

-- The household always keeps at least one admin, or nobody could ever invite
-- anyone again.
create or replace function public.set_member_role(member uuid, role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  household uuid := public.require_admin();
begin
  if role not in ('admin', 'editor', 'viewer') then
    raise exception 'Unknown role %.', role using errcode = 'check_violation';
  end if;
  if role <> 'admin' and exists (
    select 1 from public.household_members
    where household_id = household and user_id = member and household_members.role = 'admin'
  ) and (
    select count(*) from public.household_members
    where household_id = household and household_members.role = 'admin'
  ) <= 1 then
    raise exception 'A household needs at least one admin.' using errcode = 'check_violation';
  end if;

  update public.household_members set role = set_member_role.role
  where household_id = household and user_id = member;
end;
$$;

/** Removes a member. An admin may remove anyone; anyone may remove themselves. */
create or replace function public.remove_member(member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  household uuid := public.current_household();
begin
  if household is null then
    raise exception 'Not in a household.' using errcode = 'insufficient_privilege';
  end if;
  if member <> auth.uid() and not public.has_role('admin') then
    raise exception 'Only an admin of this household can do that.' using errcode = 'insufficient_privilege';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = household and user_id = member and role = 'admin'
  ) and (
    select count(*) from public.household_members where household_id = household and role = 'admin'
  ) <= 1 and (
    select count(*) from public.household_members where household_id = household
  ) > 1 then
    raise exception 'A household needs at least one admin. Make someone else admin first.'
      using errcode = 'check_violation';
  end if;

  delete from public.household_members where household_id = household and user_id = member;
end;
$$;

/** The name everyone else in the household sees for you. */
create or replace function public.set_display_name(name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := nullif(left(trim(coalesce(name, '')), 80), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  update public.members set display_name = clean where id = auth.uid();
  update public.household_members set display_name = clean where user_id = auth.uid();
end;
$$;

create or replace function public.rename_household(name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  household uuid := public.require_admin();
  clean text := nullif(left(trim(coalesce(name, '')), 80), '');
begin
  if clean is null then
    raise exception 'A household needs a name.' using errcode = 'check_violation';
  end if;
  update public.households set name = clean where id = household;
end;
$$;

-- The internal helpers are not part of the API. `join_as` in particular adds
-- the caller to any household it is given, so it must never be callable from
-- the client. Supabase grants execute on new functions to anon and
-- authenticated by default, so revoking from public alone is not enough.
revoke execute on function public.join_as(uuid, text) from public;
revoke execute on function public.free_person_key(uuid, text) from public;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    begin
      execute format('revoke execute on function public.join_as(uuid, text) from %I', r);
      execute format('revoke execute on function public.free_person_key(uuid, text) from %I', r);
    exception
      when undefined_object then null;
    end;
  end loop;
end;
$$;

do $$
begin
  grant select on public.households, public.household_members, public.household_invites to authenticated;
  grant execute on function
    public.current_household(), public.has_role(text), public.is_member(), public.auth_email(),
    public.role_rank(text), public.accept_invite(), public.join_household(),
    public.create_household(text), public.invite_member(text, text), public.revoke_invite(uuid),
    public.set_member_role(uuid, text), public.remove_member(uuid), public.set_display_name(text),
    public.rename_household(text), public.require_admin()
  to authenticated;
exception
  when undefined_object then
    raise notice 'No authenticated role here, skipping the grants.';
end;
$$;

-- Realtime for the member list, so a new person appears on the other phone.
do $$
begin
  alter publication supabase_realtime add table public.household_members;
exception
  when duplicate_object then null;
  when insufficient_privilege or undefined_object then
    raise notice 'Could not add household_members to the realtime publication (%).', sqlerrm;
end;
$$;
