# Contract: RLS Policies

**Feature**: 001-points-and-photos
**Constitution reference**: Principle II (Role-Based Access via Supabase RLS, NON-NEGOTIABLE)

All base tables have RLS enabled (`alter table X enable row level
security;`). No table ships without at least one policy. The anonymous
public ranking is served **only** through the view/function contract in
[public-ranking.md](./public-ranking.md) — no base table grants `anon`.

Helper function used by policies:

```sql
create or replace function public.current_role() returns text
language sql stable
as $$ select role from public.user_profiles where id = auth.uid() $$;
```

`stable`, cached per statement.

---

## user_profiles

| Policy | For | Using / With Check |
|---|---|---|
| `up_self_read` | select, authenticated | `auth.uid() = id` |
| `up_trainer_read_all` | select, authenticated | `public.current_role() = 'trainer'` |
| `up_trainer_write` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

Rationale: a player sees only themselves; trainers can inspect the full
roster.

## players

| Policy | For | Using / With Check |
|---|---|---|
| `players_read_authenticated` | select, authenticated | `true` |
| `players_write_trainer` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

Rationale: FR-054 (full in-team transparency).

## point_categories

| Policy | For | Using / With Check |
|---|---|---|
| `pc_read_authenticated` | select, authenticated | `true` |
| `pc_write_trainer` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

## trainings

| Policy | For | Using / With Check |
|---|---|---|
| `tr_read_authenticated_saved` | select, authenticated | `status = 'saved' or public.current_role() = 'trainer'` |
| `tr_write_trainer` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

Rationale: player role never sees `draft` trainings; trainers see both.

## training_photos

| Policy | For | Using / With Check |
|---|---|---|
| `tp_read_authenticated` | select, authenticated | `exists (select 1 from trainings t where t.id = training_photos.training_id and (t.status = 'saved' or public.current_role() = 'trainer'))` |
| `tp_write_trainer` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

The consent-blur decision (R6) is a UI concern — the row is still
readable so the trainer can review, and the UI masks it for players.

## point_entries

| Policy | For | Using / With Check |
|---|---|---|
| `pe_read_authenticated` | select, authenticated | `true` |
| `pe_write_trainer` | insert/update/delete, authenticated | `public.current_role() = 'trainer'` |

Rationale: FR-054 (full transparency across the team).

## settings

| Policy | For | Using / With Check |
|---|---|---|
| `s_read_authenticated` | select, authenticated | `true` |
| `s_write_trainer` | update, authenticated | `public.current_role() = 'trainer'` |

Insert / delete blocked (singleton — seeded once).

## Storage bucket `training-photos`

Policies on `storage.objects`:

| Policy | For | Using |
|---|---|---|
| `tphoto_read_auth` | select, authenticated | `bucket_id = 'training-photos'` |
| `tphoto_insert_trainer` | insert, authenticated | `bucket_id = 'training-photos' and public.current_role() = 'trainer'` |
| `tphoto_delete_trainer` | delete, authenticated | `bucket_id = 'training-photos' and public.current_role() = 'trainer'` |

The bucket has **no** policy for `anon`. Signed URLs for viewing are
minted through `supabase.storage.from('training-photos').createSignedUrl(path, 600)`
by any authenticated user; the URL is valid for 10 minutes.

---

## Negative-test matrix (delivers SC-003)

Each row is one Playwright case in `tests/e2e/rls-negative.spec.ts`.

| Test | Role | Attempt | Expected |
|---|---|---|---|
| N1 | player | `insert into point_entries …` via `supabase-js` | Denied (RLS) |
| N2 | player | `update players set active=false where id=…` | Denied |
| N3 | player | `insert into trainings …` | Denied |
| N4 | player | select from `trainings where status='draft'` | Empty result |
| N5 | player | `insert` into Storage `training-photos` | Denied |
| N6 | anon | `select * from point_entries` | Denied (grants) |
| N7 | anon | download from Storage `training-photos/<any>` | Denied (no anon policy) |
| N8 | anon | `select * from public_ranking` (base tables) | Denied on base; view grants only project the anonymous shape |
| N9 | trainer | `insert into point_entries` with value outside category range | Denied (range trigger) |
| N10 | trainer | move training to `status='saved'` without any `training_photos` | Denied (photo-required trigger) |
