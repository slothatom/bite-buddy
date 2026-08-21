-- Bite Buddy, row storage
--
-- Paste this whole file into the Supabase SQL editor and run it once, after
-- schema.sql. Re-running is safe: everything here is idempotent, and the import
-- at the end refuses to run twice.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Why this exists
--
-- The first design stored each of the app's stores as one JSON document in
-- `app_state`. It was small and easy to reason about, and it had three faults
-- that are not fixable inside that shape:
--
--  1. **A write is all or nothing.** Saving a weight rewrites the whole body
--     document, so two devices writing at once means one of them loses
--     everything it had, not just the field it touched.
--  2. **A deletion cannot be expressed.** A document says what exists. Merging
--     two documents can only union or replace, so either a deletion is lost or
--     an addition is. This app chose to union, which means deleting a weight on
--     one phone lets the other phone put it back.
--  3. **Everything travels every time.** A changed grocery item sends the whole
--     list, and a changed recipe sends every recipe you have ever edited.
--
-- Rows fix all three. A row is the unit of change, so writes do not collide
-- unless they are about the same thing; a deletion is a row with `deleted_at`
-- set, which is a fact that travels like any other; and a pull asks only for
-- what changed since last time.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- The shape of every table here
--
--   id          the app's own id for the thing, so a row means the same thing
--               on every device without a translation table
--   data        the entity itself, as the app already models it
--   updated_at  when it last changed, which is how two versions are compared
--   deleted_at  when it was deleted, or null. Rows are never removed.
--   updated_by  who wrote it, so a device can ignore the echo of its own write
--
-- Plus a few promoted columns, `date`, `member_id`, `slot`, which exist because
-- they are what the app filters by. Everything else stays inside `data`.
--
-- That is a deliberate middle position. Spelling out every field as a column
-- would be more conventional, and here it would mean a database migration every
-- time a recipe gains a field, for no gain: this database has exactly one
-- client, the types are enforced in TypeScript, and nothing but the app ever
-- queries these tables. What matters is that the *unit of change* is a row.
-- That is what was wrong before, and that is what this fixes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared bookkeeping, applied to every table below.
create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Why `data`, `day` and `slot` are nullable
--
-- Because a tombstone is a row too, and a deleted thing has no payload and no
-- day. The client sends `{ id, deleted_at }` and nothing else, since by then it
-- no longer holds the thing it is telling you about.
--
-- Postgres checks not-null constraints on the proposed row before it goes
-- looking for a conflicting one, so `insert ... on conflict do update` fails
-- outright when a required column is missing, even though the row already
-- exists and the update would have left that column alone. With `not null`
-- here, every deletion this app ever made would have been refused, forever,
-- and the only sign would have been a sync error nobody reads.
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the sync columns, policies, indexes and trigger for one table.
 *
 * Written as a procedure because there are ten of these and the interesting
 * part of each is its own two or three columns. Repeating twelve lines of
 * policy ten times is how one of them ends up subtly different.
 */
