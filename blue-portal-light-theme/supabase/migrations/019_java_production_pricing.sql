-- Restore Java Launchpad production pricing after the ₹1 payment test.
-- Successful test payments remain unchanged for an accurate audit trail.

ALTER TABLE java_course_registrations
  ADD COLUMN IF NOT EXISTS course_fee NUMERIC(10, 2) NOT NULL DEFAULT 2500.00,
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10, 2) NOT NULL DEFAULT 59.00,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2) NOT NULL DEFAULT 2559.00;

ALTER TABLE java_course_registrations
  ALTER COLUMN course_fee SET DEFAULT 2500.00,
  ALTER COLUMN gateway_fee SET DEFAULT 59.00,
  ALTER COLUMN payment_amount SET DEFAULT 2559.00;

UPDATE java_course_registrations
SET course_fee = 2500.00,
    gateway_fee = 59.00,
    payment_amount = 2559.00,
    updated_at = now()
WHERE payment_status = 'pending';

NOTIFY pgrst, 'reload schema';
