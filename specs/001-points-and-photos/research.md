# Research: Trainingspunkte & Trainingsfotos (Round 2, Multi-Tenant)

**Feature**: 001-points-and-photos
**Date**: 2026-09-10 (regenerated after Round-2 clarify)
**Purpose**: Locked technology and pattern decisions for the multi-tenant
scope. Each entry is authoritative unless overturned by a later, explicit
research update.

---

## R1: Nuxt rendering mode

- **Decision**: Nuxt 3 in universal (SSR) mode.
- **Rationale**: `@nuxtjs/supabase` handles cookie-based server session
  cleanly (including magic-link callback), SSR gives the anonymous
  public ranking cheap first paint, and mobile users get faster first
  meaningful paint on slow connections.
- **Alternatives considered**: SPA (`ssr: false`) — kept as fallback if
  server auth complications outweigh benefits, one config flip; static
  (`nuxt generate`) — rejected, data is dynamic.

## R2: Auth flow — passwordless (magic-link) + onboarding

- **Decision**: Supabase Auth via `@nuxtjs/supabase` with **OTP magic-link
  only**. Password login is disabled in the Supabase project config.
  - **Login page** (`/login`) has a single email input. Supabase sends an
    OTP link that lands on `/callback`, which restores the session and
    redirects.
  - **Signup** shares the same magic-link route: unknown email addresses
    are auto-created as `auth.users` rows on first link click. No
    separate registration form.
  - **Onboarding** (`/start`): once a session exists but the user has no
    `memberships` rows, the app routes there. From `/start`, the user
    either:
    - **founds a team** (`POST /api/teams/create` — server route validates
      the authenticated session, passes the verified user ID to one
      transactional RPC/database function, and atomically inserts the team
      row plus a Trainer-Membership), or
    - **accepts an invitation** — the invitation-token was received via
      the `/invite/:token` link (which itself sends a magic-link if the
      user isn't yet signed in) and is accepted by one transactional
      database function that inserts the membership and sets
      `accepted_at` atomically.
  - **Team-invite sending** (`POST /api/invitations/issue`): trainer-only,
    verifies the caller has `is_trainer(team_id)`, inserts an
    `invitations` row with a random token and 14-day expiry, and calls
    `supabase.auth.admin.inviteUserByEmail(email, {redirectTo:
    '/invite/'+token})`. That primes the Supabase magic-link mail and
    steers the recipient at the invite-token flow after login.
  - **Display name**: captured on the first onboarding step and written
    to `auth.users.user_metadata.display_name`; mirrored to a
    RLS-protected `user_profiles` table for team-scoped reads.
- **Rationale**: Passwordless removes the "forgot password" support
  burden and matches the constitution's mobile-first stance (typing an
  email + tapping a link is friendlier than remembering a password).
  Splitting signup from onboarding lets `auth.users` stay pure while the
  team-related tables carry the app model.
- **Alternatives considered**:
  - **Email + password**: rejected — user explicit no-password
    requirement.
  - **Social logins (Google/Apple)**: deferred; the football club is
    unlikely to need them for v1 and each adds an OAuth client.
  - **Anonymous auth**: rejected — creates ghosts without a stable
    identity for memberships.

## R3: Team model — `teams`, `memberships`, `invitations`

- **Decision**:
  - `teams` table (`id uuid pk`, `name text`, `slug text unique`,
    `created_by uuid references auth.users`, `created_at timestamptz`).
  - `memberships` table (`user_id uuid references auth.users`,
    `team_id uuid references teams`, `role text check in
    ('trainer','player')`, `created_at`). Composite primary key
    `(user_id, team_id)` — one membership per (user, team). A guard
    trigger prevents deleting or downgrading the last trainer of a team.
  - `invitations` table (`id uuid pk`, `team_id`, `email text`,
    `role text`, `token text unique`, `invited_by`, `created_at`,
    `expires_at`, `accepted_at`).
  - Team-scoped tables (`players`, `point_categories`, `trainings`,
    `training_photos` via join, `point_entries` via join) all carry a
    non-null `team_id` with FK to `teams`.
- **Rationale**: Matches spec FR-001..008, FR-070..074 and the
  cross-team isolation requirement SC-009. Composite PK keeps the
  membership set small and index-friendly.
