# Phase 0 Research: Veo-Kamera-Analytics

All items below were unresolved in the initial Technical Context. Each is
recorded as Decision / Rationale / Alternatives considered.

## 1. Where does the periodic sync run?

**Decision**: A new Nitro server route, `POST /api/veo/sync`, triggered by an
OS-level cron entry on the existing production VPS (`curl` with a shared
secret, once daily).

**Rationale**: The repo has no scheduling mechanism at all today — no
node-cron, no in-process timer, no systemd timer (confirmed by repo-wide
search). The app already runs as a single long-lived Node process
(`node .output/server/index.mjs`) on a self-hosted VPS (constitution:
"no third-party PaaS"). A plain cron entry calling a protected HTTP route is
the smallest possible addition: no new npm dependency, no new always-on
in-process timer, and the route itself follows the exact shape already used
for other privileged actions (`app/server/api/invitations/issue.post.ts`,
`app/server/api/profile/moderate.post.ts`).

**Alternatives considered**:
- *In-process scheduler (e.g. a timer started on server boot)* — rejected:
  adds a persistent background timer inside what is otherwise a stateless,
  per-request server; harder to trigger manually/observe than a plain HTTP
  route; no existing precedent in this codebase.
- *Standalone script run directly by cron, bypassing Nuxt* — rejected:
  would duplicate the DB-connection and auth-check plumbing that already
  lives in `app/server/utils/db.ts`, instead of reusing it.
- *Supabase Edge Function on a schedule* — rejected: introduces a second
  deployment target/runtime (Deno, Supabase-hosted) the project does not use
  anywhere else. The constitution's deployment section is explicit that this
  app is self-hosted on a VPS behind a reverse proxy; Supabase is only used
  for Postgres/Auth/Storage. Adding Edge Functions would be a new
  abstraction with no present-day need — direct violation of Principle I.

## 2. Authenticating the cron caller

**Decision**: `POST /api/veo/sync` requires a shared-secret bearer header,
compared against `runtimeConfig.veoSyncSecret` (`NUXT_VEO_SYNC_SECRET`).
Requests without a matching header get `401` before any work happens.

**Rationale**: The existing privileged-route pattern
(`serverSupabaseUser(event)` + membership/role lookup) assumes an
interactive, logged-in human. The cron caller is a machine with no Supabase
session. A single static shared secret is the simplest mechanism that still
keeps the route unreachable by the public internet; it mirrors how the route
itself then uses `useAdminDb()` (server-trusted, RLS-bypassing) exactly like
the two existing privileged routes.

**Alternatives considered**: mTLS / IP allowlisting at the reverse-proxy
level — rejected as unnecessary extra infra for a single internal cron call;
a shared secret is the smallest sufficient control here, and the reverse
proxy is outside this repo's scope.

## 3. Veo authentication strategy

**Decision**: Primary approach is *silent session renewal*: a one-time
interactive login (done once, outside of production, by a human) captures
the `auth.veo.co` session artifact; the sync route replays it against
`auth.veo.co/oidc/auth?...&prompt=none` (standard OIDC silent-auth) to mint a
fresh ~1h access token on every run, then calls
`app.veo.co/api/app/matches/` and `app.veo.co/api/app/analysis/stats/`
directly with that token. No password is stored anywhere in this system.

**Evidence**: A live probe against `auth.veo.co/oidc/auth` with
`prompt=none` and a valid existing browser session returned a fresh
authorization `code` without showing any login form — confirming the
session-cookie-based silent-auth path is accepted by Veo's identity
provider. Full round-trip token minting was not completed live (blocked by
this project's own tooling safety guardrails against live credential
exchange in a chat session) but is a standard, well-understood OIDC flow to
implement and test as ordinary reviewed code.

**Fallback (documented, not built for v1)**: if the `auth.veo.co` session
turns out to be too short-lived in practice (discovered via
`veo_sync_status.consecutive_failures` staying elevated after a credential
refresh), fall back to a scheduled headless-browser login (e.g. Playwright
in a small separate job) that re-authenticates with stored credentials and
extracts a fresh bearer token from network traffic — mirroring the manual
research done for this feature. Not implemented now: would add a
Chromium-capable runtime this project's Node/Nitro deployment does not have,
and is only worth the added complexity if Decision 3's primary approach is
proven insufficient in production.

**Risk accepted**: both `app.veo.co/api/app/...` (used here) and the
documented `api.veo.co` partner API are outside any support/versioning
guarantee for this project — the private one used here even more so, since
it is Veo's undocumented internal frontend API, not even the invite-only
partner API. Mitigated by: fail-closed sync (never fabricate data, FR-007),
and visible sync-status surfacing (FR-009/User Story 3) so breakage is
noticed within a day, not silently.

## 4. Credential storage

**Decision**: The captured `auth.veo.co` session artifact is stored in a new
table, `veo_sync_credentials`, with RLS enabled and **no policies at all**
for `authenticated`/`anon` — readable/writable only via `useAdminDb()`
(server-trusted, RLS-bypassing), exactly the same trust boundary already
used for `teams_insert_via_server` (service_role-only write, no policy for
any other role).

