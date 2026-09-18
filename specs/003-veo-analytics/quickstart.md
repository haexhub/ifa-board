# Quickstart Delta: Veo-Kamera-Analytics

## New environment variables

Add to `.env` (local) / the deployment's env config — **never** the club's
Veo password or session value itself (see
[research.md §4](./research.md#4-credential-storage), that lives in
`veo_sync_credentials`, not env), and **not** the club/team slugs either
(those live in `veo_team_mappings`, see below —
[research.md §5](./research.md#5-team-mapping-veo-team--playerboard-team)):

```
NUXT_VEO_SYNC_SECRET=<random shared secret, used by the cron call>
```

## Local development — no live Veo dependency

There is no sandbox/test Veo account. Local dev and CI do **not** call the
real Veo API:

- Unit tests for `app/server/utils/veo/mapStats.ts` run against fixture
  payloads (captured during this feature's research, checked into
  `tests/fixtures/veo/`).
- The e2e spec seeds `veo_matches`/`veo_match_stats`/`veo_sync_status` rows
  directly via the local Supabase DB, then verifies the `/t/[slug]/analytics`
  page and the sync-status banner — it never invokes `POST /api/veo/sync`
  against the real Veo backend.
- `POST /api/veo/sync` itself can be smoke-tested locally only by someone
  with real club credentials, manually, against the real Veo API — not part
  of the automated suite.

## Enabling a team for Veo sync (manual, outside this repo's automation)

Until the separate "Platform-Administration" feature ships a settings UI
for this, both of the following are done via direct SQL by whoever operates
the deployment ([research.md §5](./research.md#5-team-mapping-veo-team--playerboard-team)):

1. Insert one row into `veo_team_mappings` for the team being enabled:
   `team_id` (the Playerboard team's uuid), `veo_club_slug` (e.g.
   `tsv-ifa-chemnitz`), `veo_team_slug` (e.g. `c-junioren-cec9ec43`),
   `enabled = true`. No row for a team means no Veo access for it — this is
   the actual security boundary (FR-011), not a convenience default.
2. To revoke access, set that row's `enabled = false` (or delete it) — the
   sync route skips it on the next run; already-synced data for that team
   stays visible (per the clarified "deleted/private match" edge case).

## One-time credential capture (manual, outside this repo's automation)

1. A trainer/admin logs into `app.veo.co` with the club account in a normal
   browser.
2. The resulting `auth.veo.co` session artifact is captured (see this
   feature's research process for the concrete steps) and inserted into
   `veo_sync_credentials` for the team via a direct DB write (e.g.
   `psql`/Supabase SQL editor) — not through any app UI in v1
   ([research.md §3](./research.md#3-veo-authentication-strategy)).
3. This step is repeated whenever `veo_sync_status.consecutive_failures`
   indicates the session has stopped renewing.

## Production scheduling

Add one crontab entry on the VPS (outside this repo, documented here for
ops reference):

```
0 3 * * * curl -sf -X POST https://<host>/api/veo/sync \
  -H "Authorization: Bearer $NUXT_VEO_SYNC_SECRET" || echo "veo sync failed" | logger
```

Daily at 03:00 is sufficient per FR-006/the clarified "täglicher Batch
reicht" decision.

## After schema changes

As with every schema-affecting change in this repo:

```
pnpm db:generate   # drizzle-kit generate → new supabase/migrations/*.sql
pnpm gen:types      # regenerate app/types/database.ts
```

Both the migration and the regenerated types MUST be committed together
(Principle V).
