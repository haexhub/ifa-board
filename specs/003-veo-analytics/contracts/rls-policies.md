# RLS Policies: Veo-Kamera-Analytics

Reuses the existing `public.is_member(team_id)` helper from
[001-points-and-photos/contracts/rls-policies.md](../../001-points-and-photos/contracts/rls-policies.md)
— no new SQL helper functions needed. No table below gets an
`is_trainer`-gated write policy: all four tables are written exclusively by
the sync route via `useAdminDb()` (server-trusted, bypasses RLS entirely),
never by an authenticated user. This mirrors the existing
`teams_insert_via_server` shape: the absence of any `authenticated` write
policy is itself the control, not an oversight.

## `veo_matches`, `veo_match_stats`

Both readable by any member of the team (trainer or player — match results
and team stats are not sensitive in the way point entries can be):

| Policy | Operation, Role | Using |
|---|---|---|
| `veo_matches_read_member` | select, `authenticated` | `public.is_member(team_id)` |
| `veo_match_stats_read_member` | select, `authenticated` | `public.is_member((select team_id from veo_matches where id = match_id))` |

No `insert`/`update`/`delete` policy for `authenticated` on either table —
only `service_role` (via `useAdminDb()`) writes.

## `veo_sync_status`

Readable by team members (powers the sync-status banner, User Story 3, for
both roles — not trainer-only, so any member can see the app is degraded):

| Policy | Operation, Role | Using |
|---|---|---|
| `veo_sync_status_read_member` | select, `authenticated` | `public.is_member(team_id)` |

No write policy for `authenticated` — only the sync route updates it.

## `veo_sync_credentials`

RLS enabled, **zero policies**. Not readable or writable by any
`authenticated` or `anon` role under any circumstance — only `service_role`
(via `useAdminDb()`, called exclusively from
`app/server/utils/veo/auth.ts`) can access it. This is the strictest
variant of the existing `service_role`-only-write shape: here even `select`
is service_role-only, since the row contains a live session credential, not
just system-managed display data.

## `veo_team_mappings`

RLS enabled, **zero policies** — same shape as `veo_sync_credentials`, for
the same reason: for this feature's own scope, only the sync route
(`useAdminDb()`) reads it, and only a human with direct DB access writes it
(see [research.md §5](../research.md#5-team-mapping-veo-team--playerboard-team)).
This is deliberately the enforcement point for FR-011 — a team with no row
here gets zero Veo data, regardless of what `veo_matches`/`veo_match_stats`
RLS would otherwise permit.

**Follow-up, out of scope for this feature**: once the separate
"Platform-Administration" feature adds a `platform_admins` table/role, it
will add an `authenticated`-scoped write policy here (`using`/`with check`
against that role) so its settings UI can manage this table through the app
instead of raw SQL. No other table in this contract needs to change when
that happens.

## `POST /api/veo/sync` caller authentication

Not a Postgres RLS concern, but the equivalent control at the route level:
the request must carry a bearer header matching
`runtimeConfig.veoSyncSecret` (`NUXT_VEO_SYNC_SECRET`), checked before any
DB or Veo call. See
[research.md §2](../research.md#2-authenticating-the-cron-caller).
