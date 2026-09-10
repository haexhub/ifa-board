# Quickstart: ifa-board dev environment

**Feature**: 001-points-and-photos
**Date**: 2026-09-10

Bootstrap the app locally end-to-end: Nuxt frontend + Supabase backend
(local Docker) + seed data. Assumes you have a fresh clone of the
repository and no prior state.

## Prerequisites

- **Node.js 22 LTS** (`nvm install 22 && nvm use 22`)
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** (for local Supabase)
- **Supabase CLI** (`brew install supabase/tap/supabase` or download binary)

## One-time setup

```bash
# 1. Install app dependencies
pnpm install

# 2. Start local Supabase (Postgres + Auth + Studio on 54321, 54322, 54323)
supabase start

# 3. Apply migrations + seed data
supabase db reset            # drops local DB and re-applies migrations + seed

# 4. Generate typed database bindings
pnpm gen:types               # writes app/types/database.ts

# 5. Set environment variables
cp .env.example .env
# The values printed by `supabase start` fill NUXT_PUBLIC_SUPABASE_URL
# and NUXT_PUBLIC_SUPABASE_ANON_KEY; the service_role key goes into
# NUXT_SUPABASE_SERVICE_ROLE_KEY (server-only).

# 6. Run the dev server
pnpm dev                     # http://localhost:3000
```

## Creating the initial trainer account

The seed does **not** insert an auth user. Create the first trainer
manually via the local Supabase Studio:

1. Open `http://localhost:54323` (Supabase Studio).
2. Authentication → Users → "Add user" → enter email + password.
3. In SQL Editor:
   ```sql
   insert into public.user_profiles (id, role, display_name)
   values ('<paste-user-id>', 'trainer', 'Initial Trainer');
   ```
4. Log in at `http://localhost:3000/login` with those credentials.

For local subsequent trainers / players, use the in-app "Einladen"
buttons on the Players and (planned) Team-Admin pages once logged in as
trainer.

## Running the test suites

```bash
pnpm test:unit               # Vitest — pure logic + component tests
pnpm test:e2e                # Playwright against local Supabase
```

Playwright config boots the dev server, resets the DB, seeds a known
trainer + player pair, and runs the scenarios (US1..US6 + RLS negative
matrix in `contracts/rls-policies.md`).

## Deploying to production (later, after MVP)

Target: Vercel (Nuxt) + Supabase Cloud (Postgres/Auth/Storage).

Outline (not part of the MVP task list — captured here so it's not lost):

1. Create a Supabase Cloud project; note its URL + anon key + service
   role key.
2. `supabase link --project-ref <ref>` locally.
3. `supabase db push` to apply migrations to Cloud.
4. Generate the initial admin trainer via Cloud SQL Editor (same steps
   as local, but against Cloud).
5. Create a Vercel project pointing at this repo; set the same
   environment variables (`NUXT_PUBLIC_SUPABASE_URL`,
   `NUXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NUXT_SUPABASE_SERVICE_ROLE_KEY`).
6. First deploy: main branch → production; PRs → preview URLs. Preview
   URLs use the same Supabase Cloud project (all envs share the DB in
   v1 — acceptable for a small team; separate `staging` project can be
   added later if needed).

## Common commands

```bash
supabase migration new <slug>   # start a new SQL migration
supabase db reset               # reapply migrations + seed locally
pnpm gen:types                  # regenerate app/types/database.ts
pnpm lint                       # eslint + prettier
pnpm typecheck                  # tsc --noEmit
```

Migrations MUST be committed together with the regenerated
`app/types/database.ts` (Constitution Principle V).
