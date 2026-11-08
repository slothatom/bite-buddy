-- Bite Buddy, membership repair (households)
--
-- Paste this into the Supabase SQL editor and run it when somebody who should
-- be in the household is told they are not. Nothing in it can make things
-- worse: it reads, and it adds one membership you name.
--
-- Since the households migration (20261109000100_households), access is a row
-- in `household_members`, not a row in `members` plus an email on
-- `allowed_emails`. The old version of this file redefined `is_member()` the
-- old way; do not paste that version any more.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Who is in which household, with what role.
-- ─────────────────────────────────────────────────────────────────────────────

select h.name as household, h.is_default, m.email, m.role, m.person_key, m.display_name
from public.household_members m
join public.households h on h.id = m.household_id
order by h.created_at, m.created_at;

-- Pending invites, and accounts that exist but belong to no household.
select i.email, i.role, h.name as household, i.created_at
from public.household_invites i join public.households h on h.id = i.household_id
where i.accepted_at is null;

select u.email, u.created_at
from auth.users u
where not exists (select 1 from public.household_members m where m.user_id = u.id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Put an existing account into the original household, as admin.
--
-- Uncomment, put the address in, and run. The person key is what their own
-- rows (weights, sleep, workouts) use as `member_id`; check those with
--   select distinct member_id from public.weights;
-- and use the one that is theirs, so their history stays theirs.
-- ─────────────────────────────────────────────────────────────────────────────

-- insert into public.household_members (household_id, user_id, role, person_key, email)
-- select h.id, u.id, 'admin', 'THEIR-PERSON-KEY', u.email
-- from public.households h, auth.users u
-- where h.is_default and lower(u.email) = lower('them@example.com')
-- on conflict (household_id, user_id) do update set role = excluded.role;
