-- 4A only. Apply to the explicitly verified Reading Shelf Supabase project.
-- No destructive migration, mock seed, auth bootstrap or Storage row mutations.
begin;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_household_idx on public.household_members(user_id, household_id);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  name text not null check (char_length(btrim(name)) between 1 and 20),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (household_id, id)
);
create index profiles_household_order_idx on public.profiles(household_id, sort_order, id);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  profile_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  author text not null check (char_length(btrim(author)) between 1 and 200),
  translator text check (char_length(translator) <= 200),
  status text not null default 'want_to_read'
    check (status in ('want_to_read', 'reading', 'finished', 'paused', 'abandoned')),
  started_on date,
  finished_on date,
  rating smallint check (rating between 1 and 5),
  notes text check (char_length(notes) <= 5000),
  cover_original_path text,
  cover_original_filename text,
  cover_mime_type text check (cover_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  cover_position_x real not null default 0.5 check (cover_position_x between 0 and 1),
  cover_position_y real not null default 0.5 check (cover_position_y between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  foreign key (household_id, profile_id) references public.profiles(household_id, id),
  constraint books_date_order check (started_on is null or finished_on is null or started_on <= finished_on),
  constraint books_reading_end_date check (status not in ('reading', 'paused') or finished_on is null),
  constraint books_active_delete_actor check (deleted_at is not null or deleted_by is null),
  constraint books_cover_metadata check (
    (cover_original_path is null and cover_original_filename is null and cover_mime_type is null)
    or (cover_original_path is not null and cover_original_filename is not null and cover_mime_type is not null
      and char_length(cover_original_filename) between 1 and 255
      and cover_original_path ~ ('^' || household_id::text || '/' || profile_id::text || '/' || id::text
        || '/original/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$')))
);
create index books_profile_active_idx on public.books(household_id, profile_id, created_at, id)
  where deleted_at is null;
create index books_profile_deleted_idx on public.books(household_id, profile_id, deleted_at)
  where deleted_at is not null;

-- Invoker trigger: no SECURITY DEFINER and no elevated API function.
create function public.maintain_record_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.maintain_record_timestamps() from public, anon, authenticated;
create trigger households_timestamps before update on public.households
  for each row execute function public.maintain_record_timestamps();
create trigger profiles_timestamps before update on public.profiles
  for each row execute function public.maintain_record_timestamps();
create trigger books_timestamps before update on public.books
  for each row execute function public.maintain_record_timestamps();

create function public.maintain_book_deletion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    -- The client merely requests deletion; the database determines date and actor.
    new.deleted_at := clock_timestamp();
    new.deleted_by := auth.uid();
  elsif new.deleted_at is null then
    new.deleted_by := null;
  else
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;
revoke all on function public.maintain_book_deletion() from public, anon, authenticated;
create trigger books_deletion before update on public.books
  for each row execute function public.maintain_book_deletion();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles enable row level security;
alter table public.books enable row level security;

-- Remove inherited Supabase default grants. No hard DELETE or membership writes.
revoke all on public.households, public.household_members, public.profiles, public.books from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.households, public.household_members, public.profiles, public.books to authenticated;
grant update (name) on public.households to authenticated;
grant insert (household_id, name, sort_order) on public.profiles to authenticated;
grant update (name, sort_order, archived_at) on public.profiles to authenticated;
grant insert (id, household_id, profile_id, title, author, translator, status, started_on, finished_on,
  rating, notes, cover_original_path, cover_original_filename, cover_mime_type, cover_position_x, cover_position_y)
  on public.books to authenticated;
grant update (title, author, translator, status, started_on, finished_on, rating, notes,
  cover_original_path, cover_original_filename, cover_mime_type, cover_position_x, cover_position_y,
  deleted_at) on public.books to authenticated;

-- Self-membership visibility makes all membership subqueries non-recursive.
-- Bootstrap/invitations are administrator-only, never a client INSERT.
create policy members_read_self on public.household_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy households_read_member on public.households for select to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = households.id and m.user_id = (select auth.uid())));
create policy households_update_owner on public.households for update to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = households.id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.household_members m
    where m.household_id = households.id and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy profiles_read_member on public.profiles for select to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = profiles.household_id and m.user_id = (select auth.uid())));
create policy profiles_insert_member on public.profiles for insert to authenticated
  with check (exists (select 1 from public.household_members m
    where m.household_id = profiles.household_id and m.user_id = (select auth.uid())));
create policy profiles_update_member on public.profiles for update to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = profiles.household_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.household_members m
    where m.household_id = profiles.household_id and m.user_id = (select auth.uid())));
create policy books_read_member on public.books for select to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = books.household_id and m.user_id = (select auth.uid())));
create policy books_insert_member on public.books for insert to authenticated
  with check (exists (select 1 from public.household_members m
    where m.household_id = books.household_id and m.user_id = (select auth.uid())));
create policy books_update_member on public.books for update to authenticated
  using (exists (select 1 from public.household_members m
    where m.household_id = books.household_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.household_members m
    where m.household_id = books.household_id and m.user_id = (select auth.uid())));
commit;
