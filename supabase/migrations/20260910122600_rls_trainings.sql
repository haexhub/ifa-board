-- ifa-board: RLS policies for trainings (T025)

create policy tr_read_member_saved on public.trainings
  for select to authenticated
  using (
    public.is_member(team_id)
    and (status = 'saved' or public.is_trainer(team_id))
  );

create policy tr_write_trainer on public.trainings
  for all to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));
