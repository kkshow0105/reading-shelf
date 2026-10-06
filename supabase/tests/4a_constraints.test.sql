-- Verified dedicated project only. Real constraints, zero persistent fixtures.
begin;
do $tests$
declare
  h uuid := 'e1000000-0000-0000-0000-000000000001';
  p uuid := 'e2000000-0000-0000-0000-000000000001';
  b uuid := 'e3000000-0000-0000-0000-000000000001';
  u uuid := 'e4000000-0000-0000-0000-000000000001';
  r smallint;
  s text;
  x real;
  original_created timestamptz;
  original_updated timestamptz;
begin
  insert into public.households(id,name) values(h,'4A.5 rollback fixture');
  insert into public.profiles(id,household_id,name) values(p,h,'Test profile');
  insert into public.books(id,household_id,profile_id,title,author) values(b,h,p,'Test title','Test author');
  select created_at,updated_at into original_created,original_updated from public.books where id=b;
  if original_created is null or original_updated is null then raise exception 'timestamps_missing'; end if;

  foreach r in array array[null,1,5]::smallint[] loop
    update public.books set rating=r where id=b;
  end loop;
  foreach r in array array[0,6]::smallint[] loop
    begin
      update public.books set rating=r where id=b;
      raise exception 'invalid_rating_accepted';
    exception when check_violation then null;
    end;
  end loop;
  foreach s in array array['want_to_read','reading','finished','paused','abandoned'] loop
    update public.books set status=s where id=b;
  end loop;
  begin
    update public.books set status='invalid' where id=b;
    raise exception 'invalid_status_accepted';
  exception when check_violation then null;
  end;
  foreach x in array array[0,0.5,1]::real[] loop
    update public.books set cover_position_x=x,cover_position_y=x where id=b;
  end loop;
  foreach x in array array[-0.1,1.1]::real[] loop
    begin
      update public.books set cover_position_x=x where id=b;
      raise exception 'invalid_position_x_accepted';
    exception when check_violation then null;
    end;
    begin
      update public.books set cover_position_y=x where id=b;
      raise exception 'invalid_position_y_accepted';
    exception when check_violation then null;
    end;
  end loop;
  begin
    update public.books set title='' where id=b;
    raise exception 'empty_title_accepted';
  exception when check_violation then null;
  end;
  begin
    update public.books set author='  ' where id=b;
    raise exception 'empty_author_accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.households(name) values('');
    raise exception 'empty_household_accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.profiles(household_id,name) values('e1000000-0000-0000-0000-000000000002','wrong household');
    raise exception 'invalid_profile_fk_accepted';
  exception when foreign_key_violation then null;
  end;
  insert into auth.users(id,email) values(u,'rollback-actor@example.invalid');
  insert into public.household_members(household_id,user_id) values(h,u);
  begin
    insert into public.household_members(household_id,user_id) values(h,u);
    raise exception 'duplicate_membership_accepted';
  exception when unique_violation then null;
  end;
  if not (select created_at=original_created and updated_at>original_updated from public.books where id=b) then
    raise exception 'timestamp_trigger_failed';
  end if;
  -- Auth removal must implement deleted_by ON DELETE SET NULL without losing books.
  -- Simulate the actual tenant Auth actor; administrator session JWTs are irrelevant.
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.books set deleted_at=null where id=b;
  update public.books set deleted_at=now() where id=b;
  delete from auth.users where id=u;
  if not (select deleted_by is null and deleted_at is not null from public.books where id=b) then
    raise exception 'deleted_actor_fk_set_null_failed';
  end if;
end;
$tests$;
rollback;
