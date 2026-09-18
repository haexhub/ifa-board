# Phase 1 Data Model: Veo-Kamera-Analytics

Four new tables, following this repo's existing Drizzle conventions (uuid or
natural-key PK per shape, `team_id` FK + index on team-scoped tables,
`timestamp with time zone` columns). None of these tables are ever written
by an authenticated user — only by the sync route via `useAdminDb()` — so
none carry `created_by`/`last_updated_by` audit columns (there is no human
author to record).

## `veo_team_mappings`

One row per Playerboard team explicitly enabled for Veo sync (User Story 4 /
FR-011). Absence of a row for a team means that team has no Veo access at
all — this is the enforcement point for "no team sees Veo data without
explicit enablement." See
[research.md §5](./research.md#5-team-mapping-veo-team--playerboard-team)
for why this is a table now (not `runtimeConfig`) and for the v1 sequencing
(row created manually via SQL, not through a UI, until the separate
"Platform-Administration" feature adds one).

| Column | Type | Notes |
|---|---|---|
| `team_id` | `uuid` PK, FK → `teams.id`, `on delete cascade` | the Playerboard team being granted access |
| `veo_club_slug` | `text`, not null | e.g. `tsv-ifa-chemnitz` |
| `veo_team_slug` | `text`, not null | e.g. `c-junioren-cec9ec43` |
| `enabled` | `boolean`, not null, `default true` | the sync route skips disabled rows entirely, but keeps them (vs. deleting) so re-enabling doesn't require re-typing the slugs |
| `created_at` | `timestamptz`, `defaultNow()` | |
| `updated_at` | `timestamptz`, `defaultNow()` | |

**RLS**: enabled, **zero** policies — same shape as `veo_sync_credentials`.
Nothing in this feature's own UI reads or writes this table; only the sync
route (`useAdminDb()`) reads it, and only a human with direct DB access
writes it, for now.

## `veo_matches`

One row per Veo match synced for the team.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `defaultRandom()` | |
| `team_id` | `uuid` FK → `teams.id`, `on delete cascade`, indexed | fixed to the single configured team for v1 |
| `veo_match_id` | `text`, **unique** | Veo's own match identifier (e.g. `e7730b08-...`) — the idempotency key |
| `played_at` | `timestamptz`, not null | match kickoff time, from Veo |
| `opponent_name` | `text`, not null | |
| `own_score` | `integer`, nullable | null if Veo has no result yet |
| `opponent_score` | `integer`, nullable | |
| `home_or_away` | `text`, `check in ('home','away')` | |
| `created_at` | `timestamptz`, `defaultNow()` | first synced |
| `last_synced_at` | `timestamptz`, `defaultNow()` | updated on every upsert |

**Validation**: `own_score`/`opponent_score` are either both present or both
null (a match without a finished/analyzed result is stored with no score,
per FR-007 — it is not fabricated).

## `veo_match_stats`

One row per match × team-association × stat type — the per-category values
shown in User Story 1 (attacking/set-pieces/discipline/defending/
goalkeeping categories: goals, shots, corners, free kicks, fouls, tackles,
dribbles, interceptions, saves, ...).

| Column | Type | Notes |
|---|---|---|
| `match_id` | `uuid` FK → `veo_matches.id`, `on delete cascade` | part of PK |
| `team_association` | `text`, `check in ('own','opponent')` | part of PK |
| `stat_type` | `text` | Veo's own type key, e.g. `football_goal_total`, `football_corner_total`; part of PK |
| `category` | `text`, not null | Veo's category grouping, e.g. `attacking`, `set_pieces`, `discipline`, `defending`, `goalkeeping` |
| `value` | `integer`, not null | total for the match |
| `period_values` | `jsonb`, not null | `[{ "period": 1, "value": 0 }, { "period": 2, "value": 2 }]` — half-by-half breakdown, stored as-is from Veo |
| `created_at` | `timestamptz`, `defaultNow()` | |

**Primary key**: `(match_id, team_association, stat_type)` — enforces
FR-008 (no duplicates on repeated sync) at the schema level; upsert via
`ON CONFLICT (match_id, team_association, stat_type) DO UPDATE`.

**Validation**: only `stat_type`s Veo actually returned for that match are
stored — no row is fabricated for a missing category (per the Edge Cases
section of the spec).

## `veo_sync_status`

One row per team (natural key, no surrogate id — same shape as
`memberships`/`team_settings`). Powers User Story 3 / SC-003.

| Column | Type | Notes |
|---|---|---|
| `team_id` | `uuid` PK, FK → `teams.id`, `on delete cascade` | |
| `last_attempt_at` | `timestamptz`, nullable | set at the start of every sync run |
| `last_success_at` | `timestamptz`, nullable | set only when a run completes without error |
| `consecutive_failures` | `integer`, not null, `default 0` | reset to 0 on success, incremented on failure |
| `last_error` | `text`, nullable | short message from the most recent failed run, for the admin-visible hint |
| `updated_at` | `timestamptz`, `defaultNow()` | |

**State transitions**: `last_attempt_at` is always updated first (before any
Veo call), so a run that crashes mid-way still shows as "attempted"; on
success, `last_success_at := now()`, `consecutive_failures := 0`,
`last_error := null`; on any handled failure,
`consecutive_failures := consecutive_failures + 1`,
`last_error := <message>`. `last_success_at` is left untouched on failure —
User Story 3's "last successful sync" must never regress.

## `veo_sync_credentials`

One row per team, holding the captured Veo session artifact needed for
silent auth renewal (see [research.md](./research.md) §3–4). **RLS enabled,
zero policies** — unreachable by any `authenticated`/`anon` client, only by
`useAdminDb()`.

| Column | Type | Notes |
|---|---|---|
| `team_id` | `uuid` PK, FK → `teams.id`, `on delete cascade` | |
| `session_cookie` | `text`, not null | the `auth.veo.co` session artifact captured during one-time interactive login |
| `captured_at` | `timestamptz`, not null | when the session artifact was (re)captured |
| `updated_at` | `timestamptz`, `defaultNow()` | |

**Note**: never selected by any client-facing code path; only referenced
from `app/server/utils/veo/auth.ts` inside the sync route.

## Relationships

```
teams (existing) 1──1 veo_team_mappings
teams (existing) 1──* veo_matches 1──* veo_match_stats
teams (existing) 1──1 veo_sync_status
teams (existing) 1──1 veo_sync_credentials
```

No relationship to `players`/`memberships` — this feature is team-level
only (Player-level stats are explicitly out of scope, FR-012). No
relationship to a `platform_admins` table — that table doesn't exist yet;
it belongs to the separate "Platform-Administration" feature.
