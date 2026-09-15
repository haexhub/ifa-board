-- ifa-board: extend accept_invitation to auto-link a pre-created player row
-- (US4 follow-up) when the invitation was issued with `player_id` set, i.e.
-- issued together with a new roster entry via PlayerForm's "Per E-Mail
-- einladen" mode. Runs after the membership insert so the existing
-- enforce_player_linked_user_membership trigger's invariant (linked user
-- must already have a player-role membership in that team) still holds.
-- Guarded by `linked_user_id is null` so it never clobbers a manual link
-- made in the meantime.

create or replace function public.accept_invitation(
  p_token text,
  p_user_id uuid,
  p_user_email text
) returns table (slug text, already_accepted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_team_id uuid;
  v_email text;
  v_role text;
  v_expires_at timestamptz;
  v_accepted_at timestamptz;
  v_slug text;
  v_player_id uuid;
begin
  select i.id, i.team_id, i.email, i.role, i.expires_at, i.accepted_at, i.player_id, t.slug
    into v_id, v_team_id, v_email, v_role, v_expires_at, v_accepted_at, v_player_id, v_slug
    from public.invitations i
    join public.teams t on t.id = i.team_id
   where i.token = p_token
   for update of i;

  if not found then
    raise exception 'invitation not found' using errcode = 'no_data_found';
  end if;

  if v_accepted_at is not null then
    return query select v_slug, true;
    return;
  end if;

  if v_expires_at < now() then
    raise exception 'invitation expired' using errcode = 'check_violation';
  end if;

  if lower(v_email) <> lower(p_user_email) then
    raise exception 'invitation email mismatch' using errcode = 'insufficient_privilege';
  end if;

  insert into public.memberships(user_id, team_id, role)
    values (p_user_id, v_team_id, v_role)
    on conflict (user_id, team_id) do nothing;

  if v_player_id is not null then
    update public.players
       set linked_user_id = p_user_id
     where id = v_player_id
       and linked_user_id is null;
  end if;

  update public.invitations
     set accepted_at = now()
   where id = v_id;

  return query select v_slug, false;
end;
$$;

revoke all on function public.accept_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid, text)
  to service_role;

comment on function public.accept_invitation(text, uuid, text) is
  'Atomically accept an invitation: verifies token/expiry/email match, then '
  'inserts the membership (idempotent), links the pre-created player row '
  'when the invitation carries one, and marks accepted_at. service_role only.';
