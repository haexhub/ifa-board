-- Apply category ordering in one transaction so a failed reorder cannot leave
-- the team with only a partially updated order.
create or replace function public.reorder_point_categories(
  p_team uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item_count integer;
begin
  if not public.is_trainer(p_team) then
    raise exception 'only team trainers can reorder categories'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'category reorder items must be an array'
      using errcode = 'invalid_parameter_value';
  end if;

  select count(*) into v_item_count
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer);

  if exists (
    select 1
      from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
     where item.id is null or item.sort_order is null or item.sort_order < 1
  ) then
    raise exception 'category ids and positive sort orders are required'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_item_count <> (
    select count(distinct item.id)
      from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
  ) then
    raise exception 'category ids must be unique'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_item_count <> (
    select count(*)
      from public.point_categories category
      join jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
        on item.id = category.id
     where category.team_id = p_team
  ) then
    raise exception 'all categories must belong to the selected team'
      using errcode = 'foreign_key_violation';
  end if;

  update public.point_categories as category
     set sort_order = item.sort_order
    from jsonb_to_recordset(p_items) as item(id uuid, sort_order integer)
   where category.id = item.id
     and category.team_id = p_team;
end;
$$;

revoke all on function public.reorder_point_categories(uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.reorder_point_categories(uuid, jsonb)
  to authenticated;
