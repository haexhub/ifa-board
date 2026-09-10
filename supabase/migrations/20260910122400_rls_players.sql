-- ifa-board: RLS policies for players (T023)

create policy players_read_member on public.players
  for select to authenticated
  using (public.is_member(team_id));

create policy players_write_trainer on public.players
  for all to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));
