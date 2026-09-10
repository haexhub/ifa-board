---

description: "Task list for Trainingspunkte & Trainingsfotos (feature 001-points-and-photos)"
---

# Tasks: Trainingspunkte & Trainingsfotos

**Input**: Design documents from `/specs/001-points-and-photos/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Tests are included where the plan and constitution explicitly
require them — namely: E2E per user story, the RLS negative-test matrix
(SC-003), and unit tests for the ranking helpers and validators. Broader
component tests are omitted for v1 to stay YAGNI.

**Organization**: Tasks are grouped by user story so each story can be
implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1..US6 for user-story phases; setup / foundational / polish carry no story label
- Include exact file paths in each description

## Path Conventions

Single Nuxt project (see plan.md → Project Structure). Frontend lives
under `app/`; database migrations under `supabase/`; tests under
`tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Nuxt + Supabase project and tooling.

- [ ] T001 Initialize pnpm workspace at repo root with `pnpm init`, set `packageManager: pnpm@9.x` and `engines.node: ">=22 <23"` in `package.json`
- [ ] T002 Scaffold Nuxt 3 project structure (`nuxt.config.ts`, `tsconfig.json`, `app/`, `.gitignore`) with `pnpm dlx nuxi@latest init` into repo root
- [ ] T003 [P] Add dev dependencies to `package.json`: `nuxt`, `@nuxtjs/supabase`, `@nuxtjs/tailwindcss`, `@vueuse/core`, `zod`, `@unovis/vue`, `@unovis/ts`, `@supabase/supabase-js`
- [ ] T004 [P] Add dev tooling to `package.json`: `typescript`, `vitest`, `@nuxt/test-utils`, `@playwright/test`, `eslint`, `prettier`, `supabase`
- [ ] T005 Configure `nuxt.config.ts`: enable `@nuxtjs/supabase` and `@nuxtjs/tailwindcss` modules; set `typescript.strict = true` and `typescript.typeCheck = true`; set `ssr: true`; add `supabase.redirectOptions` for `/login` and `/public/**` exclusion
- [ ] T006 [P] Initialize Tailwind CSS mobile-first config in `tailwind.config.ts` (default breakpoints, `content` scanning `app/**/*.{vue,ts}`); add `app/assets/css/main.css` with Tailwind base directives; wire it into `nuxt.config.ts`
- [ ] T007 [P] Install and initialize shadcn-vue via `pnpm dlx shadcn-vue@latest init`, choose New York style, TypeScript, `app/components/ui` as component location; commit `components.json`
- [ ] T008 [P] Configure ESLint + Prettier in `.eslintrc.cjs` and `.prettierrc` using Nuxt's recommended config; add `pnpm lint` and `pnpm format` scripts to `package.json`
- [ ] T009 Initialize local Supabase in `supabase/` via `supabase init`; commit generated `supabase/config.toml`
- [ ] T010 [P] Add `.env.example` at repo root with `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_SUPABASE_SERVICE_ROLE_KEY` placeholders and comments
- [ ] T011 [P] Add pnpm scripts to `package.json`: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test:unit` (`vitest run`), `test:e2e` (`playwright test`), `gen:types` (`supabase gen types typescript --local > app/types/database.ts`), `db:reset` (`supabase db reset`)
- [ ] T012 [P] Configure Playwright in `playwright.config.ts` with `webServer` running `pnpm dev` and using `http://localhost:3000` as `baseURL`
- [ ] T013 [P] Configure Vitest in `vitest.config.ts` with `@nuxt/test-utils/config` and `environment: 'jsdom'`
- [ ] T014 Add `.gitignore` entries for `.env`, `.output/`, `.nuxt/`, `node_modules/`, `dist/`, `playwright-report/`, `.supabase/`

**Checkpoint**: `pnpm dev` boots an empty Nuxt page; `supabase start` boots the local stack.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, RLS policies, seed, auth wiring — every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database schema and constraints

