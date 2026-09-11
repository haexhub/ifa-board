-- ifa-board: RLS policies for point_entries (T027)

create policy pe_read_member on public.point_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.trainings t
       where t.id = point_entries.training_id
         and public.is_member(t.team_id)
         and (t.status = 'saved' or public.is_trainer(t.team_id))
    )
  );

create policy pe_write_trainer on public.point_entries
  for all to authenticated
  using (
    exists (
      select 1 from public.trainings t
       where t.id = point_entries.training_id
         and public.is_trainer(t.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.trainings t
       where t.id = point_entries.training_id
         and public.is_trainer(t.team_id)
    )
  );
