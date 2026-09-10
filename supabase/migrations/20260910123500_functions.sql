-- ifa-board: ranking + public functions (T030)

-- Player scores per category over a timeframe (authenticated helper).
create or replace function public.get_player_scores_by_category(
  p_team   uuid,
  p_player uuid,
  p_from   date,
  p_to     date
)
returns table (
  category_id   uuid,
  category_name text,
  sort_order    int,
  sum_value     bigint,
  avg_value     numeric,
  median_value  numeric
)
language sql
stable
security invoker
as $$
  with active_cats as (
    select id, name, sort_order
      from public.point_categories
      where team_id = p_team and active
      order by sort_order
  )
  select ac.id           as category_id,
         ac.name         as category_name,
         ac.sort_order,
         coalesce(sum(pe.value), 0)::bigint          as sum_value,
         avg(pe.value)                                as avg_value,
         percentile_cont(0.5) within group (order by pe.value) as median_value
    from active_cats ac
    left join public.point_entries pe on pe.category_id = ac.id
      and pe.player_id = p_player
    left join public.trainings t on t.id = pe.training_id
      and t.date between p_from and p_to
      and t.status = 'saved'
      and t.team_id = p_team
   group by ac.id, ac.name, ac.sort_order
   order by ac.sort_order;
$$;

grant execute on function public.get_player_scores_by_category(uuid, uuid, date, date)
  to authenticated;

-- Full team ranking: dense_rank over lexicographic category-order.
create or replace function public.get_team_ranking(
  p_team uuid,
  p_from date,
  p_to   date
)
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_categories jsonb;
  v_rows jsonb;
begin
  if not public.is_member(p_team) then
    return null;
  end if;

  with active_cats as (
    select id, name, sort_order
      from public.point_categories
      where team_id = p_team and active
      order by sort_order
  ),
  scored as (
    select p.id  as player_id,
           p.name,
           p.jersey_number,
           ac.id as category_id,
           coalesce(sum(pe.value), 0)::bigint as sum_value
      from public.players p
      cross join active_cats ac
      left join public.point_entries pe on pe.player_id = p.id and pe.category_id = ac.id
      left join public.trainings t on t.id = pe.training_id
        and t.date between p_from and p_to
        and t.status = 'saved'
        and t.team_id = p_team
     where p.team_id = p_team and p.active
     group by p.id, p.name, p.jersey_number, ac.id
  ),
  pivoted as (
    select player_id, name, jersey_number,
           jsonb_object_agg(category_id::text, sum_value) as scores,
           array_agg(sum_value order by (select sort_order from active_cats ac where ac.id = category_id)) as ranking_vector
      from scored
     group by player_id, name, jersey_number
  ),
  ranked as (
    select *,
           dense_rank() over (order by ranking_vector desc) as rank_position
      from pivoted
  )
  select jsonb_agg(row_to_json(r) order by r.rank_position, r.jersey_number nulls last)
    into v_rows
    from (
      select rank_position, player_id, name, jersey_number, scores
        from ranked
    ) r;

  select jsonb_agg(row_to_json(c) order by c.sort_order)
    into v_categories
    from (
      select id, name, sort_order from public.point_categories
        where team_id = p_team and active order by sort_order
    ) c;

  return jsonb_build_object(
    'team_id', p_team,
    'from', p_from,
    'to', p_to,
    'categories', coalesce(v_categories, '[]'::jsonb),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_team_ranking(uuid, date, date) to authenticated;

-- Placeholder public ranking function — real body written in US5 migration T094.
create or replace function public.get_public_ranking(
  p_slug text,
  p_from date,
  p_to   date
)
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'team_name', null,
    'from', p_from,
    'to', p_to,
    'categories', '[]'::jsonb,
    'rows', '[]'::jsonb,
    'not_implemented', true
  );
$$;

grant execute on function public.get_public_ranking(text, date, date) to anon, authenticated;
