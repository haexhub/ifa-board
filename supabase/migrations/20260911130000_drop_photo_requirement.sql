-- Photos are now optional for a training in every state.
-- Drops the two guards installed in 20260910121500_triggers.sql:
--   1. trainings_photo_required — blocked draft → saved without a photo.
--   2. training_photos_required — blocked deleting the last photo of a saved training.

drop trigger if exists trainings_photo_required on public.trainings;
drop trigger if exists training_photos_required on public.training_photos;
drop function if exists public.enforce_training_has_photo();
drop function if exists public.enforce_saved_training_has_photo();
