<!--
Sync Impact Report
==================
Version change: (initial) → 1.0.0
Bump rationale: Initial ratification of the ifa-board constitution.

Modified principles: N/A (initial adoption of 5 principles)

Added sections:
- Core Principles (I. Simplicity First, II. Role-Based Access via Supabase RLS,
  III. Konfigurierbare Punktekategorien, IV. Mobile-First UX,
  V. Type Safety End-to-End)
- Technology Stack & Constraints
- Development Workflow
- Governance

Removed sections: none

Templates requiring updates:
- .specify/templates/plan-template.md ⚠ pending — the "Constitution Check" section
  is a generic placeholder; when the first feature plan is generated it MUST be
  populated with concrete gates derived from Principles I–V. No structural change
  to the template file itself is required at this time.
- .specify/templates/spec-template.md ✅ aligned — no principle-specific fields
  required.
- .specify/templates/tasks-template.md ✅ aligned — no principle-driven task
  category changes required (testing tasks remain OPTIONAL per template).
- .claude/skills/speckit-*/SKILL.md ✅ aligned — no agent-specific guidance
  conflicts with the new principles.

Follow-up TODOs:
- TODO(DEPLOYMENT_TARGET): Frontend hosting target is currently placeholder
  (Vercel/Netlify candidates); decide before the first production deploy.
-->

# ifa-board Constitution

## Core Principles

### I. Simplicity First (NON-NEGOTIABLE)

ifa-board is a small internal application for a single football team. Every
feature, abstraction, dependency, and configuration surface MUST be justified by
a concrete, present-day need. Speculative flexibility, premature abstraction,
and generalization beyond the current requirement are prohibited. When a simpler
solution meets the requirement, the simpler solution MUST be chosen.

Rationale: The user base is bounded (coaches plus one squad of players), there
are no commercial obligations, and maintenance happens on the side. Complexity
compounds maintenance cost far faster than it compounds value here.

### II. Role-Based Access via Supabase RLS (NON-NEGOTIABLE)

Access control MUST be enforced at the database layer via Supabase Row Level
Security. Frontend-only checks are not sufficient. Two roles are defined:

- `trainer`: read and write access to trainings, players, point categories,
  point entries, and training photos.
- `player`: read-only access; detail data MAY be further restricted to the
  player's own records where applicable.

Every table MUST have RLS enabled and at least one policy defined before it
ships to any environment reachable from the internet. No table ships with RLS
disabled. Storage buckets holding training photos MUST enforce the same role
model.

Rationale: Frontend checks are trivially bypassed via direct API calls.
Evaluation data about minors MUST NOT be exposed by an API bypass.

### III. Konfigurierbare Punktekategorien

Point categories (e.g., training performance, fairness, attendance) MUST be
stored as data in the database, not hard-coded in application code. Trainers
MUST be able to create, rename, and deactivate categories without a code change
or deploy. Category metadata (name, active flag, sort order, allowed value
range) lives with the row.

Rationale: Category definitions will evolve during the season. Requiring a
deploy for a rename or a new category is disproportionate for this team.

### IV. Mobile-First UX

All user-facing views MUST be designed primarily for smartphone screens
(≥360px width, portrait orientation) and MUST remain usable on that form
factor. The point-entry flow for trainers is the highest-priority mobile
target. Touch targets MUST be ≥44px on the primary tap axis. Desktop layouts
are a secondary concern and MAY simply widen the mobile layout.

Rationale: Trainers enter points during or immediately after training on the
pitch, where a laptop is not available.

### V. Type Safety End-to-End

TypeScript strict mode MUST be enabled across the entire frontend. Supabase
database types MUST be generated with `supabase gen types typescript` and
checked into the repository; regeneration is required whenever the schema
changes. Use of `any` is prohibited except in narrowly scoped, documented
exceptions (each MUST carry an inline comment explaining why).

Rationale: Two roles with different permitted operations raise the risk of
data-access mistakes. The compiler is the cheapest place to catch them.

## Technology Stack & Constraints

- **Frontend**: Nuxt 3 with shadcn-vue components, Tailwind CSS, TypeScript
  in strict mode.
- **Backend**: Supabase — PostgreSQL, Supabase Auth, Supabase Storage (for
  training photos), Row Level Security.
- **Languages**: UI copy in German. Code, commit messages, technical
  documentation (including this constitution and all spec/plan/task
  artifacts) in English.
- **Photos**: Stored in Supabase Storage buckets; access governed by RLS
  policies consistent with Principle II.
- **Database migrations**: MUST be authored as Supabase migrations, versioned
  under `supabase/migrations/`, and reviewed together with any RLS policy
  changes.
- **Rendering mode**: SPA rendering is acceptable when it simplifies the
  authentication story; SSR-only features SHOULD NOT be adopted if they
  complicate auth without a proportional benefit.
- **Deployment**: TODO(DEPLOYMENT_TARGET) — frontend hosting target
  (Vercel/Netlify likely candidates) to be decided before first production
  deploy. Supabase Cloud is the intended backend host.

## Development Workflow

- Spec-driven development via SpecKit is the standard workflow:
  `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`.
- Feature branches are auto-numbered by SpecKit as `###-feature-name`.
- Commit messages MUST be in English, kept short and imperative, and MUST NOT
  contain Claude/AI attribution lines (no "Generated with", no
  "Co-Authored-By: Claude").
- Every PR/merge that adds or modifies a table MUST include the corresponding
  RLS policy changes in the same change set; reviewers MUST confirm this
  before merge.
- Supabase generated types MUST be regenerated and committed in the same PR
  as any schema-affecting migration.

## Governance

This constitution supersedes ad-hoc decisions and personal preference. All
PRs and reviews MUST verify compliance with the five Core Principles above,
in particular Principles I and II which are NON-NEGOTIABLE.

Additional complexity — a new abstraction layer, an extra service, a second
frontend framework, a caching tier, and similar — MUST be explicitly
justified in the plan document under the "Complexity Tracking" section
before it is introduced.

Amendments to this constitution require:

1. A short rationale in the PR that changes `.specify/memory/constitution.md`.
2. A version bump following semantic versioning:
   - **MAJOR**: Backward-incompatible governance or principle removal or
     redefinition.
   - **MINOR**: New principle or section added; materially expanded guidance.
   - **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements.
3. A Sync Impact Report (HTML comment at the top of the constitution file)
   listing modified principles, added/removed sections, dependent templates
   requiring updates, and any deferred TODOs.
4. Update of dependent templates (`.specify/templates/plan-template.md`,
   `.specify/templates/spec-template.md`,
   `.specify/templates/tasks-template.md`) where the amendment affects them.

Runtime development guidance for AI agents lives in `CLAUDE.md` at the
repository root.

**Version**: 1.0.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
