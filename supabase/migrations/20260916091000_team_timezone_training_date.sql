-- The schema migration adds the trusted timezone and removes the old global
-- CHECK. This trigger enforces the invariant against that team-local date.
CREATE OR REPLACE FUNCTION public.validate_training_date_not_future()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  team_timezone text;
BEGIN
  SELECT t.timezone
    INTO team_timezone
    FROM public.teams t
   WHERE t.id = NEW.team_id;

  IF team_timezone IS NULL THEN
    RAISE EXCEPTION 'training team does not exist'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.date > (now() AT TIME ZONE team_timezone)::date THEN
    RAISE EXCEPTION 'training date cannot be in the future for the team timezone'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trainings_date_not_future
  BEFORE INSERT OR UPDATE OF team_id, date ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_training_date_not_future();
