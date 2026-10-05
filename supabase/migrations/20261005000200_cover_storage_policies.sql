-- Bucket creation goes through Storage API: scripts/setup-cover-bucket.mjs.
-- Only policies, no INSERT/UPDATE/DELETE against storage.objects or buckets.
begin;
create policy reading_shelf_covers_read on storage.objects for select to authenticated
using (
  bucket_id = 'book-covers'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (select 1 from public.household_members m
    where m.household_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()))
  and exists (select 1 from public.books b
    where b.household_id::text = (storage.foldername(name))[1]
      and b.profile_id::text = (storage.foldername(name))[2]
      and b.id::text = (storage.foldername(name))[3])
);
create policy reading_shelf_covers_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'book-covers'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  and exists (select 1 from public.household_members m
    where m.household_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()))
  and exists (select 1 from public.books b
    where b.household_id::text = (storage.foldername(name))[1]
      and b.profile_id::text = (storage.foldername(name))[2]
      and b.id::text = (storage.foldername(name))[3] and b.deleted_at is null)
);
-- No UPDATE/DELETE policy: no overwrite, move or destructive removal in 4A.
-- Soft-deleted books and previous unique image paths remain readable for recovery.
commit;
