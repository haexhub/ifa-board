# Implementation Plan: Trainingspunkte & Trainingsfotos

**Branch**: `001-points-and-photos` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-points-and-photos/spec.md`

## Summary

Internal single-team web app that lets coaches record training points across
configurable categories, upload training photos, and lets players view their
own progress plus the team ranking. An anonymous public ranking (jersey
numbers only) is accessible without login. Backend is Supabase (Postgres +
Auth + Storage + RLS); frontend is Nuxt 3 with shadcn-vue components,
mobile-first. All access control is enforced in the database via RLS.

## Technical Context

**Language/Version**: TypeScript 5.6+, strict mode; Node.js 22 LTS runtime.
**Primary Dependencies**: Nuxt 3.13+, `@nuxtjs/supabase`, shadcn-vue,
Tailwind CSS 3.4+, `@supabase/supabase-js` v2, `@vueuse/core`, `zod`
(input validation), a chart library (see research.md — leaning
`unovis` via shadcn-vue Chart component).
**Storage**: PostgreSQL 15 (Supabase-managed); Supabase Storage buckets for
training photos. Row Level Security (RLS) enabled on every table.
**Testing**: Vitest for unit/component tests; Playwright for end-to-end
scenarios that cover role-scoped RLS enforcement.
**Target Platform**: Web app; mobile Safari + Chrome (Android/iOS) as
primary target; desktop Chrome/Firefox/Safari as secondary. Progressive
enhancement, PWA-ready ("Add to Home Screen").
**Project Type**: Web application (single Nuxt project + `supabase/`
schema folder in the same repo).
**Performance Goals**: Cold page load ≤3 s on 4G mobile; first meaningful
paint of trainer point-entry form ≤2 s on cached load; entering points
for 15 players in 2 categories + photo upload completable in ≤2 min
end-to-end (SC-001); player dashboard rank + chart entry visible ≤5 s
after login on mobile (SC-002).
**Constraints**: No custom backend service beyond Supabase; RLS policies
mandatory before any table ships; SPA fallback acceptable only if SSR
adds meaningful complexity to auth flow (per Constitution Tech Stack).
No `any` in TypeScript except with inline justification.
**Scale/Scope**: v1 = 1 team, ≤30 active players, ≤5 categories,
≤200 trainings/year, ≤20 photos/training. Estimated total storage
after 1 season: <5 GB. Concurrent users: single-digit (few coaches +
squad size).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 (`.specify/memory/constitution.md`).

| Principle | Gate | Status |
|---|---|---|
| **I. Simplicity First** (NON-NEGOTIABLE) | No abstractions beyond the current requirement. Single Nuxt project. Supabase used directly (no repository/service layer wrapping it). No state manager unless a real cross-view need appears. | ✅ Pass. Direct `useSupabaseClient` composables; no Pinia store planned for v1; single feature-branch project structure. |
| **II. Role-Based Access via Supabase RLS** (NON-NEGOTIABLE) | Every table has RLS ON + at least one policy before shipping; Storage buckets have matching policies; anonymous public ranking is served exclusively via a dedicated read-only Postgres view or `SECURITY DEFINER` function with narrow output schema. | ✅ Pass. RLS design captured in [contracts/rls-policies.md](./contracts/rls-policies.md). Public ranking via a read-only `public_ranking` view with `grant select ... to anon`. Storage bucket `training-photos` policy denies `anon`. |
| **III. Konfigurierbare Punktekategorien** | `point_categories` is a table (not code). Trainers CRUD categories via UI without deploy. | ✅ Pass. Table + UI planned; seed inserts a minimal "Trainingsleistung" row. |
| **IV. Mobile-First UX** | Layouts designed mobile-first (≥360px), touch targets ≥44px, primary flow (point entry) works on portrait mobile. | ✅ Pass. Tailwind mobile-first breakpoints; component spec notes ≥44px min-height on interactive controls. |
| **V. Type Safety End-to-End** | Nuxt TS strict; Supabase types generated (`supabase gen types typescript`) and committed under `types/database.ts`; no `any` without an inline justification comment. | ✅ Pass. `nuxt.config.ts` sets `typescript.strict = true`; `pnpm gen:types` script wires generation; CI would run `tsc --noEmit`. |

Additional Constitution constraints:

- **Tech Stack** (Nuxt + shadcn-vue + Supabase + Tailwind, German UI/English
  code): matched by dependencies above; German copy captured in Vue templates
  and enum labels; code, comments, and commits in English.
- **SPA vs SSR**: default SSR (Nuxt universal mode) via `@nuxtjs/supabase`.
  The module handles cookie-based server session, which serves both the
  logged-in flows and the anonymous public ranking cleanly. If auth
  complications emerge later, we drop to SPA (`ssr: false`) — this is a
  one-line change and no code rewrite (see research.md).
- **DB migrations**: authored via `supabase migration new`, versioned under
  `supabase/migrations/`; every schema-touching migration includes the
  matching RLS policy changes and triggers type regeneration in the same
  commit.

**No violations. Complexity Tracking section intentionally empty.**

## Project Structure

### Documentation (this feature)

```text
specs/001-points-and-photos/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — technology decisions
├── data-model.md        # Phase 1 output — entities, columns, indexes
├── quickstart.md        # Phase 1 output — dev bootstrap steps
├── contracts/
│   ├── rls-policies.md      # RLS policy summary per table + Storage
│   ├── public-ranking.md    # Public read-only view contract (anon)
│   └── ui-flows.md          # Screen-level UI contracts for MVP flows
├── checklists/
│   └── requirements.md      # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── components/
│   ├── ui/                  # shadcn-vue primitives (button, input, dialog…)
│   ├── trainings/           # TrainingPointGrid, TrainingPhotoUpload, …
│   ├── players/             # PlayerList, PlayerForm, ConsentToggle, …
│   ├── categories/          # CategoryList, CategoryForm, …
│   └── stats/               # RankingTable, PlayerProgressChart, …
├── composables/
│   ├── useTeamSession.ts    # role + user helpers on top of useSupabaseUser
│   ├── useTrainings.ts      # CRUD hooks for trainings + entries
│   ├── usePlayers.ts
│   ├── useCategories.ts
│   ├── useRanking.ts
│   └── usePublicRanking.ts  # anon-safe fetch (no session required)
├── layouts/
│   ├── default.vue          # authenticated shell
│   └── public.vue           # anonymous public ranking shell
├── middleware/
│   ├── auth.global.ts       # redirect unauthenticated to /login (except /public/**)
│   └── trainer-only.ts      # deny non-trainers on trainer routes
├── pages/
│   ├── index.vue            # role-aware landing (redirects)
│   ├── login.vue
│   ├── dashboard/
│   │   └── index.vue        # player dashboard (rank + chart entry)
│   ├── trainings/
│   │   ├── index.vue        # list
│   │   ├── new.vue          # trainer: create training + entries
│   │   └── [id].vue         # detail: view/edit
│   ├── players/
│   │   ├── index.vue        # trainer: player list + CRUD
│   │   └── [id].vue         # detail: personal progress
│   ├── categories/
│   │   └── index.vue        # trainer: category management
│   ├── ranking/
│   │   └── index.vue        # team ranking (authenticated)
│   └── public/
│       └── ranking.vue      # anon route — jersey numbers only
├── plugins/
│   └── supabase.client.ts   # only if bespoke wiring needed beyond module
├── server/
│   └── api/                 # thin — only if a task truly cannot be done in RLS
└── types/
    └── database.ts          # generated with `pnpm gen:types`

supabase/
├── config.toml
├── migrations/              # e.g. 20260910120000_init_schema.sql, 20260910120500_rls.sql
└── seed.sql                 # dev seed: 1 category, sample players

tests/
├── e2e/
│   ├── trainer-flow.spec.ts     # US1: create training + entries + photo
│   ├── player-flow.spec.ts      # US2: rank + chart
│   ├── categories-flow.spec.ts  # US3
│   ├── players-flow.spec.ts     # US4
│   ├── public-anon.spec.ts      # US5: no PII leaks
│   └── rls-negative.spec.ts     # SC-003: role bypass attempts
└── unit/
    └── ranking.spec.ts           # ranking SQL / composable unit tests

nuxt.config.ts
tailwind.config.ts
components.json               # shadcn-vue registry
package.json
pnpm-lock.yaml
tsconfig.json
```

**Structure Decision**: **Single Nuxt project** with a co-located
`supabase/` schema folder. Not "web app split (backend/frontend)" because
Supabase IS the backend — introducing a separate backend service would
add a service to justify against Principle I with no compensating value.
`server/api/` remains available for the rare case a task cannot be
expressed via RLS + `@supabase/supabase-js` (not expected in v1).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*None. All gates pass.*
