-- Planning rework: skiing becomes "which mountain" (decided) + "what time" (personal choice),
-- quiet days lose their lunch/après/dinner polls, and reset_poll restores the default options.

alter table public.polls drop constraint polls_kind_check;
-- early_ski is replaced by ski_area + ski_time.
delete from public.polls where kind = 'early_ski';
alter table public.polls add constraint polls_kind_check
  check (kind in ('lunch_place', 'apres_place', 'dinner_place', 'lunch_time', 'apres_or_spa', 'ski_area', 'ski_time'));

-- Sun 28 Feb: no lunch on the mountain. Sat 6 Mar: no lunch, après-ski or dinner.
delete from public.polls where day = '2027-02-28' and kind in ('lunch_place', 'lunch_time');
delete from public.polls where day = '2027-03-06'
  and kind in ('lunch_place', 'lunch_time', 'apres_place', 'apres_or_spa', 'dinner_place');

-- Default options per poll kind; what reset_poll puts back.
create or replace function public.poll_defaults(p_kind text)
returns table (label text, value text)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('ski_area', 'Stubnerkogel (Bad Gastein)', 'stubnerkogel'),
    ('ski_area', 'Graukogel (Bad Gastein)', 'graukogel'),
    ('ski_area', 'Gibfelbahn (Dorfgastein)', 'gibfelbahn'),
    ('ski_area', 'Goldbergbahn (Sportgastein)', 'goldbergbahn'),
    ('ski_time', '08:30', '08:30'),
    ('ski_time', '09:00', '09:00'),
    ('ski_time', '09:30', '09:30'),
    ('ski_time', '10:00', '10:00'),
    ('ski_time', '10:30', '10:30'),
    ('lunch_time', '11:30', '11:30'),
    ('lunch_time', '12:00', '12:00'),
    ('lunch_time', '12:30', '12:30'),
    ('lunch_time', '13:00', '13:00'),
    ('lunch_time', '13:30', '13:30'),
    ('apres_or_spa', 'Après-ski', 'apres'),
    ('apres_or_spa', 'Spa/zwembad', 'spa'),
    ('dinner_place', 'Thuis koken', 'home')
  ) as d(kind, label, value)
  where d.kind = p_kind;
$$;

-- Ski polls for the five ski days.
insert into public.polls (day, kind)
select d::date, k
from generate_series('2027-03-01'::date, '2027-03-05'::date, interval '1 day') as d,
     unnest(array['ski_area', 'ski_time']) as k
on conflict (day, kind) do nothing;

insert into public.poll_options (poll_id, label, value)
select p.id, d.label, d.value
from public.polls p, lateral public.poll_defaults(p.kind) d
where p.kind in ('ski_area', 'ski_time');

-- Admin-only: clear votes and the decision, and restore exactly the default options.
create or replace function public.reset_poll(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select kind into v_kind from public.polls where id = p_poll;
  update public.polls set decided_option_id = null, decided_by = null, decided_at = null where id = p_poll;
  delete from public.votes where poll_id = p_poll;
  delete from public.poll_options where poll_id = p_poll;
  insert into public.poll_options (poll_id, label, value)
  select p_poll, d.label, d.value from public.poll_defaults(v_kind) d;
end;
$$;

revoke execute on function public.reset_poll(uuid) from public, anon;
grant execute on function public.reset_poll(uuid) to authenticated;
