# Data Model: Mitglieder-Profilseite

Delta against [specs/001-points-and-photos/data-model.md](../001-points-and-photos/data-model.md) — only what this feature adds or changes.

## user_profiles (existing table — one column added)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key references auth.users(id) on delete cascade` | unchanged |
| `display_name` | `text` | | unchanged column, now also self-writable (see RLS below) |
| `avatar_path` | `text` | nullable | **new**. Storage object path in the `avatars` bucket, e.g. `<user_id>/<uuid>.<ext>`; `null` = no avatar, show placeholder. Never a public URL; reads stream through the authenticated avatar endpoint. |

RLS (delta):

- Existing `user_profiles_read_team` (select, `is_profile_visible(id)`)
  covers `avatar_path` too — row-level policies apply to every column, no
  change needed for FR-007/FR-008.
- **New** `user_profiles_update_self` (update, authenticated):
  `using (auth.uid() = id)` plus a `with check` that requires
  `avatar_path` to be null or start with `<auth.uid()>/`. Lets a member
  write only their own profile and own avatar path; FR-002a's 2-visible-
  character minimum is enforced client-side (zod) and by a check constraint
  that ignores zero-width format characters before applying the length rule.
- Trainer-driven reset (FR-010/FR-010a) does **not** get its own RLS
  policy — it goes through the `service_role`-only server route described
  in [contracts/rls-policies.md](./contracts/rls-policies.md), which
  re-validates the trainer/team relationship itself before writing.

## Storage bucket `avatars` (new)

Path convention: `<user_id>/<uuid>.<ext>` — one live object per user; the
previous object is deleted on replace (US2 Scenario 2) or on remove (US3).

| Policy | For | Using / With Check |
|---|---|---|
| `avatars_read_team` | select, authenticated | `public.is_profile_visible(((storage.foldername(name))[1])::uuid)` |
| `avatars_write_self` | insert/update/delete, authenticated | `(storage.foldername(name))[1] = auth.uid()::text` (both) |

No `anon` policy — matches FR-008/SC-005 (no visibility outside shared
teams).

Avatar downloads are never exposed as signed or public URLs. The authenticated
`GET /api/profile/avatar/:user_id` route rechecks session and team visibility
for every request before streaming the private object.

## Key Entities (spec-level, restated with concrete shape)

- **Mitgliederprofil** → `user_profiles` row: `display_name` (min. 2 visible
  characters, FR-002a) + `avatar_path` (nullable). One row per `auth.users`
  id, independent of team membership count.

## Server-side moderation action (not a table — a request/response contract)

`POST /api/profile/moderate` (trainer-only; see
[contracts/rls-policies.md](./contracts/rls-policies.md) for the full
authorization + behavior contract):

```text
Request:  { target_user_id: uuid, team_id: uuid, field: 'name' | 'avatar' }
Response: { ok: true }
```
