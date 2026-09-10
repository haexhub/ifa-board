-- ifa-board: enable RLS on every base table (T019)

alter table public.teams             enable row level security;
alter table public.memberships       enable row level security;
alter table public.invitations       enable row level security;
alter table public.players           enable row level security;
alter table public.point_categories  enable row level security;
alter table public.trainings         enable row level security;
alter table public.training_photos   enable row level security;
alter table public.point_entries     enable row level security;
alter table public.team_settings     enable row level security;
