-- Validate the transitional constraint separately so production writes are
-- not blocked by a table-wide scan during the ALTER TABLE.
ALTER TABLE "trainings"
  VALIDATE CONSTRAINT "trainings_date_not_future";
