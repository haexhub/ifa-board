---

description: "Task list for Mitglieder-Profilseite"
---

# Tasks: Mitglieder-Profilseite

**Input**: Design documents from `/specs/002-member-profile/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rls-policies.md](./contracts/rls-policies.md), [quickstart.md](./quickstart.md)

**Tests**: Included, following this project's established practice (every prior feature in this repo shipped with Playwright coverage per user story) — one shared spec file, one `test()` per story.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1..US4 for user-story phases; foundational/polish carry no story label
- Include exact file paths in each description

## Path Conventions

Single Nuxt project (existing). Frontend under `app/`; schema under `db/schema/`; migrations under `supabase/migrations/`; tests under `tests/`.

**No Setup phase**: this feature adds to the existing stack (Nuxt, Supabase, Drizzle, Vitest, Playwright already installed and configured) — nothing new to initialize.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Schema column, RLS, storage bucket, and the shared profile page/composable skeleton every user story builds on. Blocks all user stories.

- [ ] T001 Add `avatarPath` column (nullable `text`) and a `user_profiles_display_name_len_check` check constraint that requires at least two visible characters (ignoring zero-width format characters) to the `userProfiles` table in `db/schema/index.ts`, per [data-model.md](./data-model.md)
- [ ] T002 Run `pnpm db:generate` to produce the Drizzle migration for T001's column + constraint
- [ ] T003 [P] Hand-written migration `supabase/migrations/<ts>_user_profiles_update_self_rls.sql` — `user_profiles_update_self` policy (`auth.uid() = id`, both `using` and `with check`) per [contracts/rls-policies.md](./contracts/rls-policies.md)
- [ ] T004 [P] Hand-written migration `supabase/migrations/<ts>_avatars_bucket.sql` — private `avatars` bucket (10 MB limit, `PHOTO_MIME_TYPES`) with `avatars_read_team` and `avatars_write_self` policies per [contracts/rls-policies.md](./contracts/rls-policies.md)
- [ ] T005 Run `pnpm db:reset` to apply T002–T004 locally, then `pnpm gen:types` to regenerate `app/types/database.ts`
- [ ] T006 [P] Add `displayNameSchema` to `app/utils/validators.ts` — normalize and remove zero-width/default-ignorable characters, then require at least two visible characters; add a unit test for two zero-width spaces
- [ ] T007 Create `app/composables/useProfile.ts` with `getOwnProfile()` — reads the caller's own `user_profiles` row and returns `{ display_name, avatar_path, avatar_url }`, setting `avatar_url` to the authenticated `/api/profile/avatar/:user_id` endpoint when `avatar_path` is set
- [ ] T008 Create `app/pages/profile.vue` page skeleton — no `team-context` middleware (profile is account-level, not team-scoped), renders the current name/avatar via `useProfile().getOwnProfile()`

**Checkpoint**: `/profile` loads and shows the current (email-derived) name and no-avatar placeholder for a fresh account. No editing yet.

---

## Phase 2: User Story 1 - Mitglied passt seinen Anzeigenamen an (Priority: P1) 🎯 MVP

**Goal**: A member can view and change their own display name from `/profile`, and it shows up wherever they were already visible (e.g. team members list).

**Independent Test**: Sign in, open `/profile`, change the name, verify the team members list shows the new name.

### Implementation for User Story 1

- [ ] T009 [US1] Add `updateDisplayName(name)` to `app/composables/useProfile.ts` — validates via `displayNameSchema` (T006), then `update` via the browser Supabase client (gated by `user_profiles_update_self`, T003); maps the length-check-constraint violation and the zod failure to the same friendly "mind. 2 Zeichen" message
- [ ] T010 [US1] Create `app/components/profile/ProfileForm.vue` — name input (prefilled from `getOwnProfile()`) + save button + inline error, following the existing form conventions (`min-h-touch`, error `<span>` under the field, same as `PlayerForm.vue`)
- [ ] T011 [US1] Wire `ProfileForm.vue` into `app/pages/profile.vue`

### Tests for User Story 1

- [ ] T012 [US1] Create `tests/e2e/profile-flow.spec.ts` with the US1 case: sign in, open `/profile`, change the name, assert it appears on `/t/[slug]/team/members`; also assert saving an empty/1-character name is rejected and the previous name is retained (spec Acceptance Scenario 4)
- [ ] T013 [P] [US1] Add a unit test for `displayNameSchema` in `tests/unit/validators.spec.ts` (accepts 2+ trimmed chars, rejects empty/whitespace/1 char)

**Checkpoint**: US1 fully functional and testable independently — this alone already delivers the "Namen anpassen" half of the original request.

---

## Phase 3: User Story 2 - Mitglied lädt ein Avatar-Bild hoch (Priority: P1)

**Goal**: A member can upload a photo as their avatar; it replaces any previous one and shows up wherever they were already visible.

**Independent Test**: Upload an image on `/profile`, see it immediately on the profile page and on the team members list.

### Implementation for User Story 2

- [ ] T014 [US2] Add `uploadAvatar(file)` to `app/composables/useProfile.ts` — validates the file against `PHOTO_MIME_TYPES`/`PHOTO_MAX_BYTES` (`app/utils/validators.ts`, same limits as training photos), uploads to `avatars/<uid>/<uuid>.<ext>`, updates `avatar_path`, and only then removes the previous object; if the database update fails, remove the new object and preserve the previous avatar, while treating already-missing cleanup objects as successful retries
- [ ] T015 [US2] Add the avatar upload control to `app/components/profile/ProfileForm.vue` — file input + picker button, reusing the picker/queue pattern from `app/components/trainings/TrainingPhotoUpload.vue`; show the current avatar (or placeholder) via `avatar_url`

### Tests for User Story 2

- [ ] T016 [US2] Add the US2 case to `tests/e2e/profile-flow.spec.ts`: upload a 1×1 PNG, assert it renders on `/profile` and on `/t/[slug]/team/members`; assert an oversized/unsupported file is rejected with an inline error and the previous avatar is untouched

**Checkpoint**: US1 + US2 together deliver the full original request ("Avatar setzen und Namen anpassen").

---

## Phase 4: User Story 3 - Mitglied entfernt seinen Avatar (Priority: P2)

**Goal**: A member can remove their avatar and see the placeholder again everywhere.

**Independent Test**: With an avatar set, remove it on `/profile`, confirm the placeholder shows immediately.

### Implementation for User Story 3

- [ ] T017 [US3] Add `removeAvatar()` to `app/composables/useProfile.ts` — set `avatar_path` to `null` first, then delete the old storage object; if the database update fails, leave the object and reference intact, and treat an already-deleted object as a successful idempotent retry
- [ ] T018 [US3] Add an "Avatar entfernen" button to `app/components/profile/ProfileForm.vue`, shown only when an avatar is currently set

### Tests for User Story 3

- [ ] T019 [US3] Add the US3 case to `tests/e2e/profile-flow.spec.ts`: remove a previously uploaded avatar, assert the placeholder shows on `/profile` and on `/t/[slug]/team/members`

**Checkpoint**: US1–US3 (full self-service loop) work independently of US4.

---

## Phase 5: User Story 4 - Trainer setzt ein unangemessenes Avatar oder einen unangemessenen Namen zurück (Priority: P3)

**Goal**: A trainer can reset a teammate's avatar and/or display name back to the default.

**Independent Test**: As a trainer, open the team members page, reset a member's avatar/name, confirm it reverts for that member.

### Implementation for User Story 4

- [ ] T020 [US4] Create `app/server/api/profile/moderate.post.ts` — validates `{ target_user_id, team_id, field }`; authorizes via Drizzle (`memberships` row for caller with `role = 'trainer'` on `team_id`, AND a `memberships` row for `target_user_id` on the same `team_id`), else `403`; for `field: 'name'` resets `display_name` to the email-derived default via `serverSupabaseServiceRole().auth.admin.getUserById` + Drizzle update; for `field: 'avatar'` sets `avatar_path = null` before removing the storage object, treats an already-missing object as a successful retry, and retries cleanup without restoring a deleted reference; no-op (not an error) when there's nothing to reset — per [contracts/rls-policies.md](./contracts/rls-policies.md)
- [ ] T021 [US4] Add `moderateProfile({ target_user_id, team_id, field })` to `app/composables/useProfile.ts`, calling the T020 route
- [ ] T022 [US4] Add "Avatar zurücksetzen" / "Namen zurücksetzen" row actions to `app/components/team/MembershipTable.vue`, visible only to trainers, calling T021 and refreshing the row on success

### Tests for User Story 4

- [ ] T023 [US4] Add the US4 cases to `tests/e2e/profile-flow.spec.ts`: trainer resets a teammate's avatar and name from `/t/[slug]/team/members`, both revert; a player-role account attempting the same request gets `403`; a trainer of an unrelated team targeting this member gets `403` (contracts negative-test matrix N1/N2)

**Checkpoint**: All four user stories independently functional.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Run `pnpm typecheck` — clean, no `any` introduced
- [ ] T025 [P] Run `pnpm test:unit` and the full `pnpm test:e2e` (or targeted `profile-flow.spec.ts` + existing suites) to confirm no regressions
- [ ] T026 Walk through [quickstart.md](./quickstart.md)'s manual smoke-test steps once against the local dev server

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS every user story (schema column, RLS, bucket, and the shared page/composable file must exist first).
- **User Story 1 (Phase 2)**: Depends on Foundational only.
- **User Story 2 (Phase 3)**: Depends on Foundational only — independent of US1, but both edit `ProfileForm.vue`/`useProfile.ts`, so sequence them (US1 then US2) rather than parallelizing to avoid the same-file conflict.
- **User Story 3 (Phase 4)**: Depends on Foundational + US2 (needs `avatar_path`/upload to exist before "remove" is meaningful to test, though the removal code itself only needs T001/T004).
- **User Story 4 (Phase 5)**: Depends on Foundational + US1 + US3 (resets both fields, so both must exist first).
- **Polish (Final Phase)**: Depends on all four stories.

### Parallel Opportunities

- T003 and T004 (both hand-written migrations, different files) can run in parallel.
- T006 (validator) can run in parallel with T003/T004.
- T013 (unit test) can run in parallel with T012 (e2e test) within US1.
- T024/T025 in Polish can run in parallel.
- Beyond that, most tasks within a story touch the same two shared files (`useProfile.ts`, `ProfileForm.vue`) and are intentionally sequential, not parallel — this is a small, single-page feature, not a multi-team parallelization target.

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

Both are P1 in [spec.md](./spec.md) — together they're the original ask
("Avatar setzen und Namen anpassen"). Recommended stopping point for a
first demo:

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 (name)
3. Complete Phase 3: User Story 2 (avatar)
4. **STOP and VALIDATE**: both independently, per their Independent Test
5. Demo — this is already the full core request

### Incremental Delivery

1. Foundational → US1 → US2 (MVP, see above)
2. Add US3 (avatar removal) → test independently
3. Add US4 (trainer moderation) → test independently — do this before
   shipping to any team with player-role accounts, since it's the
   safety mechanism agreed in `/speckit.clarify`
