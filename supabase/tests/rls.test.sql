begin;
select plan(23);

create function pg_temp.affected(q text) returns int language plpgsql as $f$
declare n int; begin execute q; get diagnostics n = row_count; return n; end $f$;

-- Fixtures (as postgres) -------------------------------------------------------
-- Before a real group code is set, nobody can sign up, not even with the placeholder text.
update public.app_config set value = '[PLACEHOLDER]' where key = 'group_code';
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-0000000000fe', 'p@test.nl', '{"group_code":"[PLACEHOLDER]","display_name":"P"}')$$,
  'P0001', 'invalid group code', 'signup is closed while the group code is a placeholder');

update public.app_config set value = 'TESTCODE' where key = 'group_code';

insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000d4', 'case@test.nl', '{"group_code":" testcode ","display_name":"Case"}');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d4'), 'Case',
  'group code ignores case and spaces');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-0000000000ff', 'x@test.nl', '{"group_code":"WRONG","display_name":"X"}')$$,
  'P0001', 'invalid group code', 'signup with wrong group code is rejected');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'anna@test.nl', '{"group_code":"TESTCODE","display_name":"Anna"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bram@test.nl', '{"group_code":"TESTCODE","display_name":"Bram"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'sjoerd@test.nl', '{"group_code":"TESTCODE","display_name":"Sjoerd"}');

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Anna',
  'profile created with display_name from metadata');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'member',
  'new users are members');
select isnt((select color from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  (select color from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
  'new users get distinct colours');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c3';
insert into public.locations (user_id, lat, lng, accuracy_m, updated_at)
  values ('00000000-0000-0000-0000-0000000000b2', 47.1, 13.1, 10, now());

create temp table ctx as
  select (select id from public.polls where day = '2027-03-01' and kind = 'early_ski') as poll,
         (select o.id from public.poll_options o join public.polls p on p.id = o.poll_id
           where p.day = '2027-03-01' and p.kind = 'early_ski' and o.label = 'Vroeg mee') as opt_early,
         (select o.id from public.poll_options o join public.polls p on p.id = o.poll_id
           where p.day = '2027-03-01' and p.kind = 'early_ski' and o.label = 'Uitslapen') as opt_late;
grant select on ctx to authenticated, anon;

-- As Anna (member) ----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$insert into public.locations (user_id, lat, lng, accuracy_m, updated_at)
    values ('00000000-0000-0000-0000-0000000000a1', 47.11, 13.13, 5, now())$$,
  'member can insert own location');
select is(
  pg_temp.affected($q$update public.locations set lat = 0 where user_id = '00000000-0000-0000-0000-0000000000b2'$q$), 0, 'member cannot update another user''s location');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'member cannot promote themselves');
select lives_ok(
  $$insert into public.votes (poll_id, user_id, option_id)
    select poll, '00000000-0000-0000-0000-0000000000a1', opt_early from ctx$$,
  'member can vote on undecided poll');
select throws_ok(
  $$select public.decide_poll((select poll from ctx), (select opt_early from ctx))$$,
  'P0001', 'admin only', 'member cannot decide a poll');
select is(
  pg_temp.affected($q$update public.house_info set markdown = 'hacked'$q$), 0,
  'member cannot edit house info');
select lives_ok(
  $$insert into public.drinks (kind) values ('beer_05')$$, 'member can log a drink');

-- As Sjoerd (admin) ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';

select lives_ok(
  $$select public.decide_poll((select poll from ctx), (select opt_early from ctx))$$, 'admin can decide a poll');
reset role;
select is((select decided_by from public.polls where id = (select poll from ctx)),
  '00000000-0000-0000-0000-0000000000c3'::uuid, 'decided_by is the admin');
set local role authenticated;
select is(
  pg_temp.affected($q$update public.house_info set markdown = 'nieuw' where section = 'algemeen'$q$), 1, 'admin can edit house info');
select is(
  pg_temp.affected($q$delete from public.drinks$q$), 0,
  'other user cannot delete someone else''s drink');

-- As Bram (member), after the decision ------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select throws_ok(
  $$insert into public.votes (poll_id, user_id, option_id)
    select poll, '00000000-0000-0000-0000-0000000000b2', opt_late from ctx$$,
  '42501', null, 'voting on a decided poll is rejected');

-- Back as Anna: own drink can be deleted --------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(
  pg_temp.affected($q$delete from public.drinks$q$), 1, 'member can delete own drink');
select is((select count(*)::int from public.app_config), 2, 'member can read app config');

select throws_ok(
  $$insert into public.places (name, kind, website, created_by) values ('Evil', 'dinner', 'javascript:alert(1)', '00000000-0000-0000-0000-0000000000a1')$$,
  '23514', null, 'links must be http(s)');

-- Anonymous ----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');
select is((select count(*)::int from public.polls), 0, 'anon sees no polls');

select * from finish();
rollback;
