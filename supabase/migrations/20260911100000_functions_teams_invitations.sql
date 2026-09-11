-- ifa-board: transactional helpers for team creation and invitation acceptance (US0)
-- These functions are SECURITY DEFINER and are invoked from the trusted
-- server routes with `service_role` after the caller's session has been
-- verified. They take the effective user id/email as explicit arguments so
-- they can be reused from any trusted caller without depending on auth.uid().

create or replace function public.create_team_with_trainer(
  p_name text,
  p_slug text,
  p_user_id uuid
) returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  insert into public.teams(name, slug, created_by)
    values (p_name, p_slug, p_user_id)
    returning public.teams.id into v_team_id;

  insert into public.memberships(user_id, team_id, role)
    values (p_user_id, v_team_id, 'trainer');

  return query select v_team_id, p_slug;
end;
$$;

revoke all on function public.create_team_with_trainer(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_team_with_trainer(text, text, uuid)
  to service_role;

comment on function public.create_team_with_trainer(text, text, uuid) is
  'Atomically create a team and its founding trainer membership. service_role only.';


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
begin
  select i.id, i.team_id, i.email, i.role, i.expires_at, i.accepted_at, t.slug
    into v_id, v_team_id, v_email, v_role, v_expires_at, v_accepted_at, v_slug
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
  'inserts the membership (idempotent) and marks accepted_at. service_role only.';
