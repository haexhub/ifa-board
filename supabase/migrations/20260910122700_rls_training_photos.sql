-- ifa-board: RLS policies for training_photos (T026)

create policy tp_read_member on public.training_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.trainings t
       where t.id = training_photos.training_id
         and public.is_member(t.team_id)
         and (t.status = 'saved' or public.is_trainer(t.team_id))
    )
  );

create policy tp_write_trainer on public.training_photos
  for all to authenticated
  using (
    exists (
      select 1 from public.trainings t
       where t.id = training_photos.training_id
         and public.is_trainer(t.team_id)
    )
  )
  with check (
    exists (
      select 1 from public.trainings t
       where t.id = training_photos.training_id
         and public.is_trainer(t.team_id)
    )
  );
