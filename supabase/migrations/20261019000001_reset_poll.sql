-- Admin-only: clear all votes and any decision of a poll; the options stay.
create or replace function public.reset_poll(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  delete from public.votes where poll_id = p_poll;
  update public.polls
  set decided_option_id = null, decided_by = null, decided_at = null
  where id = p_poll;
end;
$$;

revoke execute on function public.reset_poll(uuid) from public, anon;
grant execute on function public.reset_poll(uuid) to authenticated;
