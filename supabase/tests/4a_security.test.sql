-- LOCAL DISPOSABLE database only, after applying migrations.
-- Not executed in 4A: this machine has no Docker/Supabase PostgreSQL.
-- All fixtures roll back. No production mock import and no Storage object DML.
begin;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
select extensions.plan(17);
insert into auth.users (id, email) values
 ('a0000000-0000-0000-0000-000000000001', 'owner-a@example.invalid'),
 ('a0000000-0000-0000-0000-000000000002', 'member-a@example.invalid'),
 ('a0000000-0000-0000-0000-000000000003', 'owner-b@example.invalid');
insert into public.households (id, name) values
 ('b0000000-0000-0000-0000-000000000001', 'Test A'),
 ('b0000000-0000-0000-0000-000000000002', 'Test B');
insert into public.household_members (household_id, user_id, role) values
 ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
 ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member'),
 ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'owner');
insert into public.profiles (id, household_id, name) values
 ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Test A1'),
 ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Test A2'),
 ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Test B1');
insert into public.books (id, household_id, profile_id, title, author) values
 ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Test book', 'Test author'),
 ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Test book', 'Test author');
select extensions.is((select count(*)::int from pg_class where oid in
 ('public.households'::regclass, 'public.household_members'::regclass, 'public.profiles'::regclass, 'public.books'::regclass) and relrowsecurity), 4, 'all application tables have RLS');
select extensions.ok(not has_table_privilege('authenticated', 'public.books', 'DELETE'), 'hard DELETE has no grant');
select extensions.ok(not has_table_privilege('authenticated', 'public.household_members', 'INSERT'), 'membership INSERT has no grant');
select extensions.ok(not has_column_privilege('authenticated', 'public.books', 'household_id', 'UPDATE'), 'household reassignment has no grant');
select extensions.ok(not has_column_privilege('authenticated', 'public.books', 'profile_id', 'UPDATE'), 'profile reassignment has no grant');
select extensions.is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'reading_shelf_covers_%' and cmd in ('UPDATE','DELETE')), 0, 'no cover overwrite or delete policy');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select extensions.is((select count(*)::int from public.profiles), 2, 'non-owner can read both family profiles');
select extensions.is((select count(*)::int from public.books), 1, 'non-owner cannot read other household books');
select extensions.is((select count(*)::int from public.household_members), 1, 'only own membership visible, no recursive RLS');
select extensions.lives_ok($q$update public.books set notes = 'member update' where id = 'd0000000-0000-0000-0000-000000000001'$q$, 'member can edit family book');
select extensions.throws_ok($q$insert into public.books (household_id, profile_id, title, author)
 values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'bad', 'bad')$q$, '23503', null, 'composite FK rejects wrong profile household');
select extensions.throws_ok($q$insert into public.books (household_id, profile_id, title, author)
 values ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'bad', 'bad')$q$, '42501', null, 'RLS rejects cross-household insertion');
select extensions.lives_ok($q$insert into public.books (household_id, profile_id, title, author, status, finished_on)
 values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'only finish', 'test', 'finished', '2025-01-01')$q$, 'finished date without start is valid');
select extensions.throws_ok($q$delete from public.books where id = 'd0000000-0000-0000-0000-000000000001'$q$, '42501', null, 'hard DELETE rejected');
update public.books set deleted_at = '2000-01-01' where id = 'd0000000-0000-0000-0000-000000000001';
select extensions.ok((select deleted_at > '2020-01-01' and deleted_by = auth.uid() from public.books where id = 'd0000000-0000-0000-0000-000000000001'), 'database determines soft-delete timestamp and actor');
update public.books set deleted_at = null where id = 'd0000000-0000-0000-0000-000000000001';
select extensions.ok((select deleted_at is null and deleted_by is null from public.books where id = 'd0000000-0000-0000-0000-000000000001'), 'restore preserves record and clears deletion metadata');
reset role;
set local role anon;
select extensions.ok(not has_table_privilege(current_user, 'public.books', 'SELECT'), 'anonymous access has no grant');
reset role;
select * from extensions.finish();
rollback;
