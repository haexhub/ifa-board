# Research: Trainingspunkte & Trainingsfotos

**Feature**: 001-points-and-photos
**Date**: 2026-09-10
**Purpose**: Resolve open technology choices before design. Each entry is a
locked decision unless later research overturns it explicitly.

---

## R1: Nuxt rendering mode (SSR vs SPA)

- **Decision**: Nuxt 3 in universal (SSR) mode.
- **Rationale**:
  - `@nuxtjs/supabase` handles cookie-based server session out of the box;
    server routes see the authenticated user without duplicated logic.
  - The anonymous public ranking benefits from SSR: single request → HTML
    → cheap for search engines and link previews, no auth roundtrip.
  - Mobile-first performance: server-rendered HTML paints faster on slow
    connections than an SPA that must boot and then fetch.
- **Alternatives considered**:
  - **SPA (`ssr: false`)**: simpler for authenticated flows but hurts the
    public view's first paint and eliminates one Constitution benefit
    (SSR-served public ranking). Kept as fallback if server auth bugs
    prove costly — the flip is a single config line.
  - **Static (`nuxt generate`)**: rejected. Data changes constantly; every
    ranking view would need a rebuild.

## R2: Auth flow (trainer + player accounts)

- **Decision**: Supabase Auth via `@nuxtjs/supabase` module.
  - **Initial trainer account**: created manually in the Supabase Studio
    (email + password) — bootstrap step in [quickstart.md](./quickstart.md).
  - **Additional trainer accounts**: created by an existing trainer through
    a trainer-only UI page that calls `supabase.auth.admin.inviteUserByEmail`
    from a **server** route (needs service_role key, kept server-only).
  - **Player accounts**: same invite mechanism from the trainer UI. Sender
    picks an existing `players` row and issues an email invite; the
    resulting `auth.users` row is linked via `players.linked_user_id` on
    invite acceptance.
  - **Role storage**: `user_metadata.role = 'trainer' | 'player'`, set at
    invite time by the server route and mirrored into a
    `public.user_profiles` table so RLS policies can `join` without going
    through `auth.jwt()`.
- **Rationale**: Invites are the standard Supabase pattern; role in
  `user_metadata` is JWT-embedded and cheap to read in RLS via
  `(auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'`, but a
  `user_profiles` mirror lets us reference the role in foreign-key style
  and index it — simpler policies.
- **Alternatives considered**:
  - **Magic-link only, no invite**: rejected — trainers need to trigger
    onboarding rather than expecting players to self-signup.
  - **Custom JWT claims via `supabase.functions.serve`**: rejected as
    overkill; `user_metadata` handles this.

## R3: Player-to-account linking

- **Decision**: `players.linked_user_id uuid references auth.users(id) on
  delete set null unique`. Unique constraint enforces the 1:1 relation.
- **Rationale**: Matches spec (FR-005). `on delete set null` keeps history
  intact if an auth user is deleted.
- **Alternatives considered**:
  - Foreign key from `auth.users` → `players`: rejected — `auth.users` is
    Supabase-managed and shouldn't own an app FK.

## R4: Anonymous public ranking mechanism

- **Decision**: A single Postgres **view** named `public.public_ranking`
  that projects only `jersey_number`, `rank_position`, per-category
  aggregate scores, and the timeframe filter. `grant select on
  public.public_ranking to anon;`. Base tables remain fully RLS-locked
  and do NOT grant `anon`.
  - Timeframe: the view takes bound parameters via a `SECURITY INVOKER`
    wrapper function `public.get_public_ranking(from date, to date)`
    (`stable`, no user context) so the anon client can call
    `supabase.rpc('get_public_ranking', {from, to})`.
- **Rationale**:
  - Meets FR-062 (view schema is the ONLY thing anon can see).
  - Constitution Principle II is preserved: RLS on base tables stays,
    the view is the deliberate public surface.
  - Simpler than exposing a materialized view or a full REST endpoint.
- **Alternatives considered**:
  - **`SECURITY DEFINER` function**: rejected because it bypasses RLS —
    higher risk if the function is ever misused; view-based path is
    explicit about what leaves the DB.
  - **Nitro server route reading with service-role key**: rejected —
    puts sensitive key in the server bundle and duplicates the RLS
    surface.

## R5: Ranking calculation location

- **Decision**: Compute rank in SQL, expose two Postgres views:
  - `public.player_scores_by_category` — one row per (player, category,
    timeframe-bucket), SUM(value).
  - `public.team_ranking` — window-function ranking that implements the
    lexicographic-by-`category.sort_order` sort from FR-051; returns the
    same shape whether called via authenticated or anon path (the anon
    view above is a projection over this).
- **Rationale**:
  - Keeps the ranking rule in one place (SQL is the single source of
    truth), avoids re-implementing it in the browser.
  - Postgres window functions (`dense_rank() over (order by ...)`)
    handle ties per the standard sport ranking (1, 2, 2, 4) — matches
    spec edge case.
  - Client stays presentation-only.
- **Alternatives considered**:
  - **Client-side rank** in a composable: rejected — duplicated logic
    between authenticated and public paths.
  - **Materialized view** with periodic refresh: rejected as premature
    optimization for a team of ≤30 players.

## R6: Photo consent enforcement

- **Decision**:
  - `players.photo_consent boolean not null default false`.
  - Trainer UI shows a red warning list of no-consent active players
    whenever the photo uploader is opened.
  - Photos are served via a signed URL only from an authenticated page.
  - **Consent enforcement is per-training-photo, not per-face**: on the
    training detail page, if ANY currently active player in the team has
    `photo_consent = false`, photos of that training display a blurred
    thumbnail with a "Foto ausgeblendet – fehlende Einwilligung"
    overlay for `player` role viewers. Trainers always see the raw
    photo (they need to review what was uploaded). This matches spec A12.