- [ ] T015 Create migration `supabase/migrations/20260910120000_init_schema.sql` with tables `user_profiles`, `players`, `point_categories`, `trainings`, `training_photos`, `point_entries`, `settings` per [data-model.md](./data-model.md); include all columns, PKs, FKs, `check` constraints, defaults, and the `players_active_jersey_uniq` partial unique index
- [ ] T016 Create migration `supabase/migrations/20260910120500_triggers.sql` with functions and triggers: `set_last_updated_at()` (`before update`), `enforce_point_entry_range()` (`before insert or update on point_entries`), `enforce_training_has_photo()` (`before update on trainings` guarding `status='saved'`), and audit trigger `set_updated_by()` on all mutable tables
- [ ] T017 Create migration `supabase/migrations/20260910121000_current_role.sql` with helper `public.current_role() returns text language sql stable` (definition per [contracts/rls-policies.md](./contracts/rls-policies.md))

### RLS policies

- [ ] T018 Create migration `supabase/migrations/20260910121500_rls_enable.sql` that runs `alter table … enable row level security;` for all 7 tables
- [ ] T019 [P] Create migration `supabase/migrations/20260910122000_rls_user_profiles.sql` with policies `up_self_read`, `up_trainer_read_all`, `up_trainer_write` from [contracts/rls-policies.md](./contracts/rls-policies.md)
- [ ] T020 [P] Create migration `supabase/migrations/20260910122100_rls_players.sql` with policies `players_read_authenticated`, `players_write_trainer`
- [ ] T021 [P] Create migration `supabase/migrations/20260910122200_rls_categories.sql` with policies `pc_read_authenticated`, `pc_write_trainer`
- [ ] T022 [P] Create migration `supabase/migrations/20260910122300_rls_trainings.sql` with policies `tr_read_authenticated_saved`, `tr_write_trainer`
- [ ] T023 [P] Create migration `supabase/migrations/20260910122400_rls_training_photos.sql` with policies `tp_read_authenticated`, `tp_write_trainer`
- [ ] T024 [P] Create migration `supabase/migrations/20260910122500_rls_point_entries.sql` with policies `pe_read_authenticated`, `pe_write_trainer`
- [ ] T025 [P] Create migration `supabase/migrations/20260910122600_rls_settings.sql` with policies `s_read_authenticated`, `s_write_trainer`

### Storage bucket

- [ ] T026 Create migration `supabase/migrations/20260910123000_storage_photos.sql` that inserts bucket `training-photos` (private) and adds `tphoto_read_auth`, `tphoto_insert_trainer`, `tphoto_delete_trainer` policies on `storage.objects`

### Seed and types

- [ ] T027 Create `supabase/seed.sql` inserting the singleton `settings` row (id=1, `season_start`) and the default `point_categories` row (`Trainingsleistung`, 0..5, active, sort_order=1)
- [ ] T028 Run `pnpm db:reset` then `pnpm gen:types` and commit the generated `app/types/database.ts`

### App-level auth and layout scaffolding

- [ ] T029 Add `app/middleware/auth.global.ts` — redirects unauthenticated to `/login?redirect=<path>` for everything except `/public/**` and `/login`, per [contracts/ui-flows.md](./contracts/ui-flows.md)
- [ ] T030 [P] Add `app/middleware/trainer-only.ts` — reads role from `user_profiles`, redirects non-trainers to `/dashboard`
- [ ] T031 [P] Add `app/layouts/default.vue` (authenticated shell with nav) and `app/layouts/public.vue` (bare shell for `/public/**`)
- [ ] T032 [P] Add `app/composables/useTeamSession.ts` — returns `{ user, role, isTrainer, isPlayer }` derived from `useSupabaseUser` and the `user_profiles` row
- [ ] T033 [P] Add `app/pages/login.vue` — Supabase email/password form + "Zur öffentlichen Rangliste" link
- [ ] T034 [P] Add `app/pages/index.vue` — role-aware redirect (trainer → `/trainings`, player → `/dashboard`)

**Checkpoint**: Migrations apply cleanly, RLS is on, seed inserts default category, login works, empty shell renders.

---

## Phase 3: User Story 1 — Trainer erfasst Punkte + Foto (Priority: P1) 🎯 MVP

**Goal**: A trainer creates a training, enters point values for all active players across active categories, uploads at least one photo, and saves. The training and its entries persist and are visible in the trainings list.

