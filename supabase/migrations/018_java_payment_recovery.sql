-- Bring installations that ran an earlier 017 migration up to date.
-- The learner-facing preferred-schedule and learning-goal questions were removed.

ALTER TABLE java_course_registrations
  ADD COLUMN IF NOT EXISTS course_fee NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.02;

ALTER TABLE java_course_registrations
  ALTER COLUMN preferred_schedule DROP NOT NULL,
  ALTER COLUMN preferred_schedule SET DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
