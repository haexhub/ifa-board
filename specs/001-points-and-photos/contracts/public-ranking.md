# Contract: Public Anonymous Ranking (Round 2, per Team)

**Feature**: 001-points-and-photos
**Spec reference**: FR-060..064, US5, SC-008, A11, A15
**Route**: `GET /public/<slug>/ranking` (Nuxt page, SSR)
**RPC**: `supabase.rpc('get_public_ranking', { p_slug: string, p_from: DATE, p_to: DATE })`

Serves the team ranking for the given slug to unauthenticated visitors.
No PII (names, positions, photos, per-training values, team `id`) leaves
the database.

## Output shape

```ts
type PublicRankingRow = {
  rank_position: number         // 1-based; ties share a rank (dense_rank)
  jersey_number: number | null  // null => rendered as "—" (FR-063)
  scores: Record<string, number>  // key = category name (string), value = SUM(value) in timeframe
}

type PublicRankingResponse = {
  team_name: string      // safe: the team's public display name only
  from: string           // ISO date, echoed
  to: string             // ISO date, echoed
  categories: Array<{
    name: string         // German, from point_categories.name
    sort_order: number
  }>
  rows: PublicRankingRow[]
}
```

Notes:

- The response contains `team_name` (public) and category `name`s but
  NEVER the team's `id`, `slug` beyond the URL, player names,
  positions, `linked_user_id`, or photo references.
- `rows` are ordered by `rank_position asc, jersey_number asc nulls
  last`.
- `scores` is keyed by category **name** (not `id`) so no internal UUID
  leaks. Category names are deemed non-PII.
- Only active players are considered.

## Postgres implementation sketch

```sql
create or replace function public.get_public_ranking(
  p_slug text,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_team_id uuid;
  v_team_name text;
  v_result jsonb;
begin
  select id, name into v_team_id, v_team_name
    from public.teams where slug = p_slug;
  if v_team_id is null then
    return jsonb_build_object(
      'team_name', null, 'from', p_from, 'to', p_to,
      'categories', '[]'::jsonb, 'rows', '[]'::jsonb,
      'not_found', true
    );
  end if;

  -- (Assemble ranking using is_member-free path so anon can call.
  --  Base tables are NOT read via the anon session's own privileges;
  --  the SECURITY INVOKER on this function relies on the base tables
  --  being gated by RLS. Because this function is called by anon and
  --  base tables deny anon, we must grant SELECT of the specific
  --  projected columns via a definer wrapper OR keep this function
  --  `security definer` with a very narrow projection.
  --  Decision: use `security definer` limited to reading the aggregated
  --  columns only, since that is safer to audit than granting anon
  --  select on base tables. Ownership set to a role that only has
  --  read access.)
  return v_result;
end
$$;

grant execute on function public.get_public_ranking(text, date, date) to anon, authenticated;
```

The decision above (`security definer` on a role with strictly limited
grants) diverges from Round 1's `security invoker` sketch. Reason: with
multi-tenant RLS, invoker semantics would require granting anon
`select` on base tables — a bigger footprint than the projection
requires. The definer function is narrower.

## Postgres role for the definer

Migration creates a dedicated role `public_ranking_reader`, grants it
`select` on the exact columns needed, and owns `get_public_ranking`.
The function body uses only those columns.

## Not exposed via this contract

- Team `id`, player names, positions, photo consent flags,
  `linked_user_id`.
- Per-training values, photos, training titles/notes.
- Any `auth.users` relationship.
- Inactive players.
- Other teams' data (function takes exactly one slug).

## Verified by

- Playwright `public-anon.spec.ts` (US5 acceptance scenarios).
- Playwright `rls-negative-cross-team.spec.ts` rows X8..X10.

## Rate limiting

Not enforced in v1 (deferred, see [research.md](../research.md)). If
abuse appears, add a Vercel edge middleware or a Postgres statement
timeout.
