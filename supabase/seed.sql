-- Local development: let the database reach the local edge functions (production values are set at deploy).
insert into private.settings (key, value) values
  ('functions_url', 'http://supabase_kong_Bad_Gastein:8000/functions/v1'),
  ('hook_secret', 'local-hook-secret')
on conflict (key) do update set value = excluded.value;