create or replace procedure public.make_syncable(table_name text)
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', table_name);

  execute format($f$
    drop policy if exists "household reads %1$s" on public.%1$I;
    create policy "household reads %1$s" on public.%1$I
      for select using (public.is_member());

    drop policy if exists "household writes %1$s" on public.%1$I;
    create policy "household writes %1$s" on public.%1$I
      for insert with check (public.is_member());

    drop policy if exists "household updates %1$s" on public.%1$I;
    create policy "household updates %1$s" on public.%1$I
      for update using (public.is_member()) with check (public.is_member());
  $f$, table_name);

  -- Every pull is "what changed since I last looked", so this index is the
  -- difference between reading the week's changes and reading the whole table.
  execute format(
    'create index if not exists %I on public.%I (updated_at desc)',
    table_name || '_updated_at_idx', table_name);

  execute format('drop trigger if exists touch_%1$s on public.%1$I', table_name);
  execute format(
    'create trigger touch_%1$s before insert or update on public.%1$I
       for each row execute function public.touch_row()', table_name);

  -- Realtime, so the other phone sees a change rather than waiting for a pull.
  -- Adding to a publication needs to own it, and that is not worth abandoning
  -- the rest of this file over: without it the other screen updates on the next
  -- pull instead of at once.
  begin
    execute format('alter publication supabase_realtime add table public.%I', table_name);
  exception
    when duplicate_object then null;
    when insufficient_privilege or undefined_object then
      raise notice 'Could not add % to the realtime publication (%).', table_name, sqlerrm;
  end;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The plan, one meal at a time
--
-- A meal rather than a day, because a day is the thing two people edit at once.
-- You add Thursday's dinner while Oli adds Thursday's lunch: two rows, no
-- contest. Under the old shape that was one document and one of you lost.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_meals (
  id         text primary key,
  day        date,
  slot       text,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists plan_meals_day_idx on public.plan_meals (day);
call public.make_syncable('plan_meals');

-- ─────────────────────────────────────────────────────────────────────────────
-- The shopping list
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.grocery_items (
  id         text primary key,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
call public.make_syncable('grocery_items');

-- ─────────────────────────────────────────────────────────────────────────────
-- The libraries
--
-- A row exists only for a recipe or food you have touched: written yourself,
-- edited, hidden, folded into another, or favourited. The 275 shipped recipes
-- and 122 shipped foods live in the app itself and are not stored here, so
-- this table holds your changes rather than a copy of the library.
--
-- `hidden` is why deletion works now. It is a column with a value, so "I
-- deleted this" is a fact that travels; before, it was the absence of an entry
-- in a list, and an absence cannot be told apart from not having heard yet.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.recipes (
  id          text primary key,
  data        jsonb,
  hidden      boolean not null default false,
  favourite   boolean not null default false,
  merged_into text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  updated_by  uuid references auth.users on delete set null
);
call public.make_syncable('recipes');

create table if not exists public.foods (
  id          text primary key,
  data        jsonb,
  hidden      boolean not null default false,
  merged_into text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  updated_by  uuid references auth.users on delete set null
);
call public.make_syncable('foods');

-- ─────────────────────────────────────────────────────────────────────────────
-- The personal logs
--
-- Shared storage, separate histories: every row says whose it is, and the
-- screens show one person at a time. Two people logging a weight on the same
-- morning are two rows, which is the whole point.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.weights (
  id         text primary key,
  member_id  text,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists weights_member_idx on public.weights (member_id, day);
call public.make_syncable('weights');

create table if not exists public.measurements (
  id         text primary key,
  member_id  text,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists measurements_member_idx on public.measurements (member_id, day);
call public.make_syncable('measurements');

create table if not exists public.workouts (
  id         text primary key,
  member_id  text,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists workouts_member_idx on public.workouts (member_id, day);
call public.make_syncable('workouts');

create table if not exists public.steps (
  id         text primary key,
  member_id  text,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists steps_member_idx on public.steps (member_id, day);
call public.make_syncable('steps');

create table if not exists public.sleep (
  id         text primary key,
  member_id  text,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
create index if not exists sleep_member_idx on public.sleep (member_id, day);
call public.make_syncable('sleep');

-- ─────────────────────────────────────────────────────────────────────────────
-- What is cooked and waiting
--
-- A batch in the freezer and last night's leftovers, which are the same thing
-- wearing different labels. Shared, because the fridge is.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.portions (
  id         text primary key,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
call public.make_syncable('portions');

-- ─────────────────────────────────────────────────────────────────────────────
-- The cupboard
--
-- Keyed by the food, since there is only ever one entry per food and both
-- phones then agree about the same jar without reconciling two ids for it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pantry (
  id         text primary key,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
call public.make_syncable('pantry');

-- ─────────────────────────────────────────────────────────────────────────────
-- Cooking sessions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cook_sessions (
  id         text primary key,
  day        date,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
call public.make_syncable('cook_sessions');

-- ─────────────────────────────────────────────────────────────────────────────
-- Settings
--
-- The one genuinely single-valued thing in the app: the household's targets,
-- the week start, the name. One row, and the later edit wins, which is the
-- right answer when there is only one of something.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id         text primary key,
  data       jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references auth.users on delete set null
);
call public.make_syncable('settings');

-- ─────────────────────────────────────────────────────────────────────────────
-- Bringing across whatever the old documents hold
--
-- `app_state` is left exactly as it is. This reads it and writes rows, once.
-- Running it again changes nothing, because every insert is `on conflict do
-- nothing`: anything already here was either imported before or has since been
-- edited, and in both cases the row is the newer truth.
--
-- The old table is not dropped. It costs nothing to keep, and it is the only
-- copy of what the app held before this ran.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  doc jsonb;
  item jsonb;
  meal jsonb;
begin
  -- The week: each day's meals become one row apiece.
  select data into doc from public.app_state where key like '%mealplan%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'plan', '[]'::jsonb)) loop
      for meal in select * from jsonb_array_elements(coalesce(item -> 'meals', '[]'::jsonb)) loop
        insert into public.plan_meals (id, day, slot, data)
        values (
          coalesce(meal ->> 'id', gen_random_uuid()::text),
          (item ->> 'date')::date,
          coalesce(meal ->> 'slot', 'lunch'),
          meal
        )
        on conflict (id) do nothing;
      end loop;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'groceryItems', '[]'::jsonb)) loop
      insert into public.grocery_items (id, data)
      values (coalesce(item ->> 'id', gen_random_uuid()::text), item)
      on conflict (id) do nothing;
    end loop;
  end if;

  -- The libraries: what you wrote, what you hid, what you folded together.
  select data into doc from public.app_state where key like '%recipes%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'custom', '[]'::jsonb)) loop
      insert into public.recipes (id, data) values (item ->> 'id', item)
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'hidden', '[]'::jsonb)) loop
      insert into public.recipes (id, hidden) values (item #>> '{}', true)
      on conflict (id) do update set hidden = true;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'favouriteIds', '[]'::jsonb)) loop
      insert into public.recipes (id, favourite) values (item #>> '{}', true)
      on conflict (id) do update set favourite = true;
    end loop;

    insert into public.recipes (id, merged_into)
    select key, value #>> '{}' from jsonb_each(coalesce(doc -> 'mergedInto', '{}'::jsonb))
    on conflict (id) do update set merged_into = excluded.merged_into;
  end if;

  select data into doc from public.app_state where key like '%foods%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'custom', '[]'::jsonb)) loop
      insert into public.foods (id, data) values (item ->> 'id', item)
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'hidden', '[]'::jsonb)) loop
      insert into public.foods (id, hidden) values (item #>> '{}', true)
      on conflict (id) do update set hidden = true;
    end loop;

    insert into public.foods (id, merged_into)
    select key, value #>> '{}' from jsonb_each(coalesce(doc -> 'mergedInto', '{}'::jsonb))
    on conflict (id) do update set merged_into = excluded.merged_into;
  end if;

  -- The logs.
  select data into doc from public.app_state where key like '%body%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'weightEntries', '[]'::jsonb)) loop
      insert into public.weights (id, member_id, day, data)
      values (item ->> 'id', item ->> 'memberId', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'measurements', '[]'::jsonb)) loop
      insert into public.measurements (id, member_id, day, data)
      values (item ->> 'id', item ->> 'memberId', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;
  end if;

  select data into doc from public.app_state where key like '%activity%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'workouts', '[]'::jsonb)) loop
      insert into public.workouts (id, member_id, day, data)
      values (item ->> 'id', item ->> 'personId', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'steps', '[]'::jsonb)) loop
      insert into public.steps (id, member_id, day, data)
      values (item ->> 'id', item ->> 'personId', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(doc -> 'sleep', '[]'::jsonb)) loop
      insert into public.sleep (id, member_id, day, data)
      values (item ->> 'id', item ->> 'personId', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;
  end if;

  select data into doc from public.app_state where key like '%cook%';
  if doc is not null then
    for item in select * from jsonb_array_elements(coalesce(doc -> 'sessions', '[]'::jsonb)) loop
      insert into public.cook_sessions (id, day, data)
      values (item ->> 'id', (item ->> 'date')::date, item)
      on conflict (id) do nothing;
    end loop;
  end if;

  select data into doc from public.app_state where key like '%user%';
  if doc is not null and doc -> 'profile' is not null then
    insert into public.settings (id, data) values ('profile', doc -> 'profile')
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bringing an existing install up to date
--
-- The first version of this file made `data`, `day` and `slot` not null, which
-- made deletions impossible to record. Dropping a constraint that is already
-- gone is not an error, so this is safe to re-run and safe on a fresh install.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  c text;
begin
  foreach t in array array[
    'plan_meals', 'grocery_items', 'recipes', 'foods', 'weights', 'measurements',
    'workouts', 'steps', 'sleep', 'portions', 'pantry', 'cook_sessions', 'settings'
  ] loop
    foreach c in array array['data', 'day', 'slot'] loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = c
      ) then
        execute format('alter table public.%I alter column %I drop not null', t, c);
      end if;
    end loop;
  end loop;
end;
$$;
