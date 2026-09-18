-- Fix: function_search_path_mutable lint warnings for functions predating
-- the search_path convention used elsewhere in this schema. All bodies
-- already fully-qualify table/function references with `public.`, so an
-- empty search_path is safe.

alter function public.enforce_photo_path_team() set search_path = '';
alter function public.enforce_player_linked_user_membership() set search_path = '';
alter function public.bootstrap_team_settings() set search_path = '';
alter function public.enforce_point_entry_team_consistency() set search_path = '';
alter function public.set_last_updated_at() set search_path = '';
alter function public.set_team_settings_updated() set search_path = '';
alter function public.prevent_last_trainer_change() set search_path = '';
alter function public.enforce_point_entry_range() set search_path = '';
alter function public.get_player_scores_by_category(uuid, uuid, date, date) set search_path = '';
alter function public.get_team_ranking(uuid, date, date) set search_path = '';
