# Tasks: Veo-Kamera-Analytics

**Input**: Design documents from `/specs/003-veo-analytics/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rls-policies.md](./contracts/rls-policies.md), [quickstart.md](./quickstart.md)

**Tests**: Included. This project's constitution (Principle V, and the
existing `tests/unit/`/`tests/e2e/*-flow.spec.ts` convention) expects a
runnable check for every non-trivial change; this feature follows the same
shape as `specs/002-member-profile` (one `*-flow.spec.ts` per feature,
covering all its user stories as separate scenarios).

**Organization**: Tasks are grouped by user story (US1/US2/US3/US4, matching
spec.md's priorities) so each can be implemented, tested, and shipped
independently. **US4 note**: per `/speckit.clarify`, the *platform-admin UI*
for managing `veo_team_mappings` is explicitly out of scope for this
feature (separate, later "Platform-Administration" feature) — US4 here only
covers the security boundary (schema + RLS, already built in Foundational)
and the manual seed step that stands in for that UI until it exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unfinished dependency)
- **[Story]**: Maps the task to US1/US2/US3/US4 from spec.md
- File paths are exact, per [plan.md](./plan.md)'s Project Structure

---

## Phase 1: Setup

- [x] T001 [P] Document `NUXT_VEO_SYNC_SECRET` in `.env.example` (see [quickstart.md](./quickstart.md))

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + config every user story depends on. No user story can
be implemented or tested before this phase is done.

- [x] T002 Add `veoSyncSecret` to `runtimeConfig` in `nuxt.config.ts` (depends on T001)
- [x] T003 Add `veoTeamMappings`, `veoMatches`, `veoMatchStats`, `veoSyncStatus`, `veoSyncCredentials` table definitions to `db/schema/index.ts` exactly per [data-model.md](./data-model.md)
- [x] T004 Run `pnpm db:generate` to produce the Drizzle migration for the 5 new tables under `supabase/migrations/` (depends on T003)
- [x] T005 Hand-write the RLS migration `supabase/migrations/<ts>_veo_tables_rls.sql` per [contracts/rls-policies.md](./contracts/rls-policies.md) — enable RLS + enabled-mapping-gated `*_read_member` select policies on `veo_matches`/`veo_match_stats`/`veo_sync_status`; add explicit deny-all policies for `authenticated` on `veo_sync_credentials` and `veo_team_mappings` so every table has a policy while service_role remains the only application access (depends on T004)
- [x] T006 Run `pnpm gen:types` and commit the regenerated `app/types/database.ts` together with both migrations from T004/T005 (Principle V)

**Checkpoint**: Schema + config exist, including the `veo_team_mappings`
security boundary. All user stories below can now start.

---

## Phase 3: User Story 4 - Platform-Admin schaltet Veo-Zugriff für ein Team frei (Priority: P1)

**Goal**: No team has Veo data without an explicit, deliberate enablement
row in `veo_team_mappings`. For this feature, "explicit" means a manual,
documented DB action (see scope note above) — not a UI.

**Independent Test**: A team with no `veo_team_mappings` row sees no Veo
data or sync status on `/t/[slug]/analytics`, even if other teams do.

### Tests for User Story 4 ⚠️ write first, confirm they fail before implementing

- [x] T007 [P] [US4] Add a scenario to `tests/e2e/veo-analytics-flow.spec.ts`: seed `veo_matches` for team A but no `veo_team_mappings`/data for team B; assert team B's `/t/[slug]/analytics` shows an empty state, never team A's data

### Implementation for User Story 4

- [ ] T008 [US4] Per [quickstart.md](./quickstart.md)'s "Enabling a team for Veo sync": insert the real `veo_team_mappings` row for the club's configured team (manual SQL, ops step — not app code; tracked here so it isn't forgotten before anything else in this feature can produce real data)

**Checkpoint**: The security boundary is real and independently verified —
US1-US3 below can never accidentally expose a non-enabled team's data.

---

## Phase 4: User Story 1 - Team-Statistiken eines Spiels ansehen (Priority: P1) 🎯 MVP

**Goal**: Match results and per-category team stats for Veo-analyzed matches
appear automatically in Playerboard, with no manual entry.

**Independent Test**: Seed one synced match's rows directly in the DB (or
run `sync.post.ts` against real Veo credentials, after T008) and confirm
`/t/[slug]/analytics` shows its result and all stat categories, own vs.
opponent, per half.

### Tests for User Story 1 ⚠️ write first, confirm they fail before implementing

- [x] T009 [P] [US1] Save the real captured `POST .../analysis/stats/` response as fixture `tests/fixtures/veo/analysis-stats-response.json`
- [x] T010 [P] [US1] Unit tests for the mapping function in `tests/unit/veo-map-stats.spec.ts`: full fixture payload (T009) → expected `veo_match_stats` rows; a payload missing a category → no fabricated row for it; a malformed/unexpected payload shape → throws/rejects cleanly
- [x] T011 [P] [US1] E2E test in `tests/e2e/veo-analytics-flow.spec.ts`: seed `veo_matches`/`veo_match_stats` rows directly via the test DB, sign in, open `/t/[slug]/analytics`, assert the match card shows the result and every seeded stat category for own vs. opponent

### Implementation for User Story 1

- [x] T012 [P] [US1] Implement `app/server/utils/veo/mapStats.ts` — pure function mapping a `POST .../analysis/stats/` response to `veo_match_stats` row objects (depends on T003; makes T010 pass)
- [x] T013 [P] [US1] Implement `app/server/utils/veo/client.ts` — typed fetch wrappers for `GET app.veo.co/api/app/matches/` (filtered by club/team slug, `analytics_version=2`) and `POST app.veo.co/api/app/analysis/stats/` (`{type:"team_match", team_id, match_ids, group_by:"team_association"}`), both taking a bearer token
- [x] T014 [US1] Implement `app/server/utils/veo/auth.ts` — PKCE `code_verifier`/`code_challenge` generation, `GET auth.veo.co/oidc/auth?...&prompt=none` silent renewal, `POST auth.veo.co/oidc/token` exchange → short-lived bearer token; reads/writes `veo_sync_credentials` via `useAdminDb()` (depends on T002, T003-T006)
- [x] T015 [US1] Implement `app/server/api/veo/sync.post.ts`: reject unless `Authorization: Bearer` matches `runtimeConfig.veoSyncSecret`; load all `enabled` rows from `veo_team_mappings` via `useAdminDb()` and, for each, list matches (T013) using its `veo_club_slug`/`veo_team_slug`, skip any without completed Veo analysis (FR-007, no error), fetch + map stats (T012) for the rest, upsert `veo_matches`/`veo_match_stats` with `ON CONFLICT` per [data-model.md](./data-model.md)'s keys, then update that team's `veo_sync_status` (`last_attempt_at` always; `last_success_at`/reset `consecutive_failures` on success; increment `consecutive_failures` + set `last_error` on failure) (depends on T012, T013, T014)
- [x] T016 [P] [US1] Implement `app/composables/useVeoAnalytics.ts` — loads `veo_matches` + `veo_match_stats` for the current team via the plain (RLS-gated) Supabase browser client (depends on T003-T006)
- [x] T017 [P] [US1] Implement `app/components/veo/VeoMatchCard.vue` — result, opponent, and all stat categories for one match, own vs. opponent columns, per-half breakdown
- [x] T018 [US1] Implement `app/pages/t/[slug]/analytics.vue` — team-context middleware (no `trainer-only`), renders the match list via T016 + T017, with an empty state when there is no data (depends on T016, T017; makes T007 and T011 pass)

**Checkpoint**: User Story 1 fully functional and independently testable —
sync populates data, the page displays it.

---

## Phase 5: User Story 2 - Saison-Übersicht der Team-Statistiken ansehen (Priority: P2)

**Goal**: A season-level aggregation (W/D/L, category sums) over all
synced matches, on the same page as US1.

**Independent Test**: Seed 3+ matches with known scores/stats, open
`/t/[slug]/analytics`, verify the summary's W/D/L and sums exactly match a
manual sum of the seeded rows.

### Tests for User Story 2 ⚠️ write first, confirm they fail before implementing

- [x] T019 [P] [US2] Add a season-aggregation scenario to `tests/e2e/veo-analytics-flow.spec.ts`: seed 3+ matches with known scores/stats, assert the summary's W/D/L record and category sums equal the manually computed totals

### Implementation for User Story 2

- [x] T020 [US2] Extend `app/composables/useVeoAnalytics.ts` with a computed season aggregation (W/D/L record from `own_score`/`opponent_score`; per-category sums from `veo_match_stats`) over the already-loaded matches (depends on T016)
- [x] T021 [P] [US2] Implement `app/components/veo/VeoSeasonSummary.vue`
- [x] T022 [US2] Render `VeoSeasonSummary` on `app/pages/t/[slug]/analytics.vue` above the match list (depends on T020, T021; makes T019 pass)

**Checkpoint**: US1, US2, and US4 all independently functional.

---

## Phase 6: User Story 3 - Sync-Status ist für alle Mitglieder nachvollziehbar (Priority: P3)

**Goal**: Visible indicator of the last successful sync and of repeated
failures, so stale data is never silently trusted.

**Independent Test**: Seed a `veo_sync_status` row with
`consecutive_failures >= 3`, open `/t/[slug]/analytics`, verify a clear
failure hint renders; seed a healthy row instead, verify it shows the last
successful sync time.

### Tests for User Story 3 ⚠️ write first, confirm they fail before implementing

- [x] T023 [P] [US3] Add sync-status scenarios to `tests/e2e/veo-analytics-flow.spec.ts`: (a) seed a healthy `veo_sync_status` row → banner shows last-success time; (b) seed `consecutive_failures >= 3` → banner shows a clear failure hint

### Implementation for User Story 3

- [x] T024 [US3] Extend `app/composables/useVeoAnalytics.ts` to also load the team's `veo_sync_status` row (depends on T016)
- [x] T025 [P] [US3] Implement `app/components/veo/VeoSyncStatusBanner.vue`
- [x] T026 [US3] Render `VeoSyncStatusBanner` on `app/pages/t/[slug]/analytics.vue` (depends on T024, T025; makes T023 pass)

**Checkpoint**: All four user stories independently functional.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T027 [P] Run `pnpm lint` and `pnpm typecheck`; fix any violations across all files touched by this feature
- [ ] T028 One-time production step (not a code change, tracked here so it isn't forgotten): capture the real Veo session per [quickstart.md](./quickstart.md)'s "One-time credential capture" and insert the `veo_sync_credentials` row for the team enabled in T008 — `sync.post.ts` cannot do anything in production before this
- [ ] T029 One-time production step: add the crontab line from [quickstart.md](./quickstart.md)'s "Production scheduling" on the VPS

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — blocks every user story
- **User Story 4 (Phase 3)**: depends on Foundational only — the security boundary; cheap to do first
- **User Story 1 (Phase 4)**: depends on Foundational only for its own tests (T009-T011 seed data directly); T028 (real credentials) and a real T008 row are needed before it produces real data in production, but not before it can be built/tested
- **User Story 2 (Phase 5)**: depends on Foundational; reuses `useVeoAnalytics.ts` from US1 (T016) but adds no new table/route
- **User Story 3 (Phase 6)**: same relationship to US1 as US2 — reuses T016, no new table/route
- **Polish (Final Phase)**: after whichever user stories are in scope for the release

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task
- `mapStats`/`client`/`auth` (pure/isolated) before `sync.post.ts` (orchestrates them)
- Composable before the components/page that consume it

### Parallel Opportunities

- T007 (US4) can run in parallel with T009-T011 (US1 tests) once Phase 2 is done
- T012, T013 (US1 impl) in parallel; T014 needs T002+schema, T015 needs T012-T014
- T016, T017 (US1 impl) in parallel; T018 needs both
- T021 (US2) in parallel with T020
- T025 (US3) in parallel with T024

---

## Parallel Example: User Story 1

```bash
# Tests, once Phase 2 is done:
Task: "Save fixture in tests/fixtures/veo/analysis-stats-response.json"
Task: "Unit tests in tests/unit/veo-map-stats.spec.ts"
Task: "E2E test in tests/e2e/veo-analytics-flow.spec.ts"

# Implementation, independent files:
Task: "Implement app/server/utils/veo/mapStats.ts"
Task: "Implement app/server/utils/veo/client.ts"
```

---

## Implementation Strategy

### MVP First (User Story 4 + User Story 1)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002-T006) — **blocks everything below**
3. Phase 3: User Story 4 (T007-T008) — security boundary in place
4. Phase 4: User Story 1 (T009-T018)
5. **STOP and VALIDATE**: run T028/T029 (real credential + cron) against a
   real match, confirm `/t/[slug]/analytics` shows real data for the one
   enabled team and nothing for any other team
6. This alone is a deployable MVP — US2/US3 add to it without changing it

### Incremental Delivery

1. Setup + Foundational → schema ready
2. User Story 4 → security boundary validated independently
3. User Story 1 → validate independently → deployable MVP
4. User Story 2 → validate independently → season summary ships
5. User Story 3 → validate independently → sync health becomes visible
6. Polish (T027) at the end; T028/T029 whenever going to production

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- Every implementation task traces to a file path named in [plan.md](./plan.md)'s Project Structure
- Commit after each task or logical group, per this repo's normal workflow
- T008/T028/T029 are the only non-code tasks — deliberately kept in this list so they aren't forgotten before the feature can do anything in production
- The platform-admin UI for T008 (appointing admins, a settings screen instead of manual SQL) is explicitly out of scope here — tracked as a separate, later feature ("Platform-Administration") per spec.md's Assumptions
