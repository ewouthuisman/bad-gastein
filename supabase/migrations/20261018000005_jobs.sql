-- Server-side settings (function URL, hook secret) live in a private schema clients cannot read.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  key text primary key,
  value text not null
);

create or replace function private.call_function(fn text, body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := (select value from private.settings where key = 'functions_url');
  secret text := (select value from private.settings where key = 'hook_secret');
begin
  if base is null or secret is null then
    return; -- not configured (e.g. in tests)
  end if;
  perform net.http_post(
    url := base || '/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret),
    body := body
  );
end;
$$;

create or replace function private.on_poll_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.decided_option_id is not null and new.decided_option_id is distinct from old.decided_option_id then
    perform private.call_function('notify-decision', jsonb_build_object('pollId', new.id));
  end if;
  return new;
end;
$$;

create trigger poll_decided
  after update of decided_option_id on public.polls
  for each row execute function private.on_poll_decided();

select cron.schedule('vote-reminder', '*/15 * * * *', $$ select private.call_function('vote-reminder') $$);
