-- Align Veo reads with the explicit team mapping and keep service-role-only
-- tables covered by the project's policy-per-table invariant.

create or replace function public.is_veo_enabled(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.veo_team_mappings
      where public.veo_team_mappings.team_id = p_team
        and public.veo_team_mappings.enabled
  );
$$;

revoke all on function public.is_veo_enabled(uuid) from public, anon, service_role;
grant execute on function public.is_veo_enabled(uuid) to authenticated;

comment on function public.is_veo_enabled(uuid) is
  'RLS helper: is Veo explicitly enabled for the given team?';

drop policy if exists veo_matches_read_member on public.veo_matches;
create policy veo_matches_read_member on public.veo_matches
  for select to authenticated
  using (public.is_member(team_id) and public.is_veo_enabled(team_id));

drop policy if exists veo_match_stats_read_member on public.veo_match_stats;
create policy veo_match_stats_read_member on public.veo_match_stats
  for select to authenticated
  using (
    public.is_member(
      (select team_id from public.veo_matches where id = match_id)
    )
    and public.is_veo_enabled(
      (select team_id from public.veo_matches where id = match_id)
    )
  );

drop policy if exists veo_sync_status_read_member on public.veo_sync_status;
create policy veo_sync_status_read_member on public.veo_sync_status
  for select to authenticated
  using (public.is_member(team_id) and public.is_veo_enabled(team_id));

create policy veo_team_mappings_deny_authenticated on public.veo_team_mappings
  for all to authenticated
  using (false)
  with check (false);

create policy veo_sync_credentials_deny_authenticated on public.veo_sync_credentials
  for all to authenticated
  using (false)
  with check (false);
