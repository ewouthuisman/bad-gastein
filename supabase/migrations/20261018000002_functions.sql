-- Helper functions, signup trigger and admin-only poll decisions.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Fixed palette so ten people get distinguishable map dots.
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
  select value into expected from public.app_config where key = 'group_code';
  if expected is null or coalesce(new.raw_user_meta_data ->> 'group_code', '') <> expected then
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.decide_poll(p_poll uuid, p_option uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then
    raise exception 'option does not belong to poll';
  end if;
  update public.polls
  set decided_option_id = p_option, decided_by = auth.uid(), decided_at = now()
  where id = p_poll;
end;
$$;

create or replace function public.undecide_poll(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.polls
  set decided_option_id = null, decided_by = null, decided_at = null
  where id = p_poll;
end;
$$;

create or replace function public.poll_is_open(p_poll uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.polls where id = p_poll and decided_option_id is null);
$$;

revoke execute on function public.decide_poll(uuid, uuid) from anon;
revoke execute on function public.undecide_poll(uuid) from anon;
