# Implementation Plan: Veo-Kamera-Analytics

**Branch**: `003-veo-analytics` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-veo-analytics/spec.md`

## Summary

Automatically pull match results and team statistics for an explicitly
enabled team from the club's Veo camera account and display them in
Playerboard — per match (own vs. opponent, per half) and aggregated as a
season overview — without any manual data entry. Veo exposes no usable
public API (its documented partner API is invite-only); this uses the
private, undocumented API that already powers Veo's own web app,
authenticated via a one-time interactive login whose session is then
silently renewed by a new daily server-side sync route. Credentials never
touch `.env`/the repo; they live in a `service_role`-only Postgres table,
mirroring this project's existing RLS trust boundaries. Which team is
enabled is itself an explicit, admin-controlled decision (`veo_team_mappings`,
also `service_role`-only for v1) — no team gets Veo data by default. The
full admin role/UI for managing that (appointing further admins, a settings
screen) is a separate, later feature ("Platform-Administration"); this
feature ships the enforcement point (the table + RLS boundary) and seeds
its one row manually, without waiting for that feature.

## Technical Context

**Language/Version**: TypeScript 5.6+, strict mode; Node.js 22 LTS — same stack, no new runtime.
**Primary Dependencies**: Nuxt 3, `@nuxtjs/supabase`, `drizzle-orm` + `drizzle-kit`, `zod` — all already in use. No new npm dependency: the OIDC/PKCE flow and REST calls use native `fetch`/`crypto`, no headless-browser dependency for v1 (see [research.md §3](./research.md#3-veo-authentication-strategy)).
**Storage**: PostgreSQL (Supabase-managed); five new tables — `veo_team_mappings`, `veo_matches`, `veo_match_stats`, `veo_sync_status`, `veo_sync_credentials` (see [data-model.md](./data-model.md)).
**Testing**: Vitest for the pure Veo-payload → schema mapping function (fixture-based, no live Veo call); Playwright e2e for the display pages and sync-status banner, seeded directly via DB (see [research.md §8](./research.md#8-testing-strategy-for-the-external-integration)).
**Target Platform**: Existing web app, plus one new server-triggered route invoked by an OS-level cron entry on the production VPS (no new deployment target).
**Project Type**: Web application — extends the existing single Nuxt project.
**Performance Goals**: Daily batch sync completes well within its interval; no live-fetch latency on page view since data is pre-stored. No new performance targets beyond the existing app's.
**Constraints**: RLS mandatory (Principle II) on all four new tables. No Veo credentials in `.env`/repo (explicit decision, see [research.md §4](./research.md#4-credential-storage)). The data source is an undocumented, unsupported private API — sync MUST fail closed (never fabricate data, FR-007) and MUST surface staleness within a day (FR-009/SC-003).
**Scale/Scope**: One team, ~20–60 matches/season, ~28 stat rows/match — negligible data volume.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.1.0 ([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)).

| Principle | Gate | Status |
|---|---|---|
| **I. Simplicity First** (NON-NEGOTIABLE) | No new abstraction/service without present-day need; reuse existing patterns. | ✅ Pass. No new dependency, no new deployment target (rejected Supabase Edge Functions and an in-process scheduler in favor of plain OS cron + a Nitro route — [research.md §1](./research.md#1-where-does-the-periodic-sync-run)); team mapping moved from fixed config to a table only because an explicit clarified requirement (admin-controlled enablement) needs it — the admin *UI* for it is explicitly deferred to a later feature rather than built here ([research.md §5](./research.md#5-team-mapping-veo-team--playerboard-team)); season totals are computed on read, not a precomputed table ([research.md §6](./research.md#6-season-aggregation-user-story-2)); the privileged-route shape (`useAdminDb()`, service_role-only writes) is reused as-is from `app/server/api/invitations/issue.post.ts` / `app/server/api/profile/moderate.post.ts`. |
| **II. Role-Based Access via Supabase RLS** (NON-NEGOTIABLE) | Every table + at least one policy; cross-boundary access denied by policy, not app logic. | ✅ Pass. `veo_matches`/`veo_match_stats`/`veo_sync_status` get an `is_member`-gated read policy and no write policy for `authenticated` (only `service_role` writes, same shape as `teams_insert_via_server`); `veo_sync_credentials` and `veo_team_mappings` get RLS enabled with **zero** policies — unreachable by any user-facing role at all, which is the actual enforcement of "no team sees Veo data without explicit enablement" (FR-011). See [contracts/rls-policies.md](./contracts/rls-policies.md). |
| **III. Konfigurierbare Punktekategorien** | N/A — feature does not touch point categories. | ✅ N/A |
| **IV. Mobile-First UX** | New page usable on ≥360px portrait; ≥44px touch targets. | ✅ Pass. New `/t/[slug]/analytics` page reuses existing layout/typography and touch-target utility classes already used across `/t/[slug]/**`; match cards stack vertically on narrow screens like existing list views (e.g. `players/index.vue`). |
| **V. Type Safety End-to-End** | Schema change → regenerate + commit Supabase types. | ✅ Pass. Four tables added via Drizzle + `pnpm gen:types`, same as every prior schema change in this project. |

**No violations. Complexity Tracking section intentionally empty.**

## Project Structure

### Documentation (this feature)

```text
specs/003-veo-analytics/
├── plan.md                  # This file
├── spec.md                  # Feature specification (with Clarifications)
├── research.md              # Phase 0 output — technical decisions
├── data-model.md            # Phase 1 output — schema, RLS summary
├── quickstart.md            # Phase 1 output — env vars, local-dev delta, cron setup
├── contracts/
│   └── rls-policies.md      # New policies for this feature's 5 tables
├── checklists/
│   └── requirements.md
└── tasks.md                 # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root, delta only — rest of the app is unchanged)

```text
app/
├── pages/t/[slug]/
│   └── analytics.vue                 # US1+US2: match list + season summary; team-context middleware only, no trainer-only restriction
├── components/veo/
│   ├── VeoMatchCard.vue              # one match: score, stat categories own vs. opponent, per-half breakdown
│   ├── VeoSeasonSummary.vue          # aggregated W/D/L + category sums across synced matches
│   └── VeoSyncStatusBanner.vue       # US3: last successful sync / failure indicator
├── composables/
│   └── useVeoAnalytics.ts            # reads veo_matches/veo_match_stats/veo_sync_status for the current team via the plain (RLS-gated) Supabase browser client
└── server/
    ├── api/veo/
    │   └── sync.post.ts              # shared-secret auth → for each enabled row in veo_team_mappings: refresh Veo session → fetch matches+stats → upsert → update veo_sync_status
    └── utils/veo/
        ├── auth.ts                   # PKCE + auth.veo.co silent-renewal (prompt=none); reads/writes veo_sync_credentials via useAdminDb
        ├── client.ts                 # typed fetch wrappers for GET .../matches/ and POST .../analysis/stats/
        └── mapStats.ts                # pure function: Veo analysis/stats payload → veo_match_stats rows (unit-tested)

db/schema/index.ts                     # + veoTeamMappings, veoMatches, veoMatchStats, veoSyncStatus, veoSyncCredentials

supabase/migrations/
├── <ts>_veo_tables.sql                    # drizzle-generated: create the 5 tables
└── <ts>_veo_tables_rls.sql                # hand-written: RLS enable + read policies (service_role writes only)

nuxt.config.ts                         # + runtimeConfig.veoSyncSecret only — no team/club config here anymore, that lives in veo_team_mappings

tests/fixtures/veo/
└── analysis-stats-response.json       # real captured payload shape, used by the unit test below

tests/unit/
└── veo-map-stats.spec.ts              # mapStats.ts: full payload, missing-category, malformed-input cases

tests/e2e/
└── veo-analytics-flow.spec.ts         # seeds veo_matches/veo_match_stats/veo_sync_status directly, verifies analytics page + sync-status banner (no live Veo call)
```

**Structure Decision**: Extends the existing single Nuxt project — no new
project, no new service, no new deployment target. Read access
(`useVeoAnalytics.ts`, the new page/components) goes straight through the
plain Supabase browser client, gated by RLS, exactly like every other
team-scoped read in this app. The one privileged path — the sync itself —
gets its own narrow server route, mirroring the existing
`app/server/api/invitations/` / `app/server/api/profile/moderate.post.ts`
shape, with the caller-authentication adapted for a machine (shared secret)
instead of a logged-in trainer, since nothing triggers this route
interactively.

## Complexity Tracking

*None. All gates pass.*
