-- ifa-board: members may edit their own display name and avatar path
-- (Mitglieder-Profilseite, US1-US3). `avatar_path` must stay null or point
-- into the caller's own storage prefix — otherwise a member could point
-- their own profile row at someone else's avatar object.

create policy user_profiles_update_self on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      avatar_path is null
      or avatar_path like (auth.uid()::text || '/%')
    )
  );
