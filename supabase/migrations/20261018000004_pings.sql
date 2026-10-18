-- "Waar ben je?" pings, used to rate-limit one ping per sender→target per 5 minutes.
create table public.pings (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.pings (sender, target, created_at);
alter table public.pings enable row level security;
-- Written and read only by edge functions (service role).
