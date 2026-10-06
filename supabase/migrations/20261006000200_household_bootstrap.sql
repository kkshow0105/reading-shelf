-- 4B-1: one-time bootstrap for the caller, never a general membership API.
begin;

create function public.bootstrap_household(p_household_name text, p_profile_names text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  household_name text := pg_catalog.btrim(p_household_name);
  profile_name text;
  household_id uuid;
  profile_order integer := 0;
begin
  if caller_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  -- Serialize concurrent requests from the SAME user, across tabs/devices.
  -- Different users can still initialize independently; lock lasts one transaction.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reading-shelf/bootstrap:' || caller_id::text, 0));
  if exists (select 1 from public.household_members m where m.user_id = caller_id) then
    raise exception using errcode = 'P0001', message = 'already_initialized';
  end if;
  if household_name is null or pg_catalog.char_length(household_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'invalid_household_name';
  end if;
  if p_profile_names is null or pg_catalog.array_ndims(p_profile_names) is distinct from 1
    or pg_catalog.cardinality(p_profile_names) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'invalid_profile_count';
  end if;
  foreach profile_name in array p_profile_names loop
    if profile_name is null or pg_catalog.char_length(pg_catalog.btrim(profile_name)) not between 1 and 20 then
      raise exception using errcode = '22023', message = 'invalid_profile_name';
    end if;
  end loop;

  insert into public.households (name) values (household_name) returning id into household_id;
  insert into public.household_members (household_id, user_id, role) values (household_id, caller_id, 'owner');
  foreach profile_name in array p_profile_names loop
    insert into public.profiles (household_id, name, sort_order)
      values (household_id, pg_catalog.btrim(profile_name), profile_order);
    profile_order := profile_order + 1;
  end loop;
  return household_id;
end;
$$;

alter function public.bootstrap_household(text, text[]) owner to postgres;
revoke all on function public.bootstrap_household(text, text[]) from public, anon, authenticated;
grant execute on function public.bootstrap_household(text, text[]) to authenticated;
comment on function public.bootstrap_household(text, text[]) is
  'Creates one household, caller-only owner membership and 1-10 profiles atomically; rejects existing members.';
commit;
