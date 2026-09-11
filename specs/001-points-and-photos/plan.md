# Implementation Plan: Trainingspunkte & Trainingsfotos (v1, Multi-Tenant)

**Branch**: `001-points-and-photos` | **Date**: 2026-09-10 (Round 2) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-points-and-photos/spec.md`

## Summary

Multi-tenant internal web app: any user can sign up (magic-link,
passwordless), found a team, and manage its point categories, players,
trainings, photos, and evaluations. Trainers invite additional users
into their team as either coach or player; players have per-team read
access to rankings, their own progress, and photos. A team-scoped
anonymous public ranking (jersey numbers only) is available under a
per-team URL. Backend is Supabase; frontend is Nuxt 3 with shadcn-vue,
mobile-first. All access control is enforced in the database via RLS
that joins the requester's memberships against the row's `team_id`.

## Technical Context

**Language/Version**: TypeScript 5.6+, strict mode; Node.js 22 LTS.
**Primary Dependencies**: Nuxt 3.13+, `@nuxtjs/supabase`, shadcn-vue,
Tailwind CSS 3.4+, `@supabase/supabase-js` v2, `@vueuse/core`, `zod`
(input validation), `@unovis/vue` + `@unovis/ts` (charts via
shadcn-vue Chart component), `slug` (deterministic slug generation).
**Storage**: PostgreSQL 15 (Supabase-managed) with RLS on every table;
Supabase Storage bucket `training-photos` keyed by
`<team_id>/<training_id>/<uuid>.<ext>`.
**Testing**: Vitest (unit + component); Playwright (E2E) including a
cross-team RLS negative-test matrix (SC-003, SC-008, SC-009).
**Target Platform**: Web app; mobile Safari + Chrome primary, desktop
secondary; PWA-ready ("Add to Home Screen").
**Project Type**: Web application (single Nuxt project + co-located
`supabase/` schema folder).
**Performance Goals**: SC-001 (2 min per training entry), SC-002
(5 s player dashboard), SC-010 (3 min signup-to-team-founded).
Cold page load ≤3 s on emulated 4G.
**Constraints**: RLS mandatory on every table before ship; no
password-based login; no cross-team data leak (SC-009); no `any` in
TypeScript except with inline justification.
**Scale/Scope**: v1 is multi-tenant but still small: expect ≤50 teams,
≤50 members per team, ≤200 trainings/team/year, ≤20 photos/training,
≤5 GB total storage in first year across all tenants combined.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 ([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)).

| Principle | Gate | Status |
|---|---|---|
| **I. Simplicity First** (NON-NEGOTIABLE) | No abstractions beyond the current requirement; single Nuxt project; Supabase used directly; no state manager unless a real cross-view need appears. | ✅ Pass. Multi-tenant model justified by explicit user requirement; no extra service layer; direct `useSupabaseClient` composables; team context lives in URL + a lightweight `useTeamContext` composable, not in a global store. |
| **II. Role-Based Access via Supabase RLS** (NON-NEGOTIABLE) | Every table has RLS + at least one policy; Storage bucket policies match; anonymous public ranking served only via a dedicated view/function. Cross-team access is denied by policy, not by app-layer filter. | ✅ Pass. Every team-scoped table joins `memberships` in its policies via `public.is_member(team_id)` and `public.is_trainer(team_id)` helpers. Storage bucket path is team-prefixed and policy asserts membership plus saved-training visibility. Anonymous ranking uses a narrowly projected `SECURITY DEFINER` function owned by a constrained read-only role. Detailed contract in [contracts/rls-policies.md](./contracts/rls-policies.md). |
| **III. Konfigurierbare Punktekategorien** | Categories live as data, editable per team without deploy. | ✅ Pass. `point_categories` is a table scoped by `team_id`; trainer-only CRUD UI. |
| **IV. Mobile-First UX** | Mobile-first Tailwind, ≥44px touch targets, primary flow works on portrait mobile. | ✅ Pass. Design starts at 360×640; grid + team selector + magic-link flow verified on mobile emulation in Polish phase. |
| **V. Type Safety End-to-End** | Nuxt TS strict; Supabase types generated and committed; no `any` without justification. | ✅ Pass. `pnpm gen:types` after every schema-affecting migration; committed under `app/types/database.ts`. |

Additional constraints:

- **Tech Stack** (Nuxt + shadcn-vue + Supabase, German UI / English code): matched.
- **SPA vs SSR**: SSR (Nuxt universal). Magic-link callback is handled cleanly by `@nuxtjs/supabase` in SSR mode.
- **Migrations**: authored via `supabase migration new`, versioned under `supabase/migrations/`; every schema-affecting migration commits alongside regenerated `app/types/database.ts` and updated RLS policies.

**No violations. Complexity Tracking section intentionally empty.**

## Project Structure

### Documentation (this feature)

```text
specs/001-points-and-photos/
├── plan.md                  # This file (regenerated after Round-2 clarify)
├── spec.md                  # Feature specification (Round-2 baseline)
├── research.md              # Phase 0 output — technology and pattern decisions
├── data-model.md            # Phase 1 output — entities, columns, indexes, RLS helpers
├── quickstart.md            # Phase 1 output — dev bootstrap steps
├── contracts/
│   ├── rls-policies.md          # Per-table + Storage RLS policies + negative-test matrix
│   ├── public-ranking.md        # Public per-team ranking contract
│   ├── auth-flows.md            # Magic-link, onboarding, team-invite flows
│   └── ui-flows.md              # Screen-level UI contracts per US
├── checklists/
│   └── requirements.md
└── tasks.md                 # Phase 2 output (regenerated by /speckit-tasks after this plan)
```

### Source Code (repository root)

```text
app/
├── components/
│   ├── ui/                       # shadcn-vue primitives (button, input, dialog, alert…)
│   ├── auth/                     # LoginMagicLink, OnboardingWizard, TeamCreateForm, InvitationAcceptCard
│   ├── team/                     # TeamSwitcher, MembershipTable, InviteForm, InviteList
│   ├── trainings/                # TrainingPointGrid, TrainingPhotoUpload, ConsentWarningBanner, TrainingPhotoGallery
│   ├── players/                  # PlayerList, PlayerForm, ConsentToggle
│   ├── categories/               # CategoryList, CategoryForm
│   └── stats/                    # RankingTable, PlayerProgressChart, TimeframePicker
├── composables/
│   ├── useTeamContext.ts         # current team from URL; list of memberships
│   ├── useAuth.ts                # sign-in via magic-link, sign-out, invitation-token consumption
│   ├── useTeams.ts               # create team, list my teams
│   ├── useMemberships.ts         # per-team member CRUD (trainer-only)
│   ├── useInvitations.ts         # issue, list, revoke, accept
│   ├── usePlayers.ts
│   ├── useCategories.ts
│   ├── useTrainings.ts
│   ├── useTrainingPhotos.ts
│   ├── useRanking.ts
│   ├── usePlayerScores.ts
│   ├── usePublicRanking.ts       # anon-safe fetch, takes team slug
│   └── useTimeframe.ts
├── layouts/
│   ├── default.vue               # authenticated shell, requires membership; includes TeamSwitcher
│   ├── onboarding.vue            # authenticated but no membership yet — shown for /start
│   └── public.vue                # anonymous shell for /public/**
├── middleware/
│   ├── auth.global.ts            # allow /login, /public/**, /invite/:token; else require session
│   ├── team-context.ts           # for /t/:slug/**, verify membership else redirect to /start
│   └── trainer-only.ts           # deny non-trainer memberships on trainer routes
├── pages/
│   ├── index.vue                 # role-aware landing: session → /t/:lastSlug; else /login
│   ├── login.vue                 # magic-link request form
│   ├── callback.vue              # magic-link + invite-token landing (Supabase auth callback)
│   ├── start.vue                 # signed-in but no membership: "Team gründen" | "Einladung annehmen"
│   ├── invite/[token].vue        # invitation preview + accept
│   ├── t/
│   │   └── [slug]/
│   │       ├── index.vue                 # role-aware landing inside team
│   │       ├── dashboard.vue             # player dashboard
│   │       ├── ranking.vue               # authenticated team ranking
│   │       ├── trainings/
│   │       │   ├── index.vue
│   │       │   ├── new.vue               # trainer only
│   │       │   └── [id].vue
│   │       ├── players/
│   │       │   ├── index.vue             # trainer only
│   │       │   └── [id].vue
│   │       ├── categories/
│   │       │   └── index.vue             # trainer only
│   │       └── team/
│   │           ├── members.vue           # trainer only (Memberships + Invitations)
│   │           └── settings.vue          # trainer only (name, slug, season_start)
│   └── public/
│       └── [slug]/
│           └── ranking.vue                # anonymous public ranking per team
├── plugins/
│   └── supabase.client.ts        # only if bespoke wiring needed
├── server/
│   └── api/
│       ├── invitations/
│       │   └── issue.post.ts     # trainer-only; uses service role to send magic-link email
│       └── teams/
│           └── create.post.ts    # generates a unique slug, creates team + first Trainer-Membership atomically
└── types/
    └── database.ts               # generated by `pnpm gen:types`

