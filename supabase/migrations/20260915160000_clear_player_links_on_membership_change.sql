-- Keep players.linked_user_id valid when the corresponding membership changes.

create or replace function public.clear_player_links_after_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.players
       set linked_user_id = null
     where team_id = old.team_id
       and linked_user_id = old.user_id;
    return old;
  end if;

  if old.team_id is distinct from new.team_id
     or old.role is distinct from new.role then
    update public.players
       set linked_user_id = null
     where linked_user_id = old.user_id
       and team_id in (old.team_id, new.team_id);
  end if;

  return new;
end;
$$;

create trigger memberships_clear_player_links
  after update of team_id, role or delete on public.memberships
  for each row execute function public.clear_player_links_after_membership_change();