**Independent Test**: With seed data (1 category, seeded trainer), the trainer signs in, creates a training, enters values for all active players (initially none — trainer creates 3 test players via SQL), uploads a photo, saves, and sees the training in `/trainings`.

### Tests for User Story 1

- [ ] T035 [P] [US1] Playwright test `tests/e2e/trainer-flow.spec.ts` — full US1 acceptance scenario (create training, fill grid, upload photo, save, verify visible in list)

### Implementation for User Story 1

- [ ] T036 [P] [US1] Composable `app/composables/usePlayers.ts` with `listActive()` returning active players ordered by `jersey_number nulls last, name`
- [ ] T037 [P] [US1] Composable `app/composables/useCategories.ts` with `listActive()` returning active categories ordered by `sort_order`
- [ ] T038 [P] [US1] Composable `app/composables/useTrainings.ts` with `createDraft(date, title, note)`, `updateEntry({trainingId, playerId, categoryId, value})`, `save(trainingId)`, `list()`, `get(id)`
- [ ] T039 [US1] Composable `app/composables/useTrainingPhotos.ts` with `upload(trainingId, file)` (validates MIME + size against FR-042/043 client-side then uploads to `training-photos` bucket) and `list(trainingId)` returning signed URLs (600s TTL)
- [ ] T040 [P] [US1] Component `app/components/trainings/TrainingPointGrid.vue` — sticky-header table, rows=players, cols=categories, `input type="number"` with `min/max` from category, auto-save on blur; ≥44px min-height per row on mobile
- [ ] T041 [P] [US1] Component `app/components/trainings/TrainingPhotoUpload.vue` — multi-file picker, per-file progress + error, calls `useTrainingPhotos.upload`
- [ ] T042 [P] [US1] Component `app/components/trainings/ConsentWarningBanner.vue` — takes an array of active players, shows a red shadcn `Alert` listing those with `photo_consent = false`
- [ ] T043 [US1] Page `app/pages/trainings/new.vue` — creates a draft on mount, renders `TrainingPointGrid` + `TrainingPhotoUpload` + `ConsentWarningBanner`, "Speichern" button disabled until ≥1 photo uploaded, on click transitions status to `saved` and navigates to `/trainings/:id`
- [ ] T044 [US1] Page `app/pages/trainings/[id].vue` — loads training, entries, photos; trainer sees the same editor as `new.vue`, player sees read-only summary; shows `last_updated_by`/`last_updated_at` per acceptance scenario 2
- [ ] T045 [US1] Page `app/pages/trainings/index.vue` — chronological list of saved trainings; trainer sees drafts too; each row links to `/trainings/:id`
- [ ] T046 [P] [US1] Unit test `tests/unit/validators.spec.ts` — zod schemas for point value (range from category), photo file (MIME whitelist FR-043, size ≤10 MB FR-042), and date (no future) all return correct errors on invalid input

**Checkpoint**: User Story 1 is complete — the MVP loop is closed. Points and photos land in the DB via the UI.

---

## Phase 4: User Story 2 — Spieler sieht Rangliste + eigenen Zeitverlauf (Priority: P1)

**Goal**: A player signs in and sees the team ranking over the default timeframe and a per-category chart of their own progress with team-average and team-median comparison lines.

**Independent Test**: With saved trainings and point_entries from US1 (or seeded), a player-role account sees a numeric rank on `/dashboard` and reaches `/players/:me` where the chart renders.

### Migrations for User Story 2

- [ ] T047 [US2] Create migration `supabase/migrations/20260911100000_ranking_fns.sql` defining `public.get_team_ranking(p_from date, p_to date) returns jsonb` (implements lexicographic sort per FR-051 using `dense_rank()`) and `public.get_player_scores_by_category(p_player uuid, p_from date, p_to date) returns table(...)`; `grant execute` to `authenticated`
- [ ] T048 [US2] Regenerate types with `pnpm gen:types` and commit updated `app/types/database.ts`

### Tests for User Story 2

- [ ] T049 [P] [US2] Playwright test `tests/e2e/player-flow.spec.ts` — sign in as player, `/dashboard` shows rank, `/players/:me` chart contains at least one data point per category
- [ ] T050 [P] [US2] Unit test `tests/unit/ranking.spec.ts` — golden-master SQL test that seeds fixed entries and asserts `get_team_ranking` produces the expected ordering including tie handling (1, 2, 2, 4)