supabase/
├── config.toml
├── migrations/                   # authored per phase, RLS + types committed together
└── seed.sql                      # local dev only: sample teams and users for e2e

tests/
├── e2e/
│   ├── onboarding.spec.ts             # US0: signup → team-create + accept-invitation
│   ├── trainer-flow.spec.ts           # US1
│   ├── player-flow.spec.ts            # US2
│   ├── categories-flow.spec.ts        # US3
│   ├── players-flow.spec.ts           # US4
│   ├── public-anon.spec.ts            # US5
│   ├── photos-flow.spec.ts            # US6
│   ├── rls-negative-single-team.spec.ts   # SC-003
│   └── rls-negative-cross-team.spec.ts    # SC-009
└── unit/
    ├── ranking.spec.ts
    ├── slug.spec.ts
    └── validators.spec.ts

nuxt.config.ts
tailwind.config.ts
components.json
package.json
pnpm-lock.yaml
tsconfig.json
```

**Structure Decision**: Single Nuxt project with a co-located
`supabase/` schema folder — same as Round 1 — because Supabase remains
the backend. Team-scoped routes live under `/t/[slug]/…`; onboarding
routes live outside the team context so pre-membership users can access
them. `server/api/` gains two thin routes — `/api/invitations/issue`
and `/api/teams/create` — that use isolated server credentials only where
needed (sending a magic-link email); team creation validates the browser
session and delegates the team plus first Trainer-Membership insert to one
transactional database function. Nothing else moves off Supabase.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*None. All gates pass under the new multi-tenant scope.*
