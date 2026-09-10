# Contract: RLS Policies (Round 2, Multi-Tenant)

**Feature**: 001-points-and-photos
**Constitution reference**: Principle II (Role-Based Access via Supabase RLS, NON-NEGOTIABLE)

Every base table has RLS enabled. Team-scoped policies use the helpers
`public.is_member(team_id)` and `public.is_trainer(team_id)`. The
anonymous public ranking is served exclusively through
`public.get_public_ranking(slug, from, to)` — see
[public-ranking.md](./public-ranking.md).

Helpers (repeated here for review convenience — canonical source is
[data-model.md](../data-model.md)):

```sql
create or replace function public.is_member(p_team uuid) returns boolean
  language sql stable
as $$ select exists (select 1 from public.memberships
  where team_id = p_team and user_id = auth.uid()) $$;

create or replace function public.is_trainer(p_team uuid) returns boolean
  language sql stable
as $$ select exists (select 1 from public.memberships
  where team_id = p_team and user_id = auth.uid() and role = 'trainer') $$;
```

---

## teams

| Policy | For | Using / With Check |
|---|---|---|
| `teams_read_membership` | select, authenticated | `public.is_member(id)` |
| `teams_update_trainer` | update, authenticated | `public.is_trainer(id)` (both) |
| `teams_insert_via_server` | insert, service_role only | inserts happen through `POST /api/teams/create` |

Deletes are not policy-granted; a team is only removed via a
service-role admin path (not offered in v1).

## memberships

| Policy | For | Using / With Check |
|---|---|---|
| `memberships_read_self_or_teamtrainer` | select, authenticated | `user_id = auth.uid() OR public.is_trainer(team_id)` |
| `memberships_write_trainer` | insert/update/delete, authenticated | `public.is_trainer(team_id)` (both) |
| `memberships_bootstrap_via_server` | insert, service_role only | `POST /api/teams/create` creates the first membership |

Guard trigger `prevent_last_trainer_change` fires **after** RLS and
raises if the mutation would leave the team with zero trainers.

## invitations

| Policy | For | Using / With Check |
|---|---|---|
| `invitations_read_team_trainer` | select, authenticated | `public.is_trainer(team_id)` |
| `invitations_read_own_email` | select, authenticated | `email = auth.jwt() ->> 'email'` |
| `invitations_write_trainer` | insert/update/delete, authenticated | `public.is_trainer(team_id)` (both) |
| `invitations_accept_own_email` | update, authenticated | `email = auth.jwt() ->> 'email' AND accepted_at is null` (with check limits update to `accepted_at`) |

Invitation acceptance also inserts a membership; that insert is done
either by a trigger `after update of accepted_at` (with `security
definer`) or by the server route `/api/invitations/accept`. The trigger
approach keeps the RLS story explicit.

## players, point_categories, trainings, training_photos, point_entries, team_settings

Same shape for all six:

| Policy | For | Using / With Check |
|---|---|---|
| `<t>_read_member` | select, authenticated | `public.is_member(team_id)` |
| `<t>_write_trainer` | insert/update/delete, authenticated | `public.is_trainer(team_id)` (both) |

For `training_photos` and `point_entries` the `team_id` is derived via
the join to `trainings`:

```sql
create policy training_photos_read_member on public.training_photos for select
  using (
    exists (select 1 from public.trainings t
            where t.id = training_photos.training_id
              and public.is_member(t.team_id)
              and (t.status = 'saved' or public.is_trainer(t.team_id)))
  );

create policy training_photos_write_trainer on public.training_photos
  for all using (
    exists (select 1 from public.trainings t
            where t.id = training_photos.training_id
              and public.is_trainer(t.team_id))
  ) with check (
    exists (select 1 from public.trainings t
            where t.id = training_photos.training_id
              and public.is_trainer(t.team_id))
  );
```

`point_entries` follows the same pattern via
`trainings`/`players`/`point_categories` joins; the team-consistency
trigger `enforce_point_entry_team_consistency` prevents mixing team_ids
across the three parents.

For `trainings`: player role never sees `draft`:

```sql
create policy tr_read_member_saved on public.trainings for select
  using (public.is_member(team_id) and (status = 'saved' or public.is_trainer(team_id)));
```

## Storage bucket `training-photos`

Policies on `storage.objects` referencing the team-prefixed path:

| Policy | For | Using |
|---|---|---|
| `tphoto_read_member` | select, authenticated | `bucket_id = 'training-photos' AND public.is_member(((storage.foldername(name))[1])::uuid)` |
| `tphoto_write_trainer` | insert/update/delete, authenticated | `bucket_id = 'training-photos' AND public.is_trainer(((storage.foldername(name))[1])::uuid)` |

**No** `anon` policies. Signed URLs for viewing are minted from a
trainer/player session via
`supabase.storage.from('training-photos').createSignedUrl(path, 600)`.

---

## Negative-test matrix

Two Playwright specs deliver SC-003 (single-team role bypass) and SC-009
(cross-team leak). Every row is one test case.

### `tests/e2e/rls-negative-single-team.spec.ts` (SC-003)

Setup: single team T, trainer TU_T, player PU_T.

| # | Actor | Attempt | Expected |
|---|---|---|---|
| N1 | PU_T | `insert into point_entries …` | Denied |
| N2 | PU_T | `update players set active=false where team_id=T` | Denied |
| N3 | PU_T | `insert into trainings(team_id=T, …)` | Denied |
| N4 | PU_T | `select from trainings where team_id=T and status='draft'` | Empty |
| N5 | PU_T | `insert` into Storage under `<T>/…` | Denied |
| N6 | PU_T | `update memberships set role='trainer' where user_id=me` | Denied |

### `tests/e2e/rls-negative-cross-team.spec.ts` (SC-009)

Setup: teams A and B. TU_A is a trainer of A only. PU_A is a player of A only. Team B contains data.

| # | Actor | Attempt | Expected |
|---|---|---|---|
| X1 | TU_A | `select * from players where team_id = B.id` | Empty |
| X2 | TU_A | `insert into trainings(team_id = B.id, …)` | Denied |
| X3 | TU_A | `rpc('get_team_ranking', p_team=B.id)` | Returns null / denies (guard on `is_member`) |
| X4 | TU_A | Download from `storage.training-photos/<B.id>/…` | Denied |
| X5 | TU_A | `select * from memberships where team_id = B.id` | Empty |
| X6 | TU_A | `select * from invitations where team_id = B.id` | Empty |
| X7 | PU_A | Same X1..X6 | Same results |
| X8 | anon | `select * from teams` | Empty |
| X9 | anon | `rpc('get_public_ranking', p_slug=<B.slug>, …)` | Returns projection only (no PII) — verify shape |
| X10 | anon | Download from `storage.training-photos/<any>/…` | Denied |