### Implementation for User Story 2

- [ ] T051 [P] [US2] Composable `app/composables/useRanking.ts` — wraps `supabase.rpc('get_team_ranking', {p_from, p_to})`
- [ ] T052 [P] [US2] Composable `app/composables/usePlayerScores.ts` — wraps `get_player_scores_by_category`; adds derived team average / median per category over the same timeframe
- [ ] T053 [P] [US2] Composable `app/composables/useTimeframe.ts` — returns `{from, to, preset, setPreset, setCustom}` with presets `last-4-weeks | season | custom`; persists last preset in `localStorage`
- [ ] T054 [P] [US2] Component `app/components/stats/TimeframePicker.vue` — shadcn `Select` + optional date inputs for custom range
- [ ] T055 [P] [US2] Component `app/components/stats/RankingTable.vue` — renders `useRanking` output as a shadcn `Table`
- [ ] T056 [US2] Component `app/components/stats/PlayerProgressChart.vue` — one Unovis line chart per active category, with the player's series + team-average + team-median dashed lines
- [ ] T057 [US2] Page `app/pages/dashboard.vue` — shows player's own rank, top-3, timeframe picker, CTA to `/players/:me`
- [ ] T058 [US2] Page `app/pages/players/[id].vue` — renders `PlayerProgressChart` and player basic info
- [ ] T059 [US2] Page `app/pages/ranking/index.vue` — full team ranking (authenticated view, with names)

**Checkpoint**: User Story 2 complete. Players have a usable dashboard and a chart of their own progression.

---

## Phase 5: User Story 3 — Trainer verwaltet Punktekategorien (Priority: P2)

**Goal**: A trainer creates a new category (e.g. "Fairness", 0..5), the category appears as an additional column in the next training. Deactivating a category removes it from new-training forms but keeps it in historical trainings.

**Independent Test**: Trainer opens `/categories`, creates "Fairness" 0..5 sort 2, then opens `/trainings/new` and sees "Fairness" as a second column.

### Tests for User Story 3

- [ ] T060 [P] [US3] Playwright test `tests/e2e/categories-flow.spec.ts` — create, rename, reorder, deactivate; verify effect on `/trainings/new`

### Implementation for User Story 3

- [ ] T061 [US3] Extend `app/composables/useCategories.ts` with `create`, `update`, `deactivate`, `reorder(sortOrders: {id: string; sort_order: number}[])`
- [ ] T062 [P] [US3] Component `app/components/categories/CategoryForm.vue` — zod-validated form for name, `value_min`, `value_max`, `sort_order`, `active`
- [ ] T063 [P] [US3] Component `app/components/categories/CategoryList.vue` — sortable list with up/down buttons (mobile-friendly, no drag), "Deaktivieren" action; hides delete action when the category has any `point_entries` (checked via a `count(*)` query on load)
- [ ] T064 [US3] Page `app/pages/categories/index.vue` — trainer-only (uses `middleware/trainer-only`), renders `CategoryList` + "Neue Kategorie" dialog with `CategoryForm`

**Checkpoint**: US3 complete. Categories are trainer-configurable at runtime.

---

## Phase 6: User Story 4 — Trainer verwaltet Spielerstamm (Priority: P2)

**Goal**: A trainer creates players, edits them, toggles `active` and `photo_consent`, and can send an email invitation to link a player to an auth account.

**Independent Test**: Trainer opens `/players`, adds a player, toggles consent, invites the player, and the invited player later signs in via magic link and sees personalized data.

### Tests for User Story 4

- [ ] T065 [P] [US4] Playwright test `tests/e2e/players-flow.spec.ts` — CRUD + toggle consent; validates unique-active-jersey constraint (creating a second active player with the same number errors)

### Implementation for User Story 4

