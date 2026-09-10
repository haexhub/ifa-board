-- ifa-board: RLS policies for point_categories (T024)

create policy pc_read_member on public.point_categories
  for select to authenticated
  using (public.is_member(team_id));

create policy pc_write_trainer on public.point_categories
  for all to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));
