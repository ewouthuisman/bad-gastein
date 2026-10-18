-- Row level security: the whole group reads almost everything, people write their own rows,
-- admins manage shared content. Service role (edge functions) bypasses RLS.

alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.places enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.drinks enable row level security;
alter table public.bar_visits enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.house_info enable row level security;
alter table public.nav_overrides enable row level security;
alter table public.lift_status enable row level security;
alter table public.soipen_comments enable row level security;
alter table public.chat_messages enable row level security;

-- app_config
create policy "group reads config" on public.app_config for select to authenticated using (true);
create policy "admins edit config" on public.app_config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: role can only change via SQL by the owner, never from the client.
create policy "group reads profiles" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name, color, max_difficulty) on public.profiles to authenticated;

-- locations
create policy "group reads locations" on public.locations for select to authenticated using (true);
create policy "own location insert" on public.locations for insert to authenticated with check (user_id = auth.uid());
create policy "own location update" on public.locations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- places
create policy "group reads places" on public.places for select to authenticated using (true);
create policy "anyone adds places" on public.places for insert to authenticated with check (created_by = auth.uid());
create policy "admins edit places" on public.places for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins delete places" on public.places for delete to authenticated using (public.is_admin());

-- polls: decisions go through decide_poll/undecide_poll.
create policy "group reads polls" on public.polls for select to authenticated using (true);
create policy "admins add polls" on public.polls for insert to authenticated with check (public.is_admin());
create policy "admins delete polls" on public.polls for delete to authenticated using (public.is_admin());

-- poll options
create policy "group reads options" on public.poll_options for select to authenticated using (true);
create policy "anyone proposes on open polls" on public.poll_options for insert to authenticated
  with check (created_by = auth.uid() and public.poll_is_open(poll_id));
create policy "admin or creator removes option" on public.poll_options for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.poll_is_open(poll_id)));

-- votes: only while the poll is undecided, and the option must belong to the poll.
create policy "group reads votes" on public.votes for select to authenticated using (true);
create policy "own vote insert" on public.votes for insert to authenticated
  with check (
    user_id = auth.uid() and public.poll_is_open(poll_id)
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = votes.poll_id)
  );
create policy "own vote update" on public.votes for update to authenticated
  using (user_id = auth.uid() and public.poll_is_open(poll_id))
  with check (
    user_id = auth.uid() and public.poll_is_open(poll_id)
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = votes.poll_id)
  );
create policy "own vote delete" on public.votes for delete to authenticated
  using (user_id = auth.uid() and public.poll_is_open(poll_id));

-- drinks
create policy "group reads drinks" on public.drinks for select to authenticated using (true);
create policy "own drink insert" on public.drinks for insert to authenticated with check (user_id = auth.uid());
create policy "own drink delete" on public.drinks for delete to authenticated using (user_id = auth.uid());

-- bar visits
create policy "group reads bar visits" on public.bar_visits for select to authenticated using (true);
create policy "own visit insert" on public.bar_visits for insert to authenticated with check (user_id = auth.uid());
create policy "own visit update" on public.bar_visits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push subscriptions: private
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- house info
create policy "group reads house" on public.house_info for select to authenticated using (true);
create policy "admins edit house" on public.house_info for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins add house" on public.house_info for insert to authenticated with check (public.is_admin());

-- navigation overrides
create policy "group reads overrides" on public.nav_overrides for select to authenticated using (true);
create policy "admins add overrides" on public.nav_overrides for insert to authenticated with check (public.is_admin());
create policy "admins delete overrides" on public.nav_overrides for delete to authenticated using (public.is_admin());

-- server-written tables
create policy "group reads lift status" on public.lift_status for select to authenticated using (true);
create policy "group reads soipen" on public.soipen_comments for select to authenticated using (true);

-- chat: private per person; assistant replies are written by the edge function.
create policy "own chat read" on public.chat_messages for select to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table
  public.locations, public.votes, public.poll_options, public.polls,
  public.drinks, public.soipen_comments, public.lift_status, public.profiles;
