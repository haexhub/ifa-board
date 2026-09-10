-- ifa-board: triggers (T018)

-- Audit: set last_updated_at (and last_updated_by if column exists)
create or replace function public.set_last_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.last_updated_at := now();
  if to_jsonb(new) ? 'last_updated_by' then
    new.last_updated_by := auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'teams','players','point_categories','trainings','point_entries'
  ]) loop
    execute format(
      'create trigger %I_set_last_updated before update on public.%I
       for each row execute function public.set_last_updated_at();',
      t || '_upd', t
    );
  end loop;
end$$;

-- team_settings uses its own updated_at / updated_by columns
create or replace function public.set_team_settings_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger team_settings_upd before update on public.team_settings
for each row execute function public.set_team_settings_updated();

-- Guard: prevent removing / downgrading the last trainer of a team
create or replace function public.prevent_last_trainer_change()
returns trigger
language plpgsql
as $$
declare
  v_team_id uuid;
  v_remaining int;
begin
  if tg_op = 'DELETE' then
    v_team_id := old.team_id;
    if old.role <> 'trainer' then
      return old;
    end if;
  else
    v_team_id := new.team_id;
    if old.role = 'trainer' and new.role = 'trainer' then
      return new;
    end if;
    if new.role = 'trainer' then
      return new;
    end if;
  end if;

  select count(*) into v_remaining
    from public.memberships
    where team_id = v_team_id and role = 'trainer'
      and not (user_id = old.user_id);

  if v_remaining = 0 then
    raise exception 'A team must keep at least one trainer.'
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger memberships_last_trainer_guard
  before update or delete on public.memberships
  for each row execute function public.prevent_last_trainer_change();

-- Enforce point_entry value within the category's current range
create or replace function public.enforce_point_entry_range()
returns trigger
language plpgsql
as $$
declare
  v_min int;
  v_max int;
begin
  select value_min, value_max into v_min, v_max
    from public.point_categories where id = new.category_id;
  if new.value < v_min or new.value > v_max then
    raise exception 'point_entry value % is outside category range [%..%]',
      new.value, v_min, v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger point_entries_range_check
  before insert or update on public.point_entries
  for each row execute function public.enforce_point_entry_range();

-- Enforce team consistency: training.team_id = player.team_id = category.team_id
create or replace function public.enforce_point_entry_team_consistency()
returns trigger
language plpgsql
as $$
declare
  v_t uuid; v_p uuid; v_c uuid;
begin
  select team_id into v_t from public.trainings where id = new.training_id;
  select team_id into v_p from public.players where id = new.player_id;
  select team_id into v_c from public.point_categories where id = new.category_id;
  if v_t is null or v_p is null or v_c is null then
    raise exception 'referenced training/player/category not found';
  end if;
  if v_t <> v_p or v_t <> v_c then
    raise exception 'point_entry team mismatch: training=%, player=%, category=%',
      v_t, v_p, v_c using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger point_entries_team_consistency
  before insert or update on public.point_entries
  for each row execute function public.enforce_point_entry_team_consistency();

-- Enforce: cannot move a training to status='saved' without at least one photo
create or replace function public.enforce_training_has_photo()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'saved' and (old.status is null or old.status <> 'saved') then
    if not exists (
      select 1 from public.training_photos where training_id = new.id
    ) then
      raise exception 'training % cannot be saved without at least one photo', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trainings_photo_required
  before update on public.trainings
  for each row execute function public.enforce_training_has_photo();

-- Enforce photo storage_path first segment matches training.team_id
create or replace function public.enforce_photo_path_team()
returns trigger
language plpgsql
as $$
declare
  v_team uuid;
  v_prefix text;
begin
  select team_id into v_team from public.trainings where id = new.training_id;
  if v_team is null then
    raise exception 'referenced training not found';
  end if;
  v_prefix := split_part(new.storage_path, '/', 1);
  if v_prefix is null or v_prefix = '' or v_prefix <> v_team::text then
    raise exception 'photo storage_path % does not start with training team_id %',
      new.storage_path, v_team using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger training_photos_path_team_check
  before insert on public.training_photos
  for each row execute function public.enforce_photo_path_team();

-- Enforce: linked_user must have a player-role membership in same team
create or replace function public.enforce_player_linked_user_membership()
returns trigger
language plpgsql
as $$
begin
  if new.linked_user_id is not null then
    if not exists (
      select 1 from public.memberships
       where user_id = new.linked_user_id
         and team_id = new.team_id
         and role = 'player'
    ) then
      raise exception 'linked_user_id % has no player-membership in team %',
        new.linked_user_id, new.team_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger players_linked_user_membership_check
  before insert or update of linked_user_id on public.players
  for each row execute function public.enforce_player_linked_user_membership();

-- On team creation, seed team_settings
create or replace function public.bootstrap_team_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.team_settings(team_id) values (new.id);
  return new;
end;
$$;

create trigger teams_bootstrap_settings
  after insert on public.teams
  for each row execute function public.bootstrap_team_settings();
