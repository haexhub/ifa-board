# Contract: RLS Policies & Moderation Route — Mitglieder-Profilseite

Delta against [specs/001-points-and-photos/contracts/rls-policies.md](../../001-points-and-photos/contracts/rls-policies.md).

## `user_profiles`

```sql
create policy user_profiles_update_self on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      avatar_path is null
      or avatar_path like (auth.uid()::text || '/%')
    )
  );
```

Combined with the existing `user_profiles_read_team` select policy, a
member can read every profile they share a team with, and write only their
own — matching FR-002/FR-003/FR-006.

`display_name` gets a check constraint (added via Drizzle, not a
hand-written migration, since it's plain column DDL):

```sql
alter table public.user_profiles
  add constraint user_profiles_display_name_len_check
  check (
    length(trim(regexp_replace(display_name, '[\\u200B-\\u200D\\uFEFF]', '', 'g'))) >= 2
  );
```

## Storage bucket `avatars`

```sql
create policy avatars_read_team on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_profile_visible(((storage.foldername(name))[1])::uuid)
  );

create policy avatars_write_self on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

No `anon` policy on either the table or the bucket — an avatar is never
reachable without an authenticated session that shares a team with the
profile's owner (FR-008, SC-005).

## `POST /api/profile/moderate` (trainer-only, `service_role`)

Mirrors the existing `app/server/api/invitations/issue.post.ts` shape:
verify the caller in Drizzle first, then act with
`serverSupabaseServiceRole`.

**Request body**: `{ target_user_id: uuid, team_id: uuid, field: 'name' | 'avatar' }`

**Authorization** (both MUST hold, else `403`):
1. Caller has a `memberships` row for `team_id` with `role = 'trainer'`.
2. `target_user_id` has a `memberships` row for the same `team_id` (any role) — a trainer may only reset members of their own team(s).

**Behavior**:
- `field: 'name'` → reset `user_profiles.display_name` for
  `target_user_id` to the same email-derived default the sync trigger
  would produce (`split_part(email, '@', 1)`), read via
  `serverSupabaseServiceRole().auth.admin.getUserById`.
- `field: 'avatar'` → set `avatar_path = null` first, then remove the old
  object via `serverSupabaseServiceRole().storage.from('avatars').remove([path])`.
  A missing object is a successful, idempotent retry. If the database update
  fails, leave the object and reference intact. If storage cleanup fails after
  the update, retry cleanup without restoring a database reference to a
  deleted object.
- Either action is a no-op returning `{ ok: true }` if there was nothing to
  reset (US4 Acceptance Scenario 3) — never an error for "already at
  default."
- Unknown `target_user_id`/`team_id` combination, or authorization failure
  → `403` (US4 Acceptance Scenario 4). No distinct "not found" leak that
  would let a trainer probe team membership of unrelated accounts.

### Negative-test matrix addition

One more Playwright spec case alongside the existing
`rls-negative-*` suites:

| # | Actor | Attempt | Expected |
|---|---|---|---|
| N1 | Player-role member | `POST /api/profile/moderate` for any target | 403 (not a trainer) |
| N2 | Trainer of Team A | `POST /api/profile/moderate` targeting a member of Team B only | 403 (no shared team) |
| N3 | Member (any role) | `update user_profiles set display_name = ... where id <> auth.uid()` directly via PostgREST | Denied (RLS) |
| N4 | Member (any role) | upload to `avatars/<someone-else's-user_id>/...` | Denied (RLS) |
| N5 | Unauthenticated client | download an existing `avatars/<user_id>/...` object | Denied (private bucket / no `anon` policy) |

## Authenticated avatar reads

Avatar display MUST use `GET /api/profile/avatar/:user_id`, not a signed URL.
The route rechecks the caller's session and shared-team visibility on every
request, reads the target profile's `avatar_path`, and streams the object from
the private `avatars` bucket without returning a bearer URL. It returns `401`
without a session, `403` without shared-team visibility, and `404` when the
profile has no avatar. Responses must not be publicly cached.
