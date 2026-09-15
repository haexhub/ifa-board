-- Existing duplicates must be resolved explicitly before this constraint can
-- be introduced. Do not silently discard categories or their point entries.
do $$
declare
  duplicate_category record;
begin
  select team_id, name, count(*) as duplicate_count
    into duplicate_category
    from public.point_categories
   group by team_id, name
  having count(*) > 1
   limit 1;

  if found then
    raise exception
      'Cannot enforce unique point category names: team % has % rows named %; resolve duplicates before applying this migration',
      duplicate_category.team_id,
      duplicate_category.duplicate_count,
      duplicate_category.name;
  end if;
end
$$;

create unique index "point_categories_team_name_uniq"
  on public.point_categories using btree (team_id, name);
