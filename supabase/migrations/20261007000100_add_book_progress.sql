-- Forward-only: existing records remain NULL; no backfill or status changes.
begin;
alter table public.books add column progress_percent integer;
alter table public.books add constraint books_progress_percent_check
  check (progress_percent is null or progress_percent between 0 and 100);
-- Retain column-level writes and all existing household RLS policies.
grant insert (progress_percent), update (progress_percent) on public.books to authenticated;
commit;
