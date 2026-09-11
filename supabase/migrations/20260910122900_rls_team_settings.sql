-- ifa-board: RLS policies for team_settings (T028)

create policy ts_read_member on public.team_settings
  for select to authenticated
  using (public.is_member(team_id));

create policy ts_write_trainer on public.team_settings
  for update to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));
