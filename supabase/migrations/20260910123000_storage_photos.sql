-- ifa-board: private storage bucket + RLS policies (T029)

insert into storage.buckets (id, name, public, file_size_limit)
values ('training-photos', 'training-photos', false, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Path convention: <team_id>/<training_id>/<uuid>.<ext>
-- (storage.foldername(name))[1] returns the first path segment.

create policy tphoto_read_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'training-photos'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1
        from public.trainings t
       where t.id = ((storage.foldername(name))[2])::uuid
         and t.team_id = ((storage.foldername(name))[1])::uuid
         and (t.status = 'saved' or public.is_trainer(t.team_id))
    )
  );

create policy tphoto_write_trainer on storage.objects
  for all to authenticated
  using (
    bucket_id = 'training-photos'
    and public.is_trainer(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'training-photos'
    and public.is_trainer(((storage.foldername(name))[1])::uuid)
  );