**Rationale**: Per explicit decision earlier in this project's brainstorming
session, the credential must never live in `.env`/the repository. A
service_role-only DB row reuses an access-control mechanism the project
already has (RLS) instead of introducing a new one (e.g. Supabase Vault,
external secret manager), and — unlike a static env var — can be rotated by
re-running the one-time capture step and updating one row, without a
redeploy.

**Alternatives considered**: `runtimeConfig` env var — rejected as the
explicit anti-pattern this plan is meant to avoid (redeploy-to-rotate,
higher risk of ending up in a committed `.env`). Supabase Vault — rejected
as a new mechanism this project does not otherwise use, when RLS already
provides an equivalent trust boundary (Principle I: no new abstraction
without present-day need beyond what RLS already gives us).

## 5. Team mapping (Veo team ↔ Playerboard team)

**Decision** (superseded during `/speckit.clarify` — see spec.md's
Clarifications, FR-011/FR-013, User Story 4): the mapping is a database
table, `veo_team_mappings`, not fixed `runtimeConfig` values. RLS is enabled
with **zero** policies — the same service_role-only shape as
`veo_sync_credentials` — since for this feature's own scope, nothing in the
client-facing app reads or writes it directly.

**Rationale**: A club-internal security requirement emerged during
clarification: a team MUST NOT see Veo data without an explicit, deliberate
enablement decision — not something derivable from a single fixed
deployment config that's easy to lose track of. That decision must be made
by a *platform admin* (a cross-team authority this app does not yet have —
see the "Platform-admin UI sequencing" note below). A database table is the
correct home for an admin-managed, potentially-multi-row setting per
Principle III's precedent (config lives in data, not code) — this is no
longer speculative, it's an explicit requirement.

**Platform-admin UI sequencing (important scope boundary)**: this feature
does **not** build a platform-admin role or a settings UI — that's the
separate, vorgelagerte feature "Platform-Administration" (spec.md's
Assumptions). For v1, the one row in `veo_team_mappings` is created directly
via SQL by the person operating the deployment (documented in
[quickstart.md](./quickstart.md), same pattern as the one-time credential
capture in [§4](#4-credential-storage)) — not through any in-app UI or role
check. This satisfies FR-011's security requirement immediately (no team
gets a row without a deliberate manual action) without building a role
system this feature doesn't otherwise need. When "Platform-Administration"
ships, it adds a `platform_admins` table/role and a settings page that reads
and writes this *same* table through the app instead of raw SQL — the only
follow-up change needed then is one additional RLS write policy scoped to
that role; `veo_matches`/`veo_match_stats`/`veo_sync_status` and the sync
route itself do not change at all.

**Alternatives considered**: three fixed `runtimeConfig` values (the
original v1 plan, before this clarification) — rejected once the explicit
"platform-admin must control this" requirement emerged, since an env var
is redeploy-only and doesn't fit "an admin deliberately enables a team,"
and doesn't set up cleanly for the follow-on admin UI. Building the full
platform-admin role *now*, inside this feature — rejected: bigger than this
feature's own scope, reusable well beyond Veo, and not needed to satisfy
the actual security requirement today (a manual DB row already does).

## 6. Season aggregation (User Story 2)

**Decision**: Computed on-the-fly by querying `veo_matches` +
`veo_match_stats` for the team, not maintained as a separate precomputed
table.

**Rationale**: Data volume is tiny (one team, tens of matches per season,
~28 stat rows per match) — aggregating at read time is cheap and always
consistent with the underlying rows, with none of the invalidation
complexity a materialized rollup would add. Simplicity First default:
prefer the boring query over a caching/precomputation layer with no present
performance need.

## 7. Idempotent upserts

**Decision**: `veo_matches` is keyed by Veo's own globally-unique match
identifier (`veo_match_id`, unique index); `veo_match_stats` uses a
composite primary key (`match_id`, `team_association`, `stat_type`). Both
upserts use `ON CONFLICT ... DO UPDATE`.

**Rationale**: Matches FR-008 (no duplicate/contradictory rows on repeated
or overlapping sync runs) at the schema level rather than relying on
application-level de-duplication logic.

## 8. Testing strategy for the external integration

**Decision**: The Veo HTTP payload → schema mapping (`mapStats.ts`) is a
pure function, unit-tested with fixture payloads captured during this
feature's research (the real `POST .../analysis/stats/` response shape
observed live). The e2e suite seeds `veo_matches`/`veo_match_stats`/
`veo_sync_status` directly in the test database and verifies the display
pages and the sync-status banner — it does not call the live Veo API.

**Rationale**: There is no sandbox/test Veo account, and the API is
undocumented and could change; a CI test that depends on live Veo would be
flaky and unrelated to this project's own correctness. Unit-testing the pure
mapping function against captured real-world fixtures gives regression
coverage for the one part of the integration this project fully controls,
consistent with the existing repo convention of unit-testing pure
`~/utils/*` functions only.
