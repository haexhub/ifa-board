-- ifa-board: private storage bucket + RLS policies for member avatars
-- (Mitglieder-Profilseite). Path convention: <user_id>/<uuid>.<ext> —
-- (storage.foldername(name))[1] is the owning user's id.
--
-- Reads never go through this policy in normal app use — the app streams
-- avatars via GET /api/profile/avatar/:user_id (service_role, rechecks
-- session + is_profile_visible per request) rather than handing out a
-- bearer signed URL. This select policy is kept anyway as a defense-in-
-- depth backstop, matching the read boundary that route enforces.

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read_team on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_profile_visible(((storage.foldername(name))[1])::uuid)
  );

create policy avatars_write_self on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
