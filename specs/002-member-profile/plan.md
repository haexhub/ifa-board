# Implementation Plan: Mitglieder-Profilseite

**Branch**: `002-member-profile` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-member-profile/spec.md`

## Summary

Every account (trainer or player role) gets one global profile — a display
name and an avatar image — editable from a new team-independent `/profile`
page. The display name already exists (`user_profiles.display_name`,
currently derived from the email and read-only); this feature makes it
self-editable and adds an avatar. Trainers can reset (not edit) a teammate's
name or avatar if it's inappropriate. Reuses the existing photo-upload
validation (`PHOTO_MIME_TYPES`/`PHOTO_MAX_BYTES`) for the new private
`avatars` bucket, and uses one authenticated avatar-download endpoint that
rechecks `is_profile_visible` on every request — no bearer URLs or new
visibility model.

## Technical Context

**Language/Version**: TypeScript 5.6+, strict mode; Node.js 22 LTS (same repo, no new stack).
**Primary Dependencies**: Nuxt 3, `@nuxtjs/supabase`, shadcn-vue, Tailwind CSS, `drizzle-orm` + `drizzle-kit`, `zod` — all already in use, no new dependency needed.
**Storage**: PostgreSQL (Supabase-managed); new nullable column `user_profiles.avatar_path`; new Supabase Storage bucket `avatars` keyed by `<user_id>/<uuid>.<ext>`.
**Testing**: Vitest (unit) for the name-length validator; Playwright (E2E) for self-service name/avatar edit + trainer reset, following the existing `tests/e2e/*-flow.spec.ts` pattern.
**Target Platform**: Web app, mobile-first (same as rest of the app).
**Project Type**: Web application — extends the existing single Nuxt project, no new project/service.
**Performance Goals**: SC-001 (name change reflected immediately), SC-002 (avatar reflected on next page view) — no new perf targets beyond the existing app's.
**Constraints**: RLS mandatory (Principle II); avatar visibility MUST NOT exceed the existing `user_profiles` team-sharing boundary (FR-008); no `any` without justification.
**Scale/Scope**: One profile per account, one avatar image per profile (replace-on-upload, no history) — negligible additional storage/row volume versus the existing `training-photos` usage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 ([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)).

| Principle | Gate | Status |
|---|---|---|
| **I. Simplicity First** (NON-NEGOTIABLE) | No new abstraction/service; reuse existing patterns where one already fits. | ✅ Pass. Reuses the `training-photos` upload validation (`PHOTO_MIME_TYPES`, `PHOTO_MAX_BYTES`) for the new `avatars` bucket instead of inventing new upload machinery; reuses `is_profile_visible` for read authorization; avatar bytes are streamed through one authenticated download route so each request rechecks access. Self-service edits otherwise go through the plain Supabase browser client. Only the moderation route needs `service_role` (cross-user write + storage object deletion) — see [research.md](./research.md). |
| **II. Role-Based Access via Supabase RLS** (NON-NEGOTIABLE) | Every table/bucket has RLS + policy; cross-account access denied by policy, not app logic. | ✅ Pass. New `user_profiles_update_self` policy scoped to `auth.uid() = id`. New `avatars` bucket policies: read via `is_profile_visible`, write scoped to the caller's own `<user_id>/` prefix. Trainer-reset path never grants a trainer direct RLS write access to another member's row — it goes through a `service_role` server route that itself re-validates the trainer/team relationship server-side before acting (see [contracts/rls-policies.md](./contracts/rls-policies.md)). |
| **III. Konfigurierbare Punktekategorien** | N/A — feature does not touch point categories. | ✅ N/A |
| **IV. Mobile-First UX** | `/profile` usable on ≥360px portrait; ≥44px touch targets. | ✅ Pass. Reuses existing `min-h-touch` input/button classes already used throughout the app. |
| **V. Type Safety End-to-End** | Schema change → regenerate + commit Supabase types. | ✅ Pass. `avatar_path` column added via Drizzle + `pnpm gen:types` regeneration, same as every prior schema change this project. |

**No violations. Complexity Tracking section intentionally empty.**

## Project Structure

### Documentation (this feature)

```text
specs/002-member-profile/
├── plan.md                  # This file
├── spec.md                  # Feature specification (with Clarifications)
├── research.md              # Phase 0 output — technical decisions
├── data-model.md            # Phase 1 output — schema, storage, RLS/RPC summary
├── quickstart.md            # Phase 1 output — dev bootstrap delta
├── contracts/
│   └── rls-policies.md      # New policies/RPCs/server route for this feature
├── checklists/
│   └── requirements.md
└── tasks.md                 # Phase 2 output (/speckit-tasks, not this command)
```

### Source Code (repository root, delta only — rest of the app is unchanged)

```text
app/
├── components/
│   └── profile/
│       └── ProfileForm.vue           # name input + avatar upload/remove, reuses TrainingPhotoUpload's picker pattern
├── composables/
│   └── useProfile.ts                 # get own profile, update name, upload/remove avatar, authenticated avatar URL
├── pages/
│   └── profile.vue                   # team-independent; no team-context middleware, just the global auth requirement
├── components/team/
│   └── MembershipTable.vue           # + "Avatar zurücksetzen" / "Namen zurücksetzen" row actions (trainer-only, US4)
├── server/api/profile/
│   ├── moderate.post.ts              # trainer-only, service_role: re-validates shared-team+trainer, resets name and/or removes avatar (storage + DB)
│   └── avatar/[user_id].get.ts       # authenticated, per-request visibility check, streams private avatar bytes
└── types/database.ts                 # regenerated (avatar_path column)

db/schema/index.ts                    # userProfiles: + avatarPath column

supabase/migrations/
├── <ts>_user_profiles_avatar.sql          # drizzle-generated: add column
├── <ts>_user_profiles_update_self_rls.sql # hand-written: self-update policy
└── <ts>_avatars_bucket.sql                # hand-written: bucket + storage policies

tests/e2e/
└── profile-flow.spec.ts              # US1-US4
```

**Structure Decision**: Extends the existing single Nuxt project — no new
project, no new service. `/profile` sits outside `/t/[slug]/**` (team
context is irrelevant to a global, per-account profile), so it only needs
the app's default authenticated-session requirement, not the
`team-context` middleware. Self-service reads/writes (US1-US3) go straight
through the browser Supabase client, gated by RLS, exactly like every
other self-owned-row feature in this app. The one exception is the
trainer-reset path (US4): resetting another account's row *and* deleting
their storage object safely needs `service_role`, so it gets its own
narrow server route — mirroring the existing `app/server/api/invitations/`
pattern (trainer-authorization check in Drizzle, then the privileged
action), not a new architectural layer.

## Complexity Tracking

*None. All gates pass.*
