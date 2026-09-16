# Quickstart Delta: Mitglieder-Profilseite

No new dev-environment setup — reuses the running stack from
[specs/001-points-and-photos/quickstart.md](../001-points-and-photos/quickstart.md).
After `/speckit.tasks` lands and the migration is authored:

1. `pnpm db:generate` — Drizzle picks up `avatar_path` on `user_profiles`.
2. Hand-write the two SQL migrations from
   [contracts/rls-policies.md](./contracts/rls-policies.md) (self-update
   policy + check constraint follow the Drizzle-generated one; bucket +
   storage policies are their own migration, same shape as
   `supabase/migrations/20260910123000_storage_photos.sql`).
3. `pnpm db:reset` to apply, then `pnpm gen:types`.
4. Manual smoke test: sign in, open `/profile`, change the name, upload an
   avatar, confirm both show up on `/t/<slug>/team/members`. Then as a
   trainer of that team, reset the same member's avatar/name from the
   members page and confirm it reverts.
