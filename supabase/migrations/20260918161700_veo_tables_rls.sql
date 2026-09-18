-- ifa-board: RLS for Veo-Kamera-Analytics (specs/003-veo-analytics).
-- veo_matches/veo_match_stats/veo_sync_status: readable by team members,
-- writable only by service_role (no authenticated write policy at all —
-- same shape as teams_insert_via_server). veo_team_mappings/
-- veo_sync_credentials: RLS enabled with zero policies — unreachable by
-- any authenticated/anon role, only service_role via useAdminDb().

alter table public.veo_matches enable row level security;
alter table public.veo_match_stats enable row level security;
alter table public.veo_sync_status enable row level security;
alter table public.veo_team_mappings enable row level security;
alter table public.veo_sync_credentials enable row level security;

create policy veo_matches_read_member on public.veo_matches
  for select to authenticated
  using (public.is_member(team_id));

create policy veo_match_stats_read_member on public.veo_match_stats
  for select to authenticated
  using (
    public.is_member(
      (select team_id from public.veo_matches where id = match_id)
    )
  );

create policy veo_sync_status_read_member on public.veo_sync_status
  for select to authenticated
  using (public.is_member(team_id));

-- veo_team_mappings, veo_sync_credentials: intentionally no policies at
-- all. This is the enforcement point for "no team sees Veo data without
-- explicit enablement" (FR-011) and for never exposing the Veo session
-- credential to any client.