- **Alternatives considered**:
  - **`memberships` with a `roles text[]` array**: rejected — makes RLS
    joins harder and doesn't fit two-role model.
  - **Row-level tenancy via schema-per-team**: rejected — Postgres RLS
    handles tenancy cleanly; per-schema explodes migrations and
    complicates Supabase Storage.

## R4: RLS helpers — `is_member`, `is_trainer`

- **Decision**: Two helpers, both `stable` and used by every team-scoped
  policy:
  ```sql
  create function public.is_member(p_team uuid) returns boolean
    language sql stable
  as $$ select exists (select 1 from public.memberships
    where team_id = p_team and user_id = auth.uid()) $$;

  create function public.is_trainer(p_team uuid) returns boolean
    language sql stable
  as $$ select exists (select 1 from public.memberships
    where team_id = p_team and user_id = auth.uid() and role = 'trainer') $$;
  ```
- **Rationale**: One join, indexed (`memberships_pk` covers both
  filters). Every team-scoped table's `using` and `with check` clauses
  become 1-line calls.
- **Alternatives considered**: parsing `auth.jwt()` metadata for team
  membership — rejected because memberships change independently of the
  JWT.

## R5: Storage bucket + path convention

- **Decision**: Single private bucket `training-photos`. Object path is
  `<team_id>/<training_id>/<uuid>.<ext>`. Storage policies extract
  `team_id` from the path (`(storage.foldername(name))[1]::uuid`) and
  gate reads on `is_member(that_team_id)` and writes on
  `is_trainer(that_team_id)`.
- **Rationale**: Keeps a single bucket (cheaper, simpler) while
  enforcing cross-team isolation at the Storage layer. The prefix
  convention doubles as an at-a-glance audit tool.
- **Alternatives considered**:
  - **Bucket-per-team**: rejected — bucket creation would need a server
    round-trip on team creation and complicates migrations.

## R6: Public anonymous ranking

- **Decision**: One narrowly projected function
  `public.get_public_ranking(p_slug text, p_from date, p_to date) returns
  jsonb`, `security definer`, owned by a constrained read-only role. Grants
  `execute … to anon, authenticated`; base tables remain locked down.
- **Rationale**: Slug is the anonymous identifier; the function resolves
  it to a team internally and never returns the team's UUID or names.
  Same reasoning as Round 1 (dedicated projection surface).
- **Alternatives considered**: `SECURITY DEFINER` — rejected (bypasses
  RLS and requires meticulous auditing).

## R7: Ranking calculation

- **Decision**: SQL — `public.get_team_ranking(p_team uuid, p_from date,
  p_to date) returns jsonb`. Lexicographic sort by category
  `sort_order` × `sum(value) desc`; ties get equal rank via competition
  `rank()` (so the sequence is 1, 2, 2, 4). Public function is a projection over the same
  algorithm but returns only jersey/scores.
- **Rationale**: Single source of truth in SQL; the client stays
  presentation-only. Small data volumes make materialization unnecessary.

## R8: Photo consent enforcement

- **Decision**: Same coarse rule as Round 1: `photo_consent boolean` on
  `players`; the UI blurs/hides team photos for `player` viewers if any
  active player in the team lacks consent. Trainer always sees raw.
  Enforcement is UI-side (no face detection); the DB simply exposes
  `photo_consent`.
- **Rationale**: Unchanged from Round 1 (A12).

## R9: Team switcher UX

- **Decision**: A shadcn `Dropdown` in the top-nav lists the current
  user's memberships. Selecting one navigates to `/t/<slug>/` (root
  redirects role-aware). Current context = URL slug (single source of
  truth). Last-visited slug persisted to `localStorage` for the login
  redirect only.
- **Rationale**: Keeps the app state stateless — URL is truth. Avoids a
  global "current team" store that gets stale.

## R10: Team creation server route

- **Decision**: `POST /api/teams/create` validates the authenticated
  session with a user-scoped server client, then passes the verified user ID
  to one transactional RPC/database function. That function does three things
  atomically:
  1. Generates slug candidate via `slug(name)`; if collision, append
     `-2`, `-3`, … until free.
  2. `insert into teams(created_by, ...)` using the verified user ID.
  3. `insert into memberships(user_id, team_id, role)` with role `trainer`.
  Separate REST inserts are prohibited because they can leave a team without
  its first membership. A service-role client, if needed by the route, is
  isolated from the browser session and receives only the verified user ID;
  the RPC is executable only by `service_role`, never by `anon` or
  `authenticated`.
