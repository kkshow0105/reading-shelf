-- 4A.5: permit the FK's ON DELETE SET NULL when an Auth user is removed.
-- Ordinary clients cannot update deleted_by (column grant is absent).
-- Keep every reading record and its original cover; do not broaden privileges.
begin;
create or replace function public.maintain_book_deletion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := clock_timestamp();
    new.deleted_by := auth.uid();
  elsif new.deleted_at is null then
    new.deleted_by := null;
  else
    new.deleted_at := old.deleted_at;
    -- A NULL from referential cleanup must stay NULL. Otherwise retain the actor.
    if new.deleted_by is not null then
      new.deleted_by := old.deleted_by;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.maintain_book_deletion() from public, anon, authenticated;
commit;
