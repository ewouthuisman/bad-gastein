-- Core schema for the Bad Gastein trip app.

create table public.app_config (
  key text primary key,
  value text not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  color text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  max_difficulty text not null default 'intermediate'
    check (max_difficulty in ('novice', 'easy', 'intermediate', 'advanced')),
  created_at timestamptz not null default now()
);

create table public.locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lat float8 not null,
  lng float8 not null,
  accuracy_m float8,
  updated_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('restaurant', 'apres', 'dinner', 'house', 'other')),
  lat float8,
  lng float8,
  osm_id text unique,
  menu_url text,
  menu_text text,
  website text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  kind text not null check (kind in ('lunch_place', 'apres_place', 'dinner_place', 'early_ski', 'lunch_time', 'apres_or_spa')),
  decided_option_id uuid,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (day, kind)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  place_id uuid references public.places (id) on delete cascade,
  value text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.polls
  add constraint polls_decided_option_fk foreign key (decided_option_id)
  references public.poll_options (id) on delete set null;

create table public.votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('beer_03', 'beer_05', 'jager', 'wine', 'shot', 'gluhwein')),
  created_at timestamptz not null default now()
);

create table public.bar_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.house_info (
  section text primary key,
  title text not null,
  markdown text not null,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.nav_overrides (
  id uuid primary key default gen_random_uuid(),
  op text not null check (op in ('add_edge', 'block_edge', 'set_attr', 'note')),
  payload jsonb not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.lift_status (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('lift', 'piste')),
  is_open boolean not null,
  updated_at timestamptz not null default now()
);

create table public.soipen_comments (
  scope text primary key, -- 'group' or a profile uuid
  text text not null,
  score int not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index on public.drinks (user_id, created_at);
create index on public.bar_visits (user_id, started_at);
create index on public.chat_messages (user_id, created_at);
create index on public.poll_options (poll_id);
