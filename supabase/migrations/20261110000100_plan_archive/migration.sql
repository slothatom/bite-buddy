-- Bite Buddy, the plan archive
--
-- The dietician's plans used to ship inside the site's JavaScript, from a
-- public repository. They are somebody's medical correspondence, so they move
-- here: one row per household holding the whole archive as JSON, readable by
-- the household's members and nobody else, written only by its admins.
--
-- The app uploads the file `npm run data:build` writes (Settings, Plan
-- history) and reads it back after sign-in, keeping a copy on the device for
-- offline use until the person signs out.
--
-- Safe to run twice: everything below is idempotent. Uses the helpers from the
-- households migration and changes none of its policies.

create table if not exists public.plan_archive (
  household_id uuid primary key references public.households on delete cascade,
  -- { version, sourcePlans, mealRecipes, classification, recipeAliases, timesPlanned }.
  -- Checked by the app before upload (src/data/archiveFormat.ts); the
  -- database only insists it is an object with a version.
  data         jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'version'),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users on delete set null
);

alter table public.plan_archive enable row level security;

-- Every member reads it, viewers included: the archive is what the household
-- plans from.
drop policy if exists "members read the plan archive" on public.plan_archive;
create policy "members read the plan archive"
  on public.plan_archive for select
  using (household_id = public.current_household());

-- Only an admin replaces it. It is the whole of the household's plans in one
-- row, and a viewer or an editor uploading the wrong file would replace all of
-- it at once.
drop policy if exists "admins add the plan archive" on public.plan_archive;
create policy "admins add the plan archive"
  on public.plan_archive for insert
  with check (household_id = public.current_household() and public.has_role('admin'));

drop policy if exists "admins change the plan archive" on public.plan_archive;
create policy "admins change the plan archive"
  on public.plan_archive for update
  using (household_id = public.current_household() and public.has_role('admin'))
  with check (household_id = public.current_household() and public.has_role('admin'));

drop policy if exists "admins remove the plan archive" on public.plan_archive;
create policy "admins remove the plan archive"
  on public.plan_archive for delete
  using (household_id = public.current_household() and public.has_role('admin'));

-- Who uploaded it and when, stamped by the database rather than trusted from
-- the client. The same trigger the row tables use: it also fills in the
-- caller's household when the client leaves it out.
drop trigger if exists touch_plan_archive on public.plan_archive;
create trigger touch_plan_archive
  before insert or update on public.plan_archive
  for each row execute function public.touch_row();

do $$
begin
  grant select, insert, update, delete on public.plan_archive to authenticated;
  -- Nothing for anon: a signed-out visitor has no household, and the policies
  -- would return nothing anyway, but there is no reason to let them ask.
  revoke all on public.plan_archive from anon;
exception
  when undefined_object then
    raise notice 'No authenticated or anon role here, skipping the grants.';
end;
$$;
