# Phase 0 Research: Mitglieder-Profilseite

No open `NEEDS CLARIFICATION` markers remain in the Technical Context — this
feature reuses the existing stack entirely. The decisions below are the
concrete technical choices made to satisfy the spec's FRs while following
Constitution Principle I (Simplicity First: reuse over reinvention).

## Decision: Avatar storage reuses the training-photos pattern

**Decision**: New bucket `avatars`, path `<user_id>/<uuid>.<ext>`, same
`PHOTO_MIME_TYPES` / `PHOTO_MAX_BYTES` (10 MB) limits and signed-URL read
pattern (`createSignedUrl(path, 600)`) as `training-photos`.

**Rationale**: FR-005 needs format/size limits with a clear rejection
message — `photoFileSchema` in `app/utils/validators.ts` already does
exactly this and is already tested. `training_photos` already proves the
signed-URL read model satisfies "not publicly exposed" (FR-008/SC-005).
Reusing both means zero new validation code and zero new read-access
pattern to review.

**Alternatives considered**:
- *Public bucket, plain URLs*: simpler reads, but violates FR-008 (would
  leak avatars outside the member's teams, e.g. via a leaked URL with no
  expiry) — rejected.
- *Separate, avatar-specific MIME/size limits*: no requirement drove a
  different limit; would just be an unjustified extra constant — rejected
  per Simplicity First.

## Decision: One avatar per profile, replace-on-upload (no gallery)

**Decision**: `user_profiles.avatar_path` is a single nullable column,
overwritten on each upload; the previous storage object is deleted.

**Rationale**: Spec (US2 Scenario 2, SC-004) is explicit: new upload fully
replaces the old one, no history. Matches "sein Avatar setzen" (singular)
in the original request.

**Alternatives considered**:
- *Append-only gallery like `training_photos`*: rejected — no requirement
  for history, and it would need a "which one is active" concept the spec
  never asks for.

## Decision: Self-service edits via the browser Supabase client + RLS; trainer-reset via one `service_role` server route

**Decision**: US1-US3 (a member editing their own name/avatar) go through
the existing browser `@nuxtjs/supabase` client, gated by a new
`user_profiles_update_self` RLS policy (`auth.uid() = id`) and new
`avatars` bucket policies (read: `is_profile_visible`; write: caller's own
`<user_id>/` prefix). US4 (trainer resets a teammate's name/avatar) gets
one new route, `app/server/api/profile/moderate.post.ts`, using
`serverSupabaseServiceRole` — because it must (a) write a row that isn't
the caller's own and (b) delete a storage object, which RLS alone cannot
safely scope to "only ever resets to the default, never sets arbitrary
content."

**Rationale**: Matches the project's established two-surface data-access
split (documented in `specs/001-points-and-photos/plan.md`'s Structure
Decision): browser+RLS for anything a self-scoped policy can express, a
narrow `service_role` server route only when RLS genuinely can't express
the constraint. `app/server/api/invitations/issue.post.ts` is the existing
precedent for "verify trainer-of-team in Drizzle, then act with
service_role."

**Alternatives considered**:
- *A permissive RLS policy letting any trainer `UPDATE` a shared-team
  member's `user_profiles` row*: rejected — RLS can gate *that a row may be
  written*, but not *that only a specific reset value may be written*; a
  trainer with raw UPDATE access could set arbitrary content, which is a
  bigger privilege than FR-010/FR-010a ask for.
- *A `SECURITY DEFINER` SQL function instead of a server route*: works for
  resetting the `user_profiles` row, but deleting the actual storage object
  needs the Storage API (deleting only the `storage.objects` metadata row
  via SQL would orphan the file in the storage backend) — a server route
  already has both Drizzle and `serverSupabaseServiceRole().storage`
  available in one place, so it was chosen over splitting the reset across
  a SQL function *and* a server route.

## Decision: `/profile` is a standalone, team-independent page

**Decision**: New page at `app/pages/profile.vue`, outside `/t/[slug]/**`,
using only the app's default authenticated-session requirement (no
`team-context` middleware).

**Rationale**: FR-001 — one profile per account, not per team; a member in
multiple teams must reach the same page regardless of which team is
currently active.

**Alternatives considered**:
- *`/t/[slug]/profile`*: rejected — would imply a per-team profile and
  force picking "a" team just to edit account-level data, contradicting
  FR-001.
