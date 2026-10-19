-- Ski start times: add 08:00 (first lift) and drop 10:30, in the defaults and on the existing ski_time polls.

create or replace function public.poll_defaults(p_kind text)
returns table (label text, value text)
language sql
immutable
set search_path = ''
as $$
  select d.label, d.value from (values
    ('ski_area', 'Stubnerkogel (Bad Gastein)', 'stubnerkogel'),
    ('ski_area', 'Graukogel (Bad Gastein)', 'graukogel'),
    ('ski_area', 'Gibfelbahn (Dorfgastein)', 'gibfelbahn'),
    ('ski_area', 'Goldbergbahn (Sportgastein)', 'goldbergbahn'),
    ('ski_time', '08:00 (1e lift)', '08:00'),
    ('ski_time', '08:30', '08:30'),
    ('ski_time', '09:00', '09:00'),
    ('ski_time', '09:30', '09:30'),
    ('ski_time', '10:00', '10:00'),
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

-- Votes on the removed option go with it (on delete cascade).
delete from public.poll_options o
using public.polls p
where o.poll_id = p.id and p.kind = 'ski_time' and o.value = '10:30';

insert into public.poll_options (poll_id, label, value)
select p.id, '08:00 (1e lift)', '08:00'
from public.polls p
where p.kind = 'ski_time'
  and not exists (select 1 from public.poll_options o where o.poll_id = p.id and o.value = '08:00');
