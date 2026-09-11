-- ifa-board: RLS policies for invitations (T022)

create policy invitations_read_team_trainer on public.invitations
  for select to authenticated
  using (public.is_trainer(team_id));

create policy invitations_read_own_email on public.invitations
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy invitations_write_trainer on public.invitations
  for all to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));

-- Accept-own-email: allow invitee to set accepted_at on their own row.
create policy invitations_accept_own_email on public.invitations
  for update to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    and accepted_at is null
    and expires_at > now()
  )
  with check (
    lower(email) = lower(auth.jwt() ->> 'email')
  );
