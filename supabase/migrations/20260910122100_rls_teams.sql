-- ifa-board: RLS policies for teams (T020)

create policy teams_read_membership on public.teams
  for select to authenticated
  using (public.is_member(id));

create policy teams_update_trainer on public.teams
  for update to authenticated
  using (public.is_trainer(id))
  with check (public.is_trainer(id));

-- Inserts happen through /api/teams/create (service role) — no client-side policy.
