-- ifa-board: RLS helper functions + protected user profiles (T016)

create or replace function public.is_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships
      where public.memberships.team_id = p_team
        and public.memberships.user_id = auth.uid()
  );
$$;

create or replace function public.is_trainer(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships
      where public.memberships.team_id = p_team
        and public.memberships.user_id = auth.uid()
        and public.memberships.role = 'trainer'
  );
$$;

revoke all on function public.is_member(uuid) from public, anon, service_role;
revoke all on function public.is_trainer(uuid) from public, anon, service_role;
grant execute on function public.is_member(uuid), public.is_trainer(uuid)
  to authenticated;

comment on function public.is_member(uuid) is
  'RLS helper: is auth.uid() a member of the given team?';
comment on function public.is_trainer(uuid) is
  'RLS helper: is auth.uid() a trainer of the given team?';

-- Keep auth.users private. Profiles are synchronized into a separate table
-- and exposed only through an RLS policy for users sharing a team.
create table public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text
);

comment on table public.user_profiles is
  'RLS-protected display-name projection of auth.users.';

create or replace function public.is_profile_visible(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile = auth.uid()
      or exists (
        select 1
          from public.memberships viewer
          join public.memberships target
            on target.team_id = viewer.team_id
         where viewer.user_id = auth.uid()
           and target.user_id = p_profile
      );
$$;

revoke all on function public.is_profile_visible(uuid) from public, anon, service_role;
grant execute on function public.is_profile_visible(uuid) to authenticated;

alter table public.user_profiles enable row level security;

create policy user_profiles_read_team on public.user_profiles
  for select to authenticated
  using (public.is_profile_visible(id));

grant select on public.user_profiles to authenticated;

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set display_name = excluded.display_name;
  return new;
end;
$$;

revoke all on function public.sync_user_profile() from public, anon, authenticated, service_role;

create trigger on_auth_user_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_user_profile();

insert into public.user_profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
  from auth.users
on conflict (id) do nothing;
