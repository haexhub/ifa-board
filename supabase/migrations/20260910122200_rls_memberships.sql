-- ifa-board: RLS policies for memberships (T021)

create policy memberships_read_self_or_teamtrainer on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_trainer(team_id)
  );

create policy memberships_write_trainer on public.memberships
  for all to authenticated
  using (public.is_trainer(team_id))
  with check (public.is_trainer(team_id));

-- Bootstrap insert (team-creator's first Trainer membership) happens via
-- POST /api/teams/create with service role and is not policy-granted.
