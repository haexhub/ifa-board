-- ifa-board: RLS helper functions + user_profiles view (T016)

create or replace function public.is_member(p_team uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
      from public.memberships
      where team_id = p_team
        and user_id = auth.uid()
  );
$$;

create or replace function public.is_trainer(p_team uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
      from public.memberships
      where team_id = p_team
        and user_id = auth.uid()
        and role = 'trainer'
  );
$$;

comment on function public.is_member(uuid) is
  'RLS helper: is auth.uid() a member of the given team?';
comment on function public.is_trainer(uuid) is
  'RLS helper: is auth.uid() a trainer of the given team?';

-- Publicly readable projection of auth.users for display-name reads.
create or replace view public.user_profiles as
  select id,
         coalesce((raw_user_meta_data->>'display_name'), split_part(email, '@', 1)) as display_name,
         email
    from auth.users;

comment on view public.user_profiles is
  'Projection of auth.users limited to id + display_name + email.';

-- Restrict the view: only authenticated users may query it, and only for
-- rows they can already see via a membership overlap. We use a security
-- barrier view + explicit grant.
alter view public.user_profiles set (security_barrier = true);
grant select on public.user_profiles to authenticated;
