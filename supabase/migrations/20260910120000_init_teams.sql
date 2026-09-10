-- ifa-board: teams / memberships / invitations (Phase 2, T015)

create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  created_by        uuid not null references auth.users(id),
  created_at        timestamptz not null default now(),
  last_updated_at   timestamptz not null default now(),
  last_updated_by   uuid references auth.users(id)
);

comment on table public.teams is 'One football team / squad. Multi-tenant boundary.';

create table public.memberships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  role        text not null check (role in ('trainer','player')),
  created_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);

comment on table public.memberships is 'Per-team role. A user may hold different roles in different teams.';

create index memberships_team_idx on public.memberships(team_id);
create index memberships_user_idx on public.memberships(user_id);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('trainer','player')),
  token        text not null unique,
  invited_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz
);

comment on table public.invitations is 'Outstanding + accepted team invitations. Token-authenticated.';

create unique index invitations_team_email_open_uniq
  on public.invitations(team_id, email)
  where accepted_at is null;
create index invitations_email_open_idx
  on public.invitations(email)
  where accepted_at is null;
create index invitations_token_idx on public.invitations(token);