- **Rationale**: Face detection is YAGNI; the coarse rule matches the
  spec's explicit assumption and is enforceable in the UI + a Postgres
  `security invoker` function that decides visibility.
- **Alternatives considered**:
  - **Face detection / redaction**: excluded per A12.
  - **Auto-blocking upload if any no-consent player exists**: rejected —
    trainer needs the flexibility to upload team-only training photos
    where no minor is depicted.

## R7: Chart library

- **Decision**: **shadcn-vue Chart** components, which wrap **Unovis**.
  Install `@unovis/vue` and `@unovis/ts`.
- **Rationale**:
  - Consistent design language with the rest of shadcn-vue.
  - Supports the two charts we actually need: line (player timeline per
    category) and bar (fallback for small-N samples).
  - No React dependency.
- **Alternatives considered**:
  - **Chart.js + vue-chartjs**: fine, but styling requires extra work to
    match shadcn-vue tokens.
  - **ECharts / ApexCharts**: heavier bundle for the small chart surface
    we need.

## R8: Migrations, type generation, seed workflow

- **Decision**:
  - Local dev: `supabase start` (Docker) → `supabase migration new
    <name>` → hand-edit SQL → `supabase db reset` for local schema
    rebuild.
  - Types: `supabase gen types typescript --local > app/types/database.ts`,
    committed together with the migration.
  - Seed: `supabase/seed.sql` inserts one default `point_categories`
    row ("Trainingsleistung", 0–5, active, sort_order 1), one demo
    trainer profile, and (in local dev only) a handful of demo players.
- **Rationale**: Matches Supabase-recommended workflow; keeps types in
  lockstep with schema (Principle V).
- **Alternatives considered**:
  - **Prisma or Drizzle** as a schema layer above Supabase: rejected —
    duplicates `pg_catalog` truth, complicates RLS visibility, breaks
    the direct `supabase-js` type flow.

## R9: Testing strategy

- **Decision**:
  - **Unit** (Vitest): pure logic — timeframe helpers, category-order
    comparator, form validators (zod schemas).
  - **Component** (Vitest + `@nuxt/test-utils`): render-level tests for
    the point-entry grid and the ranking table.
  - **E2E** (Playwright): one spec per user story (US1..US6) plus a
    dedicated `rls-negative.spec.ts` that logs in as `player`, attempts
    to write to `point_entries` / read others' photos via direct
    `supabase-js` calls, and asserts denial (delivers SC-003).
  - E2E runs against a **local Supabase stack** in CI (`supabase start`
    in the CI job), never against production.
- **Rationale**: Splits fast unit tests from slower e2e; RLS gets a
  first-class negative-test suite because Principle II is
  NON-NEGOTIABLE.
- **Alternatives considered**:
  - **Cypress**: fine choice, but Playwright's `test.describe.serial`
    and parallelism suit the small suite better.
  - **Only e2e**: rejected — slower feedback loop for logic changes.

## R10: Deployment target (RESOLVES `TODO(DEPLOYMENT_TARGET)`)

- **Decision**: **Vercel** for the Nuxt app, **Supabase Cloud** for
  Postgres/Auth/Storage.
  - Vercel free tier covers this app's traffic; deep Nuxt integration;
    per-PR preview deployments feed nicely into review.
  - Supabase Cloud (Free or Pro depending on storage growth); daily
    backups included on Pro.
- **Rationale**: Simplest supported combo for Nuxt + Supabase; no
  self-hosted infrastructure to babysit for a volunteer-run team app.
  Recommends the constitution TODO be closed with this decision.
- **Alternatives considered**:
  - **Netlify**: comparable to Vercel; Vercel picked for slightly
    better Nuxt tooling.
  - **Cloudflare Pages + Workers**: cheaper but Nuxt server routes are
    less smooth in the Workers runtime.
  - **Self-hosted (Fly.io + self-hosted Supabase)**: rejected as
    Principle-I violation for a small internal app.

## R11: Package manager

- **Decision**: **pnpm**.
- **Rationale**: Faster installs, lower disk usage, well-supported by
  Nuxt tooling and shadcn-vue CLI.

## R12: Input validation

- **Decision**: **zod** schemas co-located with forms.
- **Rationale**: Category `value_min`/`value_max`, jersey uniqueness
  (client-side pre-check), photo-file MIME type, and email invite input
  all need runtime checks even though the DB is authoritative. zod
  integrates with Nuxt forms and is small.
- **Alternatives considered**:
  - **Vee-Validate + yup**: comparable; zod chosen for the same reason
    Nuxt ecosystem does — better TypeScript inference.

---

## Open items (deferred to /speckit-tasks or later)

- **Rate limiting on the public ranking**: deferred. Team-scale traffic
  makes this non-critical; if the URL leaks widely, add
  `@nuxthub/ratelimit` or a Vercel edge middleware.
- **Season start date configurability**: a `settings` singleton table
  (`season_start date`) captured in data-model.md; UI to edit deferred
  until after MVP if trainers ask for it.
- **Concurrent-edit conflict resolution**: default **last-write-wins**
  with `last_updated_at`/`last_updated_by` shown on the training
  detail so trainers notice overwrites. No optimistic locking in v1.
- **Backup**: Supabase Cloud handles daily backups on Pro tier — no
  additional plan needed.
