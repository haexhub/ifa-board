# Contract: Public Anonymous Ranking

**Feature**: 001-points-and-photos
**Spec reference**: FR-060..064, US5, SC-008, A11
**Route**: `GET /public/ranking` (Nuxt page, SSR)
**RPC**: `supabase.rpc('get_public_ranking', { from: DATE, to: DATE })`

Serves the team ranking to unauthenticated visitors. No PII leaves the
database. Personally identifying attributes (name, position, photo,
per-training values) are NOT reachable through this contract.

## Output shape

Each row of the RPC result:

```ts
type PublicRankingRow = {
  rank_position: number         // 1-based; ties share a rank (dense_rank)
  jersey_number: number | null  // null for players without a jersey number
  scores: Record<string, number>  // key = category.id (uuid), value = SUM(value) in timeframe
}

type PublicRankingResponse = {
  from: string   // ISO date, echoed input
  to: string     // ISO date, echoed input
  categories: Array<{
    id: string           // category uuid
    name: string         // category name (Deutsch)
    sort_order: number
  }>
  rows: PublicRankingRow[]
}
```

Notes:

- `categories` in the response describes the columns the client should
  render; comes from `select id, name, sort_order from point_categories
  where active order by sort_order`. Category **names** are considered
  non-PII and thus allowed in the anonymous response.
- `rows` are ordered by `rank_position asc, jersey_number asc`.
- Only players with `active = true` are considered.

## Postgres implementation sketch

```sql
create or replace function public.get_public_ranking(
  p_from date,
  p_to date
) returns jsonb
language sql
stable
security invoker
as $$
  with active_cats as (
    select id, name, sort_order
    from point_categories
    where active
    order by sort_order
  ),
  scored as (
    select p.id as player_id, p.jersey_number, c.id as category_id,
           coalesce(sum(pe.value), 0) as sum_value
    from players p
    cross join active_cats c
    left join point_entries pe on pe.player_id = p.id and pe.category_id = c.id
    left join trainings t on t.id = pe.training_id
     and t.date between p_from and p_to and t.status = 'saved'
    where p.active
    group by p.id, p.jersey_number, c.id
  ),
  ranked as (
    -- lexicographic sort by sort_order, sum_value desc
    -- implemented dynamically in the function body
    select ...
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'categories', (select jsonb_agg(row_to_json(ac)) from active_cats ac),
    'rows', (select jsonb_agg(row_to_json(r)) from ranked r)
  );
$$;

grant execute on function public.get_public_ranking(date, date) to anon, authenticated;
```

The `ranked` CTE is implemented with a dynamically constructed
`order by` list because Postgres cannot pivot the category-order sort
into a static SQL expression when the number of categories varies.
Implementation options for this step (decided during
`/speckit-implement`): either a `plpgsql` variant that builds an
`order by` string, or fetch the flat `scored` set and sort client-side
in the Nuxt page (data is tiny — ≤30 rows × ≤5 categories).

## Not exposed via this contract

- Names, positions, photo consent flags, `linked_user_id`.
- Per-training values, per-training photos, training titles/notes.
- Any relationship to `auth.users`.
- Inactive players.

Verified by:

- Playwright test `public-anon.spec.ts` (US5 acceptance scenarios).
- RLS negative test N8 (no `select` on base tables works as anon).

## Rate limiting

Not enforced in v1 (deferred, see research R11 open items). If abuse
appears, add a Vercel edge middleware or a simple in-memory limiter in
`server/middleware/`.
