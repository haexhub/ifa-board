-- Allow a user with a pending invitation to read the (minimal) team row so
-- the onboarding page can show the team name they were invited to. RLS on
-- `teams` otherwise limits reads to team members.

create or replace function public.has_pending_invitation(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.invitations i
     where i.team_id = p_team
       and i.accepted_at is null
       and lower(i.email) = lower(coalesce(
             auth.jwt() ->> 'email',
             (auth.jwt() -> 'user_metadata' ->> 'email')
           ))
  );
$$;

revoke all on function public.has_pending_invitation(uuid)
  from public, anon, service_role;
grant execute on function public.has_pending_invitation(uuid) to authenticated;

comment on function public.has_pending_invitation(uuid) is
  'True if the caller has an outstanding (not yet accepted) invitation to the team.';

drop policy if exists teams_read_membership on public.teams;
create policy teams_read_membership on public.teams
  for select
  to authenticated
  using (public.is_member(id) or public.has_pending_invitation(id));
