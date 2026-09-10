# Data Model: Trainingspunkte & Trainingsfotos

**Feature**: 001-points-and-photos
**Date**: 2026-09-10

All tables live in the `public` schema unless noted. Every table has RLS
enabled; policies are summarized in
[contracts/rls-policies.md](./contracts/rls-policies.md).

Column types are Postgres. Timestamps default to `now()`. Every mutable
row carries `created_at`, `created_by`, `last_updated_at`,
`last_updated_by` (Audit convention from spec).

---

## user_profiles

Mirror of `auth.users` with the app-level role. Populated on invite
acceptance (see research R2). Enables RLS policies to join on role
without parsing JWT metadata.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key references auth.users(id) on delete cascade` | Same PK as auth user |
| `role` | `text` | `not null check (role in ('trainer','player'))` | |
| `display_name` | `text` | `not null` | Copied from invite for header UI |
| `created_at` | `timestamptz` | `not null default now()` | |
| `last_updated_at` | `timestamptz` | `not null default now()` | trigger-updated |

Indexes: `create index user_profiles_role_idx on user_profiles(role);`

## players

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `name` | `text` | `not null` | |
| `active` | `boolean` | `not null default true` | |
| `jersey_number` | `int` | | Nullable; uniqueness enforced by partial index below |
| `position` | `text` | | Free-form; e.g. "TW", "IV", "ST" |
| `linked_user_id` | `uuid` | `unique references auth.users(id) on delete set null` | 1:1 optional |
| `photo_consent` | `boolean` | `not null default false` | |
| `created_at` | `timestamptz` | `not null default now()` | |
| `created_by` | `uuid` | `references auth.users(id)` | |
| `last_updated_at` | `timestamptz` | `not null default now()` | trigger-updated |
| `last_updated_by` | `uuid` | `references auth.users(id)` | |

Indexes / constraints:

- `create unique index players_active_jersey_uniq on players(jersey_number) where active = true and jersey_number is not null;`
  Enforces FR-030/A13: jersey unique among active players.
- `create index players_active_idx on players(active);`

State transitions: `active = true` ⇄ `active = false` (soft-delete). Hard
delete blocked by referential integrity from `point_entries`.

## point_categories

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `name` | `text` | `not null` | |
| `active` | `boolean` | `not null default true` | |
| `sort_order` | `int` | `not null` | Lower = higher priority in ranking (FR-051) |
| `value_min` | `int` | `not null` | |
| `value_max` | `int` | `not null check (value_max >= value_min)` | |
| `created_at` | `timestamptz` | `not null default now()` | |
| `created_by` | `uuid` | `references auth.users(id)` | |
| `last_updated_at` | `timestamptz` | `not null default now()` | trigger-updated |
| `last_updated_by` | `uuid` | `references auth.users(id)` | |

Indexes: `create index point_categories_active_sort_idx on point_categories(active, sort_order);`

Deletion of a category with any referencing `point_entries` is prevented
by the FK (`on delete restrict`); UI offers deactivation only, as per
FR-024.

## trainings

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `date` | `date` | `not null check (date <= current_date)` | FR-011 no future date |
| `title` | `text` | | |
| `note` | `text` | | |
| `created_at` | `timestamptz` | `not null default now()` | |
| `created_by` | `uuid` | `references auth.users(id)` | |
| `last_updated_at` | `timestamptz` | `not null default now()` | trigger-updated |
| `last_updated_by` | `uuid` | `references auth.users(id)` | |

Indexes: `create index trainings_date_idx on trainings(date desc);`

**Photo-Pflicht** (FR-013): enforced at save time by a **deferred check**
in a Postgres trigger `enforce_training_has_photo` that runs
`after insert or update` on `trainings`. Because photo upload happens
in a separate request (Storage), the app pattern is:

1. Trainer opens the training-editor page → a `trainings` row is created
   in `draft` state (see next column).
2. Photos uploaded → rows in `training_photos`.
3. On "Speichern" the UI moves the row to `saved` state; the trigger
   asserts `exists (select 1 from training_photos where training_id = new.id)`
   before allowing `status = 'saved'`.

Adding a `status` column:

| Column | Type | Constraints |
|---|---|---|
| `status` | `text` | `not null default 'draft' check (status in ('draft','saved'))` |

`draft` trainings are invisible to `player` role (see RLS).

## training_photos

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `training_id` | `uuid` | `not null references trainings(id) on delete cascade` | |
| `storage_path` | `text` | `not null unique` | Object key in Storage bucket `training-photos` |
| `content_type` | `text` | `not null check (content_type in ('image/jpeg','image/png','image/heic','image/heif','image/webp'))` | FR-043 |
| `size_bytes` | `int` | `not null check (size_bytes > 0 and size_bytes <= 10485760)` | 10 MB, FR-042 |
| `uploaded_by` | `uuid` | `not null references auth.users(id)` | |
| `uploaded_at` | `timestamptz` | `not null default now()` | |

Indexes: `create index training_photos_training_idx on training_photos(training_id);`

## point_entries

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `primary key default gen_random_uuid()` | |
| `training_id` | `uuid` | `not null references trainings(id) on delete cascade` | |
| `player_id` | `uuid` | `not null references players(id) on delete restrict` | |
| `category_id` | `uuid` | `not null references point_categories(id) on delete restrict` | |
| `value` | `int` | `not null` | Range checked by trigger against category |
| `created_at` | `timestamptz` | `not null default now()` | |
| `created_by` | `uuid` | `references auth.users(id)` | |
| `last_updated_at` | `timestamptz` | `not null default now()` | trigger-updated |
| `last_updated_by` | `uuid` | `references auth.users(id)` | |

Constraints / indexes:

- `unique (training_id, player_id, category_id)` — one entry per triple.
- `create index point_entries_player_idx on point_entries(player_id);`
- `create index point_entries_training_idx on point_entries(training_id);`
- **Range trigger** `enforce_point_entry_range`
  `before insert or update`: fetches the category and asserts
  `new.value between category.value_min and category.value_max`.
  Uses the category state at insert/update time (FR-022, edge case:
  "Wertebereich einer Kategorie ändert sich" — historical rows stay
  valid, only new writes are rechecked against the current range).

## settings

Singleton row for team-wide settings; primary key is a fixed value so
there is always exactly one.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `int` | `primary key check (id = 1)` | Always 1 |
| `season_start` | `date` | `not null default date_trunc('year', current_date)::date` | Assumption A4 |
| `updated_at` | `timestamptz` | `not null default now()` | |
| `updated_by` | `uuid` | `references auth.users(id)` | |

## Derived views

Written in migrations under `supabase/migrations/…_views.sql`:

- **`public.player_scores_by_category`** — one row per
  `(player_id, category_id, from_date, to_date)` with `sum_value`,
  `avg_value`, `median_value`. Implemented as a **function**
  `get_player_scores_by_category(from date, to date)` returning a set,
  because dynamic timeframes cannot be a static view.
- **`public.team_ranking`** — similarly a function
  `get_team_ranking(from date, to date)`. Uses `dense_rank()` over an
  `order by` list built dynamically from active categories'
  `sort_order` (see [contracts/public-ranking.md](./contracts/public-ranking.md)).
- **`public.get_public_ranking(from date, to date)`** — `SECURITY INVOKER`
  wrapper that returns only `rank_position`, `jersey_number`, and
  per-category `sum_value`. Granted to `anon`.

## Storage buckets

- `training-photos` — private bucket. RLS policy on `storage.objects`
  matches `bucket_id = 'training-photos'` and grants access only to
  authenticated users. Signed URLs (short TTL, e.g. 10 min) are
  generated on demand from the training detail page.
