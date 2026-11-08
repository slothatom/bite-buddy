-- Bite Buddy, recipe photos
--
-- Paste this whole file into the Supabase SQL editor and run it once, after
-- schema.sql and rows.sql. Re-running is safe.
--
-- Until this is run the app simply does not offer to add a photo. Nothing
-- breaks and nothing appears half-built: the editor asks storage whether the
-- bucket is there, and hides the control when it is not.

-- ─────────────────────────────────────────────────────────────────────────────
-- Where the photos go
--
-- Private, not public.
--
-- A public bucket would have been less code: a permanent URL per file, no
-- signing, no expiry, and the service worker could cache it like any other
-- image. The reason not to is that a public bucket is public to anybody who
-- ever sees a URL, and these are photographs taken in your kitchen. What is in
-- the frame behind the dinner is not something this file gets to decide on
-- your behalf, and the rest of this database is gated on membership, so this is
-- too.
--
-- The cost is that the app has to mint a signed URL to show one, which it
-- caches for the session. A photo will therefore not appear on a phone that is
-- fully offline and has not shown it before. That is a real limitation and the
-- honest trade for not publishing your kitchen.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  false,
  -- 5 MB. A phone camera will happily hand over 12, and the app downscales
  -- before uploading, so anything arriving above this is a fault worth
  -- refusing rather than storing.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- Who may touch them
--
-- The household, and nobody else. Same rule as every other table: is_member()
-- is defined in schema.sql and answers "is whoever is asking one of us".
--
-- Not per person. A recipe belongs to the household, so its photo does too, and
-- a photo only one of you could see would be a photo the other one's app showed
-- a broken frame for.

drop policy if exists "household reads recipe photos" on storage.objects;
create policy "household reads recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos' and public.is_member());

drop policy if exists "household adds recipe photos" on storage.objects;
create policy "household adds recipe photos"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and public.is_member());

drop policy if exists "household replaces recipe photos" on storage.objects;
create policy "household replaces recipe photos"
  on storage.objects for update
  using (bucket_id = 'recipe-photos' and public.is_member())
  with check (bucket_id = 'recipe-photos' and public.is_member());

-- Deleting matters as much as adding. Without this a photo you replaced would
-- sit in the bucket for ever, and "remove this photo" would clear it from the
-- recipe while leaving the file behind.
drop policy if exists "household removes recipe photos" on storage.objects;
create policy "household removes recipe photos"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and public.is_member());
