-- ifa-board: team-scoped tables (T017)

create table public.players (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  name              text not null,
  active            boolean not null default true,
  jersey_number     int,
  position          text,
  linked_user_id    uuid references auth.users(id) on delete set null,
  photo_consent     boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  last_updated_at   timestamptz not null default now(),
  last_updated_by   uuid references auth.users(id)
);

create index players_team_idx on public.players(team_id);
create index players_team_active_idx on public.players(team_id, active);
create unique index players_active_jersey_per_team_uniq
  on public.players(team_id, jersey_number)
  where active = true and jersey_number is not null;
create unique index players_linked_user_per_team_uniq
  on public.players(team_id, linked_user_id)
  where linked_user_id is not null;

create table public.point_categories (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  name              text not null,
  active            boolean not null default true,
  sort_order        int not null,
  value_min         int not null,
  value_max         int not null,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  last_updated_at   timestamptz not null default now(),
  last_updated_by   uuid references auth.users(id),
  check (value_max >= value_min)
);

create index point_categories_team_active_sort_idx
  on public.point_categories(team_id, active, sort_order);

create table public.trainings (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  date              date not null,
  title             text,
  note              text,
  status            text not null default 'draft' check (status in ('draft','saved')),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  last_updated_at   timestamptz not null default now(),
  last_updated_by   uuid references auth.users(id),
  check (date <= current_date)
);

create index trainings_team_date_idx on public.trainings(team_id, date desc);

create table public.training_photos (
  id             uuid primary key default gen_random_uuid(),
  training_id    uuid not null references public.trainings(id) on delete cascade,
  storage_path   text not null unique,
  content_type   text not null check (content_type in
                   ('image/jpeg','image/png','image/heic','image/heif','image/webp')),
  size_bytes     int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by    uuid not null references auth.users(id),
  uploaded_at    timestamptz not null default now()
);

create index training_photos_training_idx on public.training_photos(training_id);

create table public.point_entries (
  id                uuid primary key default gen_random_uuid(),
  training_id       uuid not null references public.trainings(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete restrict,
  category_id       uuid not null references public.point_categories(id) on delete restrict,
  value             int not null,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  last_updated_at   timestamptz not null default now(),
  last_updated_by   uuid references auth.users(id),
  unique (training_id, player_id, category_id)
);

create index point_entries_training_idx on public.point_entries(training_id);
create index point_entries_player_idx on public.point_entries(player_id);

create table public.team_settings (
  team_id       uuid primary key references public.teams(id) on delete cascade,
  season_start  date not null default date_trunc('year', current_date)::date,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);