- [ ] T066 [US4] Extend `app/composables/usePlayers.ts` with `list()`, `create`, `update`, `setActive`, `setConsent`
- [ ] T067 [US4] Server route `app/server/api/players/[id]/invite.post.ts` — reads `NUXT_SUPABASE_SERVICE_ROLE_KEY`, calls `supabase.auth.admin.inviteUserByEmail`, then `insert into user_profiles(id, role, display_name) values (…, 'player', …)` and `update players set linked_user_id = … where id = :id`
- [ ] T068 [P] [US4] Component `app/components/players/PlayerForm.vue` — zod-validated (name, jersey, position, consent, active)
- [ ] T069 [P] [US4] Component `app/components/players/PlayerList.vue` — shadcn `Table` with edit / deactivate / invite actions per row; consent toggle inline
- [ ] T070 [US4] Page `app/pages/players/index.vue` — trainer-only, renders `PlayerList` + "Neuer Spieler" dialog with `PlayerForm`

**Checkpoint**: US4 complete. Kader can be managed end-to-end.

---

## Phase 7: User Story 5 — Anonyme Public-Rangliste (Priority: P3)

**Goal**: An unauthenticated visitor opens `/public/ranking` and sees the ranking by jersey number with per-category totals. No PII leaves the DB.

**Independent Test**: Log out (or use a private window). Open `/public/ranking`. Rank + jersey number + per-category sums render. Direct attempts to hit `point_entries` or Storage as anon are denied.

### Migrations for User Story 5

- [ ] T071 [US5] Create migration `supabase/migrations/20260912100000_public_ranking.sql` defining `public.get_public_ranking(p_from date, p_to date) returns jsonb` per [contracts/public-ranking.md](./contracts/public-ranking.md); `grant execute … to anon, authenticated`
- [ ] T072 [US5] Regenerate types with `pnpm gen:types` and commit updated `app/types/database.ts`

### Tests for User Story 5

- [ ] T073 [P] [US5] Playwright test `tests/e2e/public-anon.spec.ts` — visit `/public/ranking` without a session, assert rank + jersey + score columns; then try direct `from('point_entries').select()` as anon via `supabase-js` and expect empty result / error

### Implementation for User Story 5

- [ ] T074 [P] [US5] Composable `app/composables/usePublicRanking.ts` — calls `supabase.rpc('get_public_ranking', {p_from, p_to})` using the anon client (no session)
- [ ] T075 [US5] Page `app/pages/public/ranking.vue` — uses `layouts/public.vue`, renders `RankingTable` variant with jersey-only display, `TimeframePicker` bound to `usePublicRanking`

**Checkpoint**: US5 complete. Public view accessible; PII stays private.

---

## Phase 8: User Story 6 — Trainingsfoto-Galerie (Priority: P3)

**Goal**: Any authenticated user opens a training and sees the photo gallery; consent-flagged photos are hidden or blurred for player role; anonymous access to files is denied.

**Independent Test**: Player opens `/trainings/:id`, sees a scrollable mobile-friendly gallery; a training that references any active no-consent player shows the "Foto ausgeblendet — fehlende Einwilligung" placeholder for the player role.

### Tests for User Story 6

- [ ] T076 [P] [US6] Playwright test `tests/e2e/photos-flow.spec.ts` — player views a saved training with photos: consent-clean training renders photos, consent-blocked training renders the placeholder

### Implementation for User Story 6

- [ ] T077 [P] [US6] Extend `app/composables/useTrainingPhotos.ts` with `deriveConsentStatus(trainingId)` — returns `'clean' | 'blocked'` by checking whether any current active player has `photo_consent = false`
- [ ] T078 [US6] Component `app/components/trainings/TrainingPhotoGallery.vue` — mobile-scroll (`overflow-x: auto`) grid; renders `TrainingPhotoPlaceholder` when `role='player'` and consent is `blocked`
- [ ] T079 [US6] Wire `TrainingPhotoGallery` into `app/pages/trainings/[id].vue` below the summary

**Checkpoint**: US6 complete. Photos are visible to authenticated users under the consent rule.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Deliver the security guarantee (SC-003, SC-008), the perf targets (SC-001, SC-002), deployment readiness, and documentation.

