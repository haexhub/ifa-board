# Contract: UI Flows

**Feature**: 001-points-and-photos
**Purpose**: Screen-level contracts for the MVP flows. Not visual design —
what data each screen shows, what actions it exposes, what routes it
lives on. Consumed by `/speckit-tasks` when it groups implementation
tasks per user story.

Every screen MUST render on a 360×640 mobile viewport without horizontal
scroll (Constitution IV) and MUST use ≥44px min-height on interactive
controls.

---

## Route map

| Route | Layout | Auth | Role | Story |
|---|---|---|---|---|
| `/` | default | required | any | — (redirects) |
| `/login` | default | optional | any | — |
| `/dashboard` | default | required | player (or trainer) | US2 |
| `/trainings` | default | required | any | US1 (list) |
| `/trainings/new` | default | required | trainer | US1 |
| `/trainings/:id` | default | required | any (edit trainer-only) | US1, US6 |
| `/players` | default | required | trainer | US4 |
| `/players/:id` | default | required | any | US2 detail |
| `/categories` | default | required | trainer | US3 |
| `/ranking` | default | required | any | US2 |
| `/public/ranking` | public | none | anon | US5 |

Redirect rules (in `middleware/auth.global.ts`):

- `/` while authenticated → `/dashboard` for players, `/trainings` for trainers.
- `/` while unauthenticated → `/login`.
- Any authenticated route while unauthenticated → `/login?redirect=<path>`.
- `/public/**` → always allowed.

---

## Screen contracts

### S1 — Login (`/login`)

**Shows**: Supabase email/password form; "Zur öffentlichen Rangliste" link.

**Actions**: sign in → redirect to `/`.

### S2 — Trainer training editor (`/trainings/new`, `/trainings/:id` in trainer role)

**Shows**:

- Date (default today, edit disabled for future dates).
- Optional title + note.
- Grid: rows = active players (sorted by jersey_number then name),
  columns = active categories (sorted by `sort_order`).
- Number-input per cell with the category's `value_min..value_max`
  range as `min`/`max` attributes and inline validation.
- Photo uploader (multi-file); shows a red banner listing active players
  without `photo_consent = true` (R6).
- "Speichern" button — disabled until: at least one photo present.
- If editing: `last_updated_by` + `last_updated_at` displayed at the top
  ("Zuletzt geändert von X um HH:MM") so the last-write-wins policy is
  transparent.

**Actions**:

- Create `trainings` row in `draft` state on first render (if new).
- Upsert `point_entries` on cell blur (auto-save each cell).
- Upload photos to Storage; insert `training_photos` rows.
- "Speichern" → transitions `trainings.status` to `saved` (trigger
  asserts photo presence).

### S3 — Player dashboard (`/dashboard`)

**Shows**:

- Current rank position in the team over default timeframe.
- Top-3 team members.
- Timeframe picker.
- CTA "Meine Punkte" → `/players/:me`.

**Actions**: pick timeframe (persisted in `localStorage`); navigate.

### S4 — Player detail (`/players/:id`)

**Shows** (for any authenticated viewer):

- Basic info: name, jersey_number, position.
- Per-category line chart of `value` vs. `training.date` in the
  selected timeframe.
- Team average and median as comparison lines on each chart.

**Actions**: timeframe picker; back.

### S5 — Team ranking (`/ranking`)

**Shows**: sortable table of players over selected timeframe. Columns:
rank, name, jersey number, per-category SUM, total. Sorted by the
lexicographic rank from `get_team_ranking()`.

**Actions**: timeframe picker.

### S6 — Public anonymous ranking (`/public/ranking`)

**Shows**: rank, jersey_number, per-category SUM. No names, no photos.
"Ohne Anmeldung – nur Trikotnummern" banner. Timeframe picker (defaults
to "Saison" from `settings.season_start`).

**Actions**: timeframe picker only.

### S7 — Players CRUD (`/players`, trainer-only)

**Shows**: table of players with edit/deactivate actions; "Neuer Spieler"
button; per-row `photo_consent` toggle; "Einladen per E-Mail" action
(if `linked_user_id is null`).

### S8 — Categories CRUD (`/categories`, trainer-only)

**Shows**: table of categories with edit/deactivate actions and
`sort_order` drag-handles (or up/down buttons); "Neue Kategorie"
button; deletion blocked when historical entries exist (UI hides
the delete action).

---

## Empty and error states

Each list screen renders a helpful empty state:

- `/trainings` empty → "Noch kein Training erfasst" + trainer-only CTA
  "Erstes Training anlegen".
- `/players` (trainer) empty → CTA "Ersten Spieler anlegen".
- `/categories` (trainer) empty → CTA "Erste Kategorie anlegen"; but
  the seed installs one so this rarely fires.
- `/ranking` with no entries in the timeframe → "Keine Punkte im
  gewählten Zeitraum".

Common error paths:

- Network failure on save → toast "Speichern fehlgeschlagen — bitte
  erneut versuchen" and keep the local state.
- Photo upload rejected (size/type) → per-file error message next to
  the failed file, other files continue.
- RLS denial (unexpected — normally the UI hides the action) → toast
  "Keine Berechtigung" and redirect to `/`.
