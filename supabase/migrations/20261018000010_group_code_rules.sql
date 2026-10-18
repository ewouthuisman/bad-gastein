-- Group code: ignore case and surrounding spaces (phone keyboards capitalise), and keep signup
-- closed until an admin has set a real code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
  palette text[] := array['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#cc5de8',
                          '#ff922b', '#20c997', '#f06595', '#94d82d', '#845ef7'];
  chosen text;
begin
  select lower(trim(value)) into expected from public.app_config where key = 'group_code';
  if expected is null or expected = '' or expected = '[placeholder]'
     or lower(trim(coalesce(new.raw_user_meta_data ->> 'group_code', ''))) <> expected then
    raise exception 'invalid group code';
  end if;

  select c into chosen
  from unnest(palette) with ordinality as p(c, i)
  where c not in (select color from public.profiles)
  order by i
  limit 1;

  insert into public.profiles (id, display_name, color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    coalesce(chosen, palette[1])
  );
  return new;
end;
$$;