- [ ] T080 [P] Playwright RLS negative-test suite `tests/e2e/rls-negative.spec.ts` implementing all 10 rows N1..N10 from [contracts/rls-policies.md](./contracts/rls-policies.md); delivers SC-003 and SC-008
- [ ] T081 [P] Manual perf verification: on a throttled 4G mobile emulation, time the US1 flow end-to-end (15 players × 2 categories + photo) and confirm ≤2 min (SC-001); time player dashboard load ≤5 s (SC-002); record numbers in `specs/001-points-and-photos/perf-notes.md`
- [ ] T082 [P] Add `vercel.json` at repo root with Nuxt preset and env-var declarations (`NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_SUPABASE_SERVICE_ROLE_KEY`)
- [ ] T083 [P] Add `README.md` at repo root with a 20-line "How to run" summary linking to `specs/001-points-and-photos/quickstart.md`
- [ ] T084 [P] Add CI config `.github/workflows/ci.yml` running `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e` against a Supabase local stack booted in the job
- [ ] T085 Update constitution `.specify/memory/constitution.md`: close `TODO(DEPLOYMENT_TARGET)` with "Vercel + Supabase Cloud" per research R10; bump version to `1.0.1` (PATCH) with a fresh Sync Impact Report

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; starts immediately.
- **Foundational (Phase 2)**: depends on Setup completion; BLOCKS all user-story phases.
- **User Stories (Phases 3–8)**: all start after Foundational completes.
  - US1 (P1) is the MVP scope.
  - US2 (P1) depends only on Foundational + `get_team_ranking` migration (T047); it can start in parallel with US1 as soon as T047 lands.
  - US3, US4, US5, US6 depend only on Foundational and can proceed independently.
- **Polish (Phase 9)**: after the desired user stories are complete.

### User-story dependencies

- **US1 → nobody**. First to deliver value.
- **US2 → US1** in practice (needs saved trainings/entries to display) but not by build order — US2 can build against seeded data.
- **US3 / US4 → Foundational only.**
- **US5 → Foundational only.** Deliver last of the P3s because it's most visible.
- **US6 → US1** (needs photos to exist) but its own code path is independent.

### Within each user story

- Migrations before composables; composables before components; components before pages.
- Playwright/unit tests can be authored in parallel with implementation, but MUST be passing before the phase is called done.
- Commit after each logical group.

### Parallel opportunities

- All setup tasks marked [P] (T003, T004, T006, T007, T008, T010–T013) run in parallel.
- RLS migration files T019–T025 are independent files → parallel.
- Composables and components within a story are usually independent files → parallel.
- Tests within a story are independent files → parallel.
- Different user stories can be worked on by different contributors in parallel once Foundational completes.

---

## Parallel Example: User Story 1

```bash
# After T035 (test authored), launch these in parallel:
Task: "T036 composable app/composables/usePlayers.ts"
Task: "T037 composable app/composables/useCategories.ts"
Task: "T038 composable app/composables/useTrainings.ts"
Task: "T040 component app/components/trainings/TrainingPointGrid.vue"
Task: "T041 component app/components/trainings/TrainingPhotoUpload.vue"
Task: "T042 component app/components/trainings/ConsentWarningBanner.vue"
Task: "T046 unit test tests/unit/validators.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run T035 + manually walk the US1 acceptance scenarios.
5. Deploy to a Vercel preview if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test → deploy preview → **MVP**.
3. US2 → test → deploy preview → app becomes useful to players.
4. US3 + US4 → in parallel, test → deploy.
5. US5 + US6 → in parallel, test → deploy.
6. Polish (Phase 9) → production release.

### Parallel Team Strategy

With multiple contributors:

1. All: Setup + Foundational.
2. Once T047 lands: Dev A on US1, Dev B on US2, Dev C on US3+US4.
3. After US1 saved-training row is real: Dev D picks up US6.
4. US5 in parallel with anything.

---

## Notes

- [P] = different files, no incomplete dependency.
- [US#] labels bind tasks to acceptance scenarios in spec.md.
- Tests included only where they deliver a Success Criterion or an
  acceptance scenario — no broad component-test suite in v1.
- Commit after each logical group (typically each task) so a rollback
  never crosses story boundaries.
- Every schema change (T015, T016, T017, T027, T047, T071) MUST be
  paired with a `pnpm gen:types` commit before the next story task
  proceeds (Constitution Principle V).
