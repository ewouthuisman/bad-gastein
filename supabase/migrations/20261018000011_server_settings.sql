-- Edge functions read server-only settings (VAPID keys, hook secret, optional AI keys) from
-- private.settings when they are not set as function secrets. Only the service role may call this.
create or replace function public.server_setting(k text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.settings where key = k;
$$;
revoke execute on function public.server_setting(text) from public, anon, authenticated;
grant execute on function public.server_setting(text) to service_role;

-- Link our house row to the OSM building so the map shows one house marker, not two.
update public.places set osm_id = 'way/170929640' where kind = 'house' and osm_id is null;