- **Rationale**: The membership insert cannot be done from the client
  because at that instant the caller has no `is_trainer(<new_team_id>)`
  membership yet. Doing this on the server, atomically, avoids
  chicken-and-egg RLS grief.
- **Alternatives considered**:
  - **Postgres `security definer` function**: viable but the server
    route also validates and centralizes email-related side effects
    (none here today, but likely tomorrow).
  - **Client-side `insert` with a trigger that auto-creates the
    membership**: rejected because RLS on `teams` would still need to
    allow anon-of-membership insert, which is uglier.

## R11: Invitation flow

- **Decision**: `POST /api/invitations/issue` (server route, trainer-only
  gate via `is_trainer(team_id)`):
  1. `insert into invitations(team_id, email, role, token, invited_by,
     expires_at)`.
  2. `supabase.auth.admin.inviteUserByEmail(email, {redirectTo:
     '<origin>/invite/<token>'})` — Supabase either creates the user
     (if new) or sends a magic-link to the existing one, redirecting
     post-login to the token page.
  - The `/invite/[token]` page (client): if no session, calls
    `useAuth.signIn` with the same email (magic-link); if a session
    exists, shows an "Accept invitation to team X as role Y" card that
    posts to `POST /api/invitations/accept` which:
      1. Validates `token`, `expires_at > now()`, `accepted_at is null`,
         and requires `session.email = invitation.email` (case-insensitive).
      2. Calls one transactional database function that inserts the
         membership and sets `accepted_at = now()` atomically.
    - Email mismatches are rejected server-side. There is no `force` flag or
      cross-email confirmation path.
- **Rationale**: Matches FR-007/008 + A17. Handling both "new user" and
  "existing user" cases via the same Supabase invite path avoids
  branching the UX.
- **Alternatives considered**: signed-link-only (no server route) —
  rejected because we want a durable, revocable `invitations` row.

## R12: Chart library, package manager, validation

- **Charts**: shadcn-vue Chart on top of Unovis (unchanged from Round 1).
- **Package manager**: pnpm.
- **Input validation**: zod schemas beside forms.
- **Rationale**: All unchanged from Round 1; still the lightest option.

## R13: Testing strategy

- **Decision**:
  - Vitest unit: ranking comparator (SQL golden-master), slug helper,
    validators (zod).
  - Vitest component: TrainingPointGrid, RankingTable.
  - Playwright E2E per user story (US0..US6) plus **two** RLS
    negative suites:
    - `rls-negative-single-team.spec.ts` — a player in the team tries
      to write points, upload photos, etc. (SC-003).
    - `rls-negative-cross-team.spec.ts` — a trainer of Team A tries
      to read Team B's `players`, `point_entries`, `training_photos`,
      call `get_team_ranking(TeamB.id)`, download from
      `storage/<TeamB.id>/…` (SC-009).
  - CI: local Supabase via `supabase start` in the job; Playwright
    against `pnpm dev`.
- **Rationale**: Cross-team isolation is now a first-class success
  criterion (SC-009) and gets its own negative-test file.

## R14: Deployment target

- **Decision**: Vercel (Nuxt) + Supabase Cloud (Postgres/Auth/Storage).
  Closes constitution `TODO(DEPLOYMENT_TARGET)`.
- **Rationale**: Unchanged from Round 1; multi-tenancy doesn't change
  the hosting recommendation.

---

## Open items (deferred to /speckit-tasks or planning refinement)

- **Concurrent-edit conflicts**: default last-write-wins with
  `last_updated_at`/`last_updated_by` visible in the training editor.
  No optimistic locking in v1.
- **Season-Grenze per team**: `settings.season_start` becomes
  `team_settings.season_start` (per team). Trainer-only edit UI in
  `/t/<slug>/team/settings.vue`.
- **Rate-limiting** on public routes: rely on Supabase's built-in
  rate-limits for `get_public_ranking` invocations in v1; revisit if
  abuse observed.
- **Backup**: Supabase Cloud daily backups on Pro tier.
- **GDPR right-to-erasure across teams**: when a user deletes their
  account (via a future button; not in v1 UI), the DB should keep
  historical `point_entries` referencing them as `linked_user_id = null`
  (already covered by `on delete set null`).
