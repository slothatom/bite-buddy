-- Bite Buddy, membership repair
--
-- Paste this into the Supabase SQL editor and run it. It is small on purpose:
-- everything here is about one thing, whether an account is allowed to read and
-- write the household's data, and nothing in it can fail part way and leave you
-- worse off.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- What went wrong
--
-- Every policy in this database asks `is_member()`, and membership is one row in
-- `public.members`. The app writes that row at sign-in with an upsert, which
-- Postgres runs as `insert ... on conflict do update`. That statement needs the
-- select policy to pass so it can look for a conflicting row, and the select
-- policy was `is_member()`. So joining required already having joined. Every
-- attempt was refused, nobody was ever added, and after that every read and
-- write of the household's data was refused too.
--
-- The fix for that is in schema.sql. This file exists because schema.sql may
-- never have reached it: it also creates a trigger on `auth.users`, which
-- belongs to Supabase, and newer projects refuse that with "must be owner of
-- relation users". The SQL editor runs a script as one transaction, so that
-- error abandons everything after it, including the policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Let an account see its own row, which is what an upsert needs. This grants
--    nothing else: everything worth reading is still behind `is_member()`.
drop policy if exists "members are visible to the household" on public.members;
create policy "members are visible to the household"
  on public.members for select
  using (public.is_member() or id = auth.uid());

-- 2. Add everybody who already has an account. This is what actually puts the
--    two of you back in the household right now.
insert into public.members (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

-- 3. A way in that depends on no policy at all, for the app to call when it
--    finds itself signed in and unable to do anything. It runs as its owner and
--    can add exactly one row: yours, for whoever is making the call.
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

grant execute on function public.join_household() to authenticated;

-- 4. Say who is in, so you can see this worked before going back to the app.
select id, email, created_at from public.members order by created_at;
